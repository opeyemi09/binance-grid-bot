const express = require("express");
const fs = require("fs");
const axios = require("axios");
const crypto = require("crypto");
const ta = require("technicalindicators");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(express.json());

const DATA_DIR = "./data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DATA_DIR + "/daily_logs")) fs.mkdirSync(DATA_DIR + "/daily_logs");

const configPath = "./config.json";

// --- Default structure: SYMBOLS is an object: { BTCUSDT: {...}, ETHUSDT: {...}, ... } ---
let config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath))
  : {
      SYMBOLS: {
        "BTCUSDT": {
          CAPITAL: 1000,
          RISK_PERCENT: 1,
          LEVERAGE: 5,
          GRID_STEPS: 3,
          GRID_SPACING: 0.003,
          FEE_PERCENT: 0.0004,
          TIMEFRAME: "1",
          TP1: 0.02,
          TP2: 0.04,
          TRAIL_START: 0.015,
          TRAIL_OFFSET: 0.005,
        },
        "ETHUSDT": {
          CAPITAL: 500,
          RISK_PERCENT: 1.5,
          LEVERAGE: 4,
          GRID_STEPS: 3,
          GRID_SPACING: 0.004,
          FEE_PERCENT: 0.0004,
          TIMEFRAME: "1",
          TP1: 0.018,
          TP2: 0.035,
          TRAIL_START: 0.012,
          TRAIL_OFFSET: 0.006,
        }
      },
      BYBIT_API_KEY: "",
      BYBIT_API_SECRET: "",
      BYBIT_BASE: "https://api.bybit.com",
      TELEGRAM_TOKEN: "",
      TELEGRAM_CHAT_ID: "",
      DEMO_MODE: false,
    };

function getSymbols() {
  return Object.keys(config.SYMBOLS);
}

// ---- Symbol state ----
function initSymbolState(sym) {
  return {
    trades: fs.existsSync(`${DATA_DIR}/trades_${sym}.json`) ? JSON.parse(fs.readFileSync(`${DATA_DIR}/trades_${sym}.json`)) : [],
    performance: fs.existsSync(`${DATA_DIR}/performance_${sym}.json`) ? JSON.parse(fs.readFileSync(`${DATA_DIR}/performance_${sym}.json`)) : {},
    openTrade: fs.existsSync(`${DATA_DIR}/open_trade_${sym}.json`) ? JSON.parse(fs.readFileSync(`${DATA_DIR}/open_trade_${sym}.json`)) : null,
  };
}
let symbolStates = {};
for (const sym of getSymbols()) symbolStates[sym] = initSymbolState(sym);

const tg = config.TELEGRAM_TOKEN && config.TELEGRAM_CHAT_ID
  ? new TelegramBot(config.TELEGRAM_TOKEN, { polling: false })
  : null;
function sendTelegram(msg) {
  if (tg) tg.sendMessage(config.TELEGRAM_CHAT_ID, msg);
}
function logToFile(path, data) { fs.writeFileSync(path, JSON.stringify(data, null, 2)); }

// ---- BYBIT API ----
function bybitSignature(params, secret) {
  const ordered = Object.keys(params).sort().map(k => k + "=" + params[k]).join("&");
  return crypto.createHmac('sha256', secret).update(ordered).digest('hex');
}
async function bybitPrivate(endpoint, params = {}, method = "GET") {
  const recvWindow = 10000;
  const timestamp = Date.now();
  const query = { ...params, api_key: config.BYBIT_API_KEY, timestamp, recvWindow };
  query.sign = bybitSignature(query, config.BYBIT_API_SECRET);
  const url = `${config.BYBIT_BASE}${endpoint}`;
  let resp;
  if (method === "GET") resp = await axios.get(url, { params: query });
  else if (method === "POST") resp = await axios.post(url, null, { params: query });
  else if (method === "DELETE") resp = await axios.delete(url, { params: query });
  if (resp.data.retCode !== 0) throw new Error(resp.data.retMsg);
  return resp.data.result;
}
async function bybitPublic(endpoint, params = {}) {
  const url = `${config.BYBIT_BASE}${endpoint}`;
  const resp = await axios.get(url, { params });
  if (resp.data.retCode !== 0) throw new Error(resp.data.retMsg);
  return resp.data.result;
}

