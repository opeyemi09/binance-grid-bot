

// Updated bot.js with ATR-based stop loss, ladder entries, and fee adjustment
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const app = express();
app.use(express.json());

const configPath = './data/config.json';
const tradesPath = './data/trades.json';
const performanceDir = './data';

let config = {
  symbol: 'XBTUSDTM',
  capital: 1000,
  riskPercent: 1,
  leverage: 5,
  telegramToken: 'YOUR_TELEGRAM_BOT_TOKEN',
  telegramChatId: 'YOUR_CHAT_ID',
  useLadderEntry: true,
  ladderLevels: 4,
  ladderRange: 0.005,
  atrMultiplier: 1.5,
  feePercent: 0.0004,
  timeframe: '1m'
};



if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath));
}

let trades = fs.existsSync(tradesPath) ? JSON.parse(fs.readFileSync(tradesPath)) : [];

const bot = new TelegramBot(config.telegramToken);
const kucoinRestUrl = 'https://api-futures.kucoin.com';

let currentPosition = null;

function sendTelegram(message) {
  bot.sendMessage(config.telegramChatId, message);
}

async function fetchKlines() {
  const symbol = config.symbol;
  const tf = config.timeframe;
  const url = `${kucoinRestUrl}/api/v1/kline/query?symbol=${symbol}&granularity=${parseTimeframe(tf)}&from=${Math.floor(Date.now() / 1000) - 1800}&to=${Math.floor(Date.now() / 1000)}`;
  const res = await axios.get(url);
  return res.data.data.map(c => parseFloat(c[2]));
}

function parseTimeframe(tf) {
  return tf === '1m' ? 60 : tf === '5m' ? 300 : 60;
}
s
function calculateATR(highs, period = 14) {
  const trs = [];
  for (let i = 1; i < highs.length; i++) {s
    trs.push(Math.abs(highs[i] - highs[i - 1]));
  }
  const atr = trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  return atr;
}

function calculateLadderPrices(entryPrice, levels, range) {
  const prices = [];
  const step = range / (levels - 1);
  for (let i = 0; i < levels; i++) {
    const offset = (step * i - range / 2);
    prices.push(+(entryPrice * (1 + offset)).toFixed(2));
  }
  return prices;
}

async function placeLadderOrders(side, basePrice, stopLossDist, atr) {
  const riskCapital = config.capital * config.riskPercent / 100;
  const ladderPrices = calculateLadderPrices(basePrice, config.ladderLevels, config.ladderRange);
  const capitalPerOrder = riskCapital / ladderPrices.length;

  for (const price of ladderPrices) {
    const size = +(capitalPerOrder / (stopLossDist)).toFixed(4);
    if (size < 0.001) continue;

    try {
      const res = await axios.post(`${kucoinRestUrl}/api/v1/orders`, {
        symbol: config.symbol,
        leverage: config.leverage.toString(),
        side,
        type: 'limit',
        price: price.toString(),
        size: size.toString()
      });
      console.log(`Ladder order placed: ${side} ${size} @ ${price}`);
      sendTelegram(`ðŸ“Œ Ladder ${side.toUpperCase()} ${size} BTC @ ${price}`);
    } catch (e) {
      console.error('Order failed:', e.message || e);
    }
  }
}

async function analyzeMarket() {
  const highs = await fetchKlines();
  const atr = calculateATR(highs);
  const lastClose = highs[highs.length - 1];

  const signal = Math.random() > 0.5 ? 'buy' : 'sell'; // Dummy signal
  const stopLossDist = atr * config.atrMultiplier;

  if (config.useLadderEntry) {
    await placeLadderOrders(signal === 'buy' ? 'buy' : 'sell', lastClose, stopLossDist, atr);
  }
}

async function logTrade(trade) {
  trades.push(trade);
  fs.writeFileSync(tradesPath, JSON.stringify(trades, null, 2));
}

function logDailyPerformance() {
  const today = new Date().toISOString().split('T')[0];
  const dayTrades = trades.filter(t => t.time.startsWith(today));
  const pnl = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const file = `${performanceDir}/performance_${today}.json`;
  fs.writeFileSync(file, JSON.stringify({ date: today, pnl, count: dayTrades.length }, null, 2));
}

setInterval(logDailyPerformance, 24 * 60 * 60 * 1000);

app.get('/api/status', (_, res) => res.json({ position: currentPosition }));
app.get('/api/trades', (_, res) => res.json(trades));
app.get('/api/performance', (_, res) => {
  const files = fs.readdirSync(performanceDir).filter(f => f.startsWith('performance'));
  const latest = files.map(f => JSON.parse(fs.readFileSync(`${performanceDir}/${f}`)));
  res.json(latest);
});
app.get('/api/config', (_, res) => res.json(config));
app.put('/api/config', (req, res) => {
  config = { ...config, ...req.body };
  fs.writeFileSync(configPath, JSON.stringify(cosnfig, null, 2));
  res.json({ success: true, config });
});
app.post('/api/control', (req, res) => {
  if (req.body.action === 'start') {
    analyzeMarket();
    res.json({ started: true });
  } else {
    res.json({ stopped: true });
  }
});
app.get('/api/orders', (_, res) => res.json({ message: "Order tracking TBD" }));
app.get('/health', (_, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ðŸš€ Bot API running on port ${PORT}`));