// ---- MARKET DATA & SIGNALS ----
async function fetchKlines(symbol, interval, limit = 100) {
  const data = await bybitPublic("/v5/market/kline", {
    category: "linear", symbol, interval, limit,
  });
  return data.list.map(c => ({
    open: parseFloat(c[1]), high: parseFloat(c[2]), low: parseFloat(c[3]),
    close: parseFloat(c[4]), volume: parseFloat(c[5]), timestamp: Number(c[0])
  })).reverse();
}
function getSignal(candles) {
  const closes = candles.map(c=>c.close);
  if (closes.length < 55) return null;
  const ema20 = ta.EMA.calculate({period: 20, values: closes});
  const ema50 = ta.EMA.calculate({period: 50, values: closes});
  const rsi = ta.RSI.calculate({period: 14, values: closes});
  if (ema20.length < 1 || ema50.length < 1 || rsi.length < 1) return null;
  const lastEma20 = ema20[ema20.length-1];
  const lastEma50 = ema50[ema50.length-1];
  const lastRsi = rsi[rsi.length-1];
  if (lastEma20 > lastEma50 && lastRsi > 55) return "long";
  if (lastEma20 < lastEma50 && lastRsi < 45) return "short";
  return null;
}

// ---- GRID SCALE-IN ----
async function executeGridEntry(sym, symbolConfig, signal, entryPx) {
  const direction = signal === "long" ? 1 : -1;
  const sizeTotal = (symbolConfig.CAPITAL * symbolConfig.RISK_PERCENT / 100) * symbolConfig.LEVERAGE / entryPx;
  const gridSteps = symbolConfig.GRID_STEPS;
  const sizePerStep = sizeTotal / gridSteps;
  const entries = [];
  for (let i = 0; i < gridSteps; i++) {
    const px = +(entryPx * (1 - direction * symbolConfig.GRID_SPACING * i)).toFixed(2);
    if (config.DEMO_MODE) {
      entries.push({price: px, qty: sizePerStep});
      continue;
    }
    try {
      const res = await bybitPrivate("/v5/order/create", {
        category: "linear", symbol: sym,
        side: signal === "long" ? "Buy" : "Sell",
        orderType: "Market",
        qty: sizePerStep.toFixed(4),
        reduceOnly: false, closeOnTrigger: false,
      }, "POST");
      entries.push({price: px, qty: sizePerStep, orderId: res.orderId});
      sendTelegram(`[${sym}] Grid entry (${i+1}/${gridSteps}): ${signal.toUpperCase()} ${sizePerStep.toFixed(4)} @ ${px}`);
    } catch (e) {
      sendTelegram(`[${sym}] Entry failed: ${e.message}`);
    }
  }
  return entries;
}

// ---- POSITION MANAGEMENT ----
function managePositionState(sym, symbolConfig, signal, entries) {
  const entryPx = entries.reduce((sum, e) => sum + e.price, 0) / entries.length;
  const size = entries.reduce((sum, e) => sum + e.qty, 0);
  symbolStates[sym].openTrade = {
    side: signal,
    entries,
    entryPx,
    size,
    tp1Hit: false, tp2Hit: false, trailActive: false,
    trailPx: null,
    startPx: entries[0].price,
    openTime: Date.now(),
    closeTime: null,
    pnl: 0,
    closed: false,
  };
  logToFile(`${DATA_DIR}/open_trade_${sym}.json`, symbolStates[sym].openTrade);
  sendTelegram(`[${sym}] Position opened: ${signal.toUpperCase()} ${size.toFixed(4)} @ avg ${entryPx.toFixed(2)}`);
}

// ---- CHECK TP/TRAIL/STOP ----
async function checkPosition(sym, symbolConfig, candles) {
  let t = symbolStates[sym].openTrade;
  if (!t || t.closed) return;
  const lastPx = candles[candles.length-1].close;
  const direction = t.side === "long" ? 1 : -1;
  const entryPx = t.entryPx;
  const size = t.size;
  // TP1
  if (!t.tp1Hit && direction * (lastPx - entryPx)/entryPx >= symbolConfig.TP1) {
    const qty = size * 0.75;
    if (!config.DEMO_MODE) await bybitPrivate("/v5/order/create", {
      category: "linear", symbol: sym,
      side: t.side === "long" ? "Sell" : "Buy",
      orderType: "Market",
      qty: qty.toFixed(4),
      reduceOnly: true,
    }, "POST");
    t.tp1Hit = true;
    sendTelegram(`[${sym}] TP1 +${symbolConfig.TP1*100}% hit! Closed 75% (${qty.toFixed(4)}) @ ${lastPx}`);
  }
  // TP2
  if (!t.tp2Hit && direction * (lastPx - entryPx)/entryPx >= symbolConfig.TP2) {
    const qty = size * 0.25;
    if (!config.DEMO_MODE) await bybitPrivate("/v5/order/create", {
      category: "linear", symbol: sym,
      side: t.side === "long" ? "Sell" : "Buy",
      orderType: "Market",
      qty: qty.toFixed(4),
      reduceOnly: true,
    }, "POST");
    t.tp2Hit = true;
    t.closed = true;
    t.closeTime = Date.now();
    const pnl = direction * (lastPx - entryPx) * size;
    t.pnl = pnl - entryPx * size * symbolConfig.FEE_PERCENT;
    symbolStates[sym].trades.push(t);
    logToFile(`${DATA_DIR}/trades_${sym}.json`, symbolStates[sym].trades);
    sendTelegram(`[${sym}] TP2 +${symbolConfig.TP2*100}% hit! All closed. Final PNL: ${t.pnl.toFixed(2)} USDT`);
  }
  // Trailing stop after trail start
  if (direction * (lastPx - entryPx)/entryPx >= symbolConfig.TRAIL_START) {
    let newTrail = lastPx * (1 - direction * symbolConfig.TRAIL_OFFSET);
    if (!t.trailActive || direction * (newTrail - (t.trailPx || 0)) > 0) {
      t.trailActive = true;
      t.trailPx = newTrail;
      sendTelegram(`[${sym}] Trailing stop activated at ${t.trailPx.toFixed(2)}`);
    }
  }
  // If price falls back to trailing stop
  if (t.trailActive && (
        (direction === 1 && lastPx <= t.trailPx) ||
        (direction === -1 && lastPx >= t.trailPx)
      )) {
    // Close remaining
    const qty = size * (t.tp1Hit ? 0.25 : 1);
    if (!config.DEMO_MODE) await bybitPrivate("/v5/order/create", {
      category: "linear", symbol: sym,
      side: t.side === "long" ? "Sell" : "Buy",
      orderType: "Market",
      qty: qty.toFixed(4),
      reduceOnly: true,
    }, "POST");
    t.closed = true;
    t.closeTime = Date.now();
    const closePx = t.trailPx;
    const pnl = direction * (closePx - entryPx) * size;
    t.pnl = pnl - entryPx * size * symbolConfig.FEE_PERCENT;
    symbolStates[sym].trades.push(t);
    logToFile(`${DATA_DIR}/trades_${sym}.json`, symbolStates[sym].trades);
    sendTelegram(`[${sym}] Trailing stop hit! Closed all. Final PNL: ${t.pnl.toFixed(2)} USDT`);
  }
}

// ---- DAILY PERFORMANCE LOGGING ----
function logDailyPerformance() {
  for (const sym of getSymbols()) {
    const tlist = symbolStates[sym].trades;
    const today = new Date().toISOString().slice(0, 10);
    const dayTrades = tlist.filter(t => t.closeTime && (new Date(t.closeTime)).toISOString().slice(0, 10) === today);
    const pnl = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    fs.writeFileSync(`${DATA_DIR}/daily_logs/${today}_${sym}.json`,
      JSON.stringify({date: today, symbol: sym, pnl, count: dayTrades.length, trades: dayTrades}, null, 2)
    );
    sendTelegram(`[${sym}] Daily PNL: ${pnl.toFixed(2)} USDT, Trades: ${dayTrades.length}`);
  }
}

// ---- MAIN LOOP ----
async function mainLoop() {
  for (const sym of getSymbols()) {
    try {
      const symbolConfig = config.SYMBOLS[sym];
      const candles = await fetchKlines(sym, symbolConfig.TIMEFRAME, 100);
      // If no open position, look for signal
      if (!symbolStates[sym].openTrade || symbolStates[sym].openTrade.closed) {
        const signal = getSignal(candles);
        if (signal) {
          const entryPx = candles[candles.length-1].close;
          const entries = await executeGridEntry(sym, symbolConfig, signal, entryPx);
          managePositionState(sym, symbolConfig, signal, entries);
        }
      } else {
        await checkPosition(sym, symbolConfig, candles);
      }
    } catch (e) {
      sendTelegram(`[${sym}] Main loop error: ${e.message}`);
    }
  }
}
setInterval(mainLoop, 15000);
setInterval(logDailyPerformance, 1000 * 60 * 60 * 24);

// ---- REST API ----
app.get("/health", (req, res) => res.send("OK"));
app.get("/api/status", async (req, res) => {
  try {
    const result = {};
    for (const sym of getSymbols()) {
      const symbolConfig = config.SYMBOLS[sym];
      const candles = await fetchKlines(sym, symbolConfig.TIMEFRAME, 100);
      const last = candles[candles.length - 1].close;
      result[sym] = {
        status: {
          isRunning: true, currentPrice: last, uptime: process.uptime() * 1000, demoMode: !!config.DEMO_MODE,
          openTrade: symbolStates[sym].openTrade,
        },
        trades: symbolStates[sym].trades,
        performance: symbolStates[sym].performance,
        priceHistory: candles.map(c=>c.close),
        config: symbolConfig,
      };
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get("/api/trades", (req, res) => {
  const all = {};
  for (const sym of getSymbols()) all[sym] = symbolStates[sym].trades;
  res.json(all);
});
app.get("/api/performance", (req, res) => {
  const all = {};
  for (const sym of getSymbols()) all[sym] = symbolStates[sym].performance;
  res.json(all);
});
app.get("/api/config", (req, res) => res.json(config));

// PATCH a single symbol's config (for UI)
app.patch("/api/config/symbol/:symbol", (req, res) => {
  const { symbol } = req.params;
  if (!config.SYMBOLS[symbol]) {
    return res.status(400).json({ error: "Unknown symbol" });
  }
  config.SYMBOLS[symbol] = { ...config.SYMBOLS[symbol], ...req.body };
  logToFile(configPath, config);
  res.json({ success: true, config: config.SYMBOLS[symbol] });
});

// Add a new symbol config ([POST] for UI)
app.post("/api/config/symbol", (req, res) => {
  const { symbol, config: symConfig } = req.body;
  if (!symbol || !symConfig) return res.status(400).json({ error: "symbol and config required" });
  config.SYMBOLS[symbol] = symConfig;
  symbolStates[symbol] = initSymbolState(symbol);
  logToFile(configPath, config);
  res.json({ success: true, config: config.SYMBOLS[symbol] });
});

// Remove a symbol config ([DELETE] for UI)
app.delete("/api/config/symbol/:symbol", (req, res) => {
  const { symbol } = req.params;
  if (!config.SYMBOLS[symbol]) return res.status(400).json({ error: "Unknown symbol" });
  delete config.SYMBOLS[symbol];
  delete symbolStates[symbol];
  logToFile(configPath, config);
  res.json({ success: true });
});

// Overwrite all configs (for UI)
app.put("/api/config", (req, res) => {
  config = { ...config, ...req.body };
  logToFile(configPath, config);
  // Update states for any new or removed symbols
  for (const sym of getSymbols()) if (!symbolStates[sym]) symbolStates[sym] = initSymbolState(sym);
  for (const sym in symbolStates) if (!config.SYMBOLS[sym]) delete symbolStates[sym];
  res.json({ success: true, config });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Multi-symbol Bybit Grid Bot API with per-symbol configs running on port ${PORT}`));
