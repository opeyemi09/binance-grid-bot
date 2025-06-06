"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Play,
  Square,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner" // You can replace with your preferred notification lib

const API_BASE_URL = "http://localhost:3001"

interface BotData {
  status: {
    isRunning: boolean
    currentPrice: number
    marketCondition: string
    volatilityIndex: number
    atr: number
    uptime: number
    demoMode?: boolean
  }
  trading: {
    profitLoss: number
    totalTrades: number
    successfulTrades: number
    dailyTrades: number
    maxDailyTrades: number
    activeOrders: number
    gridLevels: number
  }
  performance: {
    totalProfit: number
    totalLoss: number
    winRate: number
    totalVolume: number
    avgTradeSize: number
    bestTrade: number
    worstTrade: number
    profitFactor: number
  }
  grid: {
    levels: Array<{
      level: number
      buyPrice: number
      sellPrice: number
      quantity: number
      active: boolean
      status?: string
      distanceFromPrice?: number
    }>
    spacing: number
    investment: number
  }
  priceHistory: number[]
}

interface Trade {
  id: string
  type: string
  side?: string
  symbol: string
  price: number
  quantity: number
  profit?: number
  timestamp: number
  marketCondition: string
}

interface ConnectionStatus {
  isConnected: boolean
  lastAttempt: Date
  errorMessage: string | null
  retryCount: number
}

export default function TradingBotDashboard() {
    const [liveOrders, setLiveOrders] = useState<any[]>([])
  const [liveOrdersLoading, setLiveOrdersLoading] = useState(false)
  const [liveOrdersError, setLiveOrdersError] = useState<string | null>(null)

  const [balances, setBalances] = useState<any[]>([])
  const [botData, setBotData] = useState<BotData | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastAttempt: new Date(),
    errorMessage: null,
    retryCount: 0,
  })
  const [gridData, setGridData] = useState<any>(null)
  const [performanceData, setPerformanceData] = useState<any>(null)
  const [marketData, setMarketData] = useState<any>(null)

  // Settings/config state
  const [configValues, setConfigValues] = useState<any>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [settingsTabLoaded, setSettingsTabLoaded] = useState(false)

  const fetchBalance = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/balance`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch balance");
      }
      const data = await response.json();
      setBalances(data.balances || []);
    } catch (error) {
      setBalances([]);
      // console.error("Failed to fetch balance:", error);
    }
  };

  const fetchConfig = async () => {
    setConfigLoading(true)
    setConfigError(null)
    try {
      const resp = await fetch(`${API_BASE_URL}/api/config`)
      if (!resp.ok) throw new Error("Failed to fetch config")
      const data = await resp.json()
      setConfigValues({
        SYMBOL: data.SYMBOL ?? data.symbol ?? "BTCUSDT",
        BASE_INVESTMENT: data.BASE_INVESTMENT ?? data.baseInvestment ?? 10,
        GRID_LEVELS: data.GRID_LEVELS ?? data.gridLevels ?? 15,
        MIN_GRID_SPACING: data.MIN_GRID_SPACING ?? data.minGridSpacing ?? 0.003,
        MAX_GRID_SPACING: data.MAX_GRID_SPACING ?? data.maxGridSpacing ?? 0.025,
        ATR_PERIOD: data.ATR_PERIOD ?? data.atrPeriod ?? 14,
        ATR_MULTIPLIER: data.ATR_MULTIPLIER ?? data.atrMultiplier ?? 1.5,
        REBALANCE_THRESHOLD: data.REBALANCE_THRESHOLD ?? data.rebalanceThreshold ?? 0.08,
        DCA_PERCENTAGE: data.DCA_PERCENTAGE ?? data.dcaPercentage ?? 0.015,
        MAX_POSITION_SIZE: data.MAX_POSITION_SIZE ?? data.maxPositionSize ?? 0.08,
        STOP_LOSS_PERCENTAGE: data.STOP_LOSS_PERCENTAGE ?? data.stopLossPercentage ?? 0.04,
        TAKE_PROFIT_PERCENTAGE: data.TAKE_PROFIT_PERCENTAGE ?? data.takeProfitPercentage ?? 0.025,
        MAX_DAILY_TRADES: data.MAX_DAILY_TRADES ?? data.maxDailyTrades ?? 4550,
        VOLATILITY_THRESHOLD: data.VOLATILITY_THRESHOLD ?? data.volatilityThreshold ?? 0.02,
      })
    } catch (e) {
      setConfigError("Failed to load config")
    }
    setConfigLoading(false)
  }

  const handleConfigChange = (key: string, value: any) => {
    setConfigValues((prev: any) => ({
      ...prev,
      [key]: value,
    }))
  }

  const saveConfig = async () => {
    setConfigSaving(true)
    setConfigError(null)
    try {
      const updates = {
        SYMBOL: configValues.SYMBOL,
        BASE_INVESTMENT: Number(configValues.BASE_INVESTMENT),
        GRID_LEVELS: Number(configValues.GRID_LEVELS),
        MIN_GRID_SPACING: Number(configValues.MIN_GRID_SPACING),
        MAX_GRID_SPACING: Number(configValues.MAX_GRID_SPACING),
        ATR_PERIOD: Number(configValues.ATR_PERIOD),
        ATR_MULTIPLIER: Number(configValues.ATR_MULTIPLIER),
        REBALANCE_THRESHOLD: Number(configValues.REBALANCE_THRESHOLD),
        DCA_PERCENTAGE: Number(configValues.DCA_PERCENTAGE),
        MAX_POSITION_SIZE: Number(configValues.MAX_POSITION_SIZE),
        STOP_LOSS_PERCENTAGE: Number(configValues.STOP_LOSS_PERCENTAGE),
        TAKE_PROFIT_PERCENTAGE: Number(configValues.TAKE_PROFIT_PERCENTAGE),
        MAX_DAILY_TRADES: Number(configValues.MAX_DAILY_TRADES),
        VOLATILITY_THRESHOLD: Number(configValues.VOLATILITY_THRESHOLD),
      }
      const resp = await fetch(`${API_BASE_URL}/api/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!resp.ok) throw new Error("Failed to save config")
      toast.success("Configuration updated!")
      fetchConfig()
      fetchData()
    } catch (e) {
      setConfigError("Failed to save config")
      toast.error("Failed to update configuration!")
    }
    setConfigSaving(false)
  }

  const fetchData = async () => {
    try {
      setConnectionStatus((prev) => ({
        ...prev,
        lastAttempt: new Date(),
        retryCount: prev.retryCount + 1,
      }))

      const [statusResponse, tradesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/status`, {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`${API_BASE_URL}/api/trades?limit=50`, {
          signal: AbortSignal.timeout(5000),
        }),
      ])

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text().catch(() => "Unknown error")
        throw new Error(`Status API returned ${statusResponse.status}: ${errorText}`)
      }

      if (!tradesResponse.ok) {
        const errorText = await tradesResponse.text().catch(() => "Unknown error")
        throw new Error(`Trades API returned ${tradesResponse.status}: ${errorText}`)
      }

      const statusData = await statusResponse.json()
      const tradesData = await tradesResponse.json()

      const transformedData = {
        status: {
          isRunning: statusData.bot?.isRunning || statusData.status?.isRunning || false,
          currentPrice: statusData.trading?.currentPrice || statusData.status?.currentPrice || 0,
          marketCondition: statusData.market?.condition || statusData.status?.marketCondition || "UNKNOWN",
          volatilityIndex: statusData.market?.volatilityIndex || statusData.status?.volatilityIndex || 0,
          atr: statusData.market?.atr || statusData.status?.atr || 0,
          uptime: statusData.bot?.uptime || statusData.status?.uptime || 0,
          demoMode: statusData.bot?.demoMode || statusData.status?.demoMode || false,
        },
        trading: {
          profitLoss: statusData.trading?.profitLoss || 0,
          totalTrades: statusData.trading?.totalTrades || 0,
          successfulTrades: statusData.trading?.successfulTrades || 0,
          dailyTrades: statusData.trading?.dailyTrades || 0,
          maxDailyTrades: statusData.trading?.maxDailyTrades || 50,
          activeOrders: statusData.trading?.activeOrders || 0,
          gridLevels: statusData.trading?.gridLevels || 0,
        },
        performance: statusData.performance || {
          totalProfit: 0,
          totalLoss: 0,
          winRate: 0,
          totalVolume: 0,
          avgTradeSize: 0,
          bestTrade: 0,
          worstTrade: 0,
          profitFactor: 0,
        },
        grid: {
          levels: statusData.grid?.levels || [],
          spacing: statusData.grid?.spacing || 0.008,
          investment: statusData.grid?.investment || 1000,
        },
        priceHistory: statusData.market?.price?.history || statusData.priceHistory || [],
      }

      setBotData(transformedData)
      setTrades(Array.isArray(tradesData) ? tradesData : tradesData.trades || [])

      setConnectionStatus({
        isConnected: true,
        lastAttempt: new Date(),
        errorMessage: null,
        retryCount: 0,
      })

      fetchGridData()
      fetchPerformanceData()
      fetchMarketData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error connecting to API"
      setConnectionStatus((prev) => ({
        isConnected: false,
        lastAttempt: new Date(),
        errorMessage: errorMessage,
        retryCount: prev.retryCount,
      }))
    } finally {
      setLoading(false)
    }
  }

  const sendControlCommand = async (action: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        throw new Error(`Control command failed: ${response.status} - ${errorText}`)
      }
      const result = await response.json()
      if (result.success) {
        setTimeout(fetchData, 1000)
      } else {
        throw new Error(result.message || "Control command failed")
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Control command failed"
      setConnectionStatus((prev) => ({
        ...prev,
        errorMessage: errorMessage,
      }))
    }
  }

  const fetchGridData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/grid`, {
        signal: AbortSignal.timeout(5000),
      }).catch((error) => {
        return null
      })
      if (!response?.ok) {
        return
      }
      const data = await response.json()
      setGridData(data)
      setBotData((prev) =>
        prev
          ? {
              ...prev,
              grid: {
                levels: data.levels || [],
                spacing: data.configuration?.currentSpacing || prev.grid.spacing,
                investment: data.configuration?.baseInvestment || prev.grid.investment,
              },
            }
          : null,
      )
    } catch (error) {}
  }

  const fetchPerformanceData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/performance`, {
        signal: AbortSignal.timeout(5000),
      }).catch((error) => {
        return null
      })
      if (!response?.ok) {
        return
      }
      const data = await response.json()
      setPerformanceData(data)
      setBotData((prev) =>
        prev
          ? {
              ...prev,
              performance: {
                ...prev.performance,
                ...data,
              },
            }
          : null,
      )
    } catch (error) {}
  }

  const fetchMarketData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/market`, {
        signal: AbortSignal.timeout(5000),
      }).catch((error) => {
        return null
      })
      if (!response?.ok) {
        return
      }
      const data = await response.json()
      setMarketData(data)
      setBotData((prev) =>
        prev
          ? {
              ...prev,
              status: {
                ...prev.status,
                currentPrice: data.price?.current || prev.status.currentPrice,
                marketCondition: data.technical?.marketCondition || prev.status.marketCondition,
                volatilityIndex: data.technical?.volatilityIndex || prev.status.volatilityIndex,
                atr: data.technical?.atr || prev.status.atr,
              },
              priceHistory: data.price?.history || prev.priceHistory,
            }
          : null,
      )
    } catch (error) {}
  }

  useEffect(() => {
    fetchData()
    fetchBalance()
    const interval = setInterval(() => {
      if (connectionStatus.isConnected) {
        fetchData()
      } else {
        const backoffTime = Math.min(30000, 1000 * Math.pow(2, Math.min(connectionStatus.retryCount, 5)))
        const timeSinceLastAttempt = new Date().getTime() - connectionStatus.lastAttempt.getTime()
        if (timeSinceLastAttempt >= backoffTime) {
          fetchData()
        }
      }
    }, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line
  }, [connectionStatus.isConnected, connectionStatus.retryCount, connectionStatus.lastAttempt])

  // NEW: Fetch live Bybit spot orders from the backend
  const fetchLiveOrders = async () => {
    setLiveOrdersLoading(true)
    setLiveOrdersError(null)
    try {
      const resp = await fetch(`${API_BASE_URL}/api/live-orders`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setLiveOrders(data.orders || [])
    } catch (e: any) {
      setLiveOrdersError("Failed to fetch live orders.")
      setLiveOrders([])
    }
    setLiveOrdersLoading(false)
  }

  // Fetch on mount and every 5s if connected
  useEffect(() => {
    fetchLiveOrders()
    const interval = setInterval(() => {
      if (connectionStatus.isConnected) {
        fetchLiveOrders()
      }
    }, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line
  }, [connectionStatus.isConnected])

  // Helper: is this grid level active on Bybit?
  const isGridLevelActiveOnBybit = (level: any) => {
    // Match buyPrice (or sellPrice if you want), quantity, and "Buy"/"Sell"
    return liveOrders.some(order =>
      (Math.abs(Number(order.price) - Number(level.buyPrice)) < 0.0001 ||
        Math.abs(Number(order.price) - Number(level.sellPrice)) < 0.0001) &&
      Math.abs(Number(order.qty) - Number(level.quantity)) < 0.0001
    )
  }




  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    return `${minutes}m ${seconds % 60}s`
  }

  const getMarketConditionColor = (condition: string) => {
    switch (condition) {
      case "BULL":
        return "bg-green-500"
      case "BEAR":
        return "bg-red-500"
      case "VOLATILE":
        return "bg-orange-500"
      case "SIDEWAYS":
        return "bg-blue-500"
      default:
        return "bg-gray-500"
    }
  }

  // Settings tab lazy loader
  const handleSettingsTab = () => {
    if (!settingsTabLoaded) {
      fetchConfig()
      setSettingsTabLoaded(true)
    }
  }

  // UI render
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="mb-2">Connecting to trading bot API...</p>
              <p className="text-xs text-gray-500">
                Using API: {API_BASE_URL}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bybit Grid Trading Bot</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-gray-600">Real-time monitoring and control dashboard</p>
              {botData?.status?.demoMode && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Bot Running in Demo Mode
                </Badge>
              )}
              {connectionStatus.isConnected ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Wifi className="h-3 w-3 mr-1" /> API Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <WifiOff className="h-3 w-3 mr-1" /> API Disconnected
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
            <Button
              onClick={() => sendControlCommand("rebalance")}
              variant="outline"
              size="sm"
              disabled={!connectionStatus.isConnected}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Rebalance
            </Button>
            {botData?.status?.isRunning ? (
              <Button
                onClick={() => sendControlCommand("stop")}
                variant="destructive"
                size="sm"
                disabled={!connectionStatus.isConnected}
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Bot
              </Button>
            ) : (
              <Button
                onClick={() => sendControlCommand("start")}
                variant="default"
                size="sm"
                disabled={!connectionStatus.isConnected}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Bot
              </Button>
            )}
          </div>
        </div>

        {/* Connection Status */}
        {!connectionStatus.isConnected && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex flex-col gap-2 text-red-700">
                <div className="flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <span className="font-medium">API Connection Error</span>
                </div>
                <p className="text-sm">Unable to connect to the trading bot API.</p>
                <p className="text-sm">Error: {connectionStatus.errorMessage || "Unknown error"}</p>
                <p className="text-sm">Last attempt: {connectionStatus.lastAttempt.toLocaleTimeString()}</p>
                <p className="text-sm">Retry count: {connectionStatus.retryCount}</p>
                <div className="flex justify-end mt-2">
                  <Button onClick={fetchData} variant="outline" size="sm" className="bg-white">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Connection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
              {botData?.status?.isRunning ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{botData?.status?.isRunning ? "Running" : "Stopped"}</div>
              <p className="text-xs text-muted-foreground">Uptime: {formatUptime(botData?.status?.uptime || 0)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Price</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(botData?.status?.currentPrice || 0)}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getMarketConditionColor(botData?.status?.marketCondition || "UNKNOWN")}>
                  {botData?.status?.marketCondition || "UNKNOWN"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">P&L</CardTitle>
              {(botData?.trading?.profitLoss || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${(botData?.trading?.profitLoss || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {formatCurrency(botData?.trading?.profitLoss || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Win Rate: {(botData?.performance?.winRate || 0).toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{botData?.trading?.activeOrders || 0}</div>
              <p className="text-xs text-muted-foreground">Grid Levels: {botData?.trading?.gridLevels || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Spot Account Balances */}
        <Card>
          <CardHeader>
            <CardTitle>Spot Account Balance</CardTitle>
            <CardDescription>Available assets on Bybit Spot</CardDescription>
          </CardHeader>
          <CardContent>
            {balances.length === 0 ? (
              <div className="text-gray-500">No balances found.</div>
            ) : (
              <div className="space-y-1">
                {balances.map((asset: any) => (
                  <div key={asset.coin || asset.asset}>
                    <span className="font-semibold">{asset.coin || asset.asset}:</span>{" "}
                    <span>
                      {(asset.availableBalance || asset.free || asset.total || "0")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4" onValueChange={v => { if (v==="settings") handleSettingsTab() }}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="grid">Grid Status</TabsTrigger>
            <TabsTrigger value="market">Market Data</TabsTrigger>
            <TabsTrigger value="trades">Trade History</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="liveorders">Live Bybit Orders</TabsTrigger>
       
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Trading Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Trading Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Trades:</span>
                    <span className="font-semibold">{botData?.trading?.totalTrades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Successful Trades:</span>
                    <span className="font-semibold text-green-600">{botData?.trading?.successfulTrades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Daily Trades:</span>
                    <span className="font-semibold">
                      {botData?.trading?.dailyTrades}/{botData?.trading?.maxDailyTrades}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Daily Limit Usage</span>
                      <span>
                        {((botData?.trading?.dailyTrades / botData?.trading?.maxDailyTrades) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={(botData?.trading?.dailyTrades / botData?.trading?.maxDailyTrades) * 100}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Market Data */}
              <Card>
                <CardHeader>
                  <CardTitle>Market Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>ATR:</span>
                    <span className="font-semibold">{botData?.status?.atr?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Volatility Index:</span>
                    <span className="font-semibold">{(botData?.status?.volatilityIndex * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Grid Spacing:</span>
                    <span className="font-semibold">{(botData?.grid?.spacing * 100).toFixed(3)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Investment:</span>
                    <span className="font-semibold">{formatCurrency(botData?.grid?.investment)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Price Chart Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>Price History</CardTitle>
                <CardDescription>Recent price movements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-gray-100 rounded">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Price chart visualization</p>
                    <p className="text-sm text-gray-400">
                      Latest: {formatCurrency(botData?.priceHistory[botData?.priceHistory?.length - 1] || 0)}
                    </p>
                    {botData?.priceHistory?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Range: {formatCurrency(Math.min(...(botData?.priceHistory || [0])))} -{" "}
                        {formatCurrency(Math.max(...(botData?.priceHistory || [0])))}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
{/* Enhanced Grid Tab: Show match with live Bybit orders */}
          <TabsContent value="grid" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Grid of Configuration</CardTitle>
                <CardDescription>Current grid levels and live Bybit orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* ... summary unchanged ... */}

                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <div className="grid grid-cols-7 gap-4 text-sm font-medium text-gray-700">
                        <span>Level</span>
                        <span>Buy Price</span>
                        <span>Sell Price</span>
                        <span>Quantity</span>
                        <span>Distance</span>
                        <span>Status</span>
                        <span>Live Bybit</span>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {(gridData?.levels || botData?.grid?.levels || []).length > 0 ? (
                        (gridData?.levels || botData?.grid?.levels || []).slice(0, 15).map((level: any, index: number) => (
                          <div key={index} className="px-4 py-2 border-b last:border-b-0">
                            <div className="grid grid-cols-7 gap-4 text-sm">
                              <span className="font-medium">{level.level}</span>
                              <span>{formatCurrency(level.buyPrice)}</span>
                              <span>{formatCurrency(level.sellPrice)}</span>
                              <span>{level.quantity.toFixed(6)}</span>
                              <span className={level.distanceFromPrice > 0 ? "text-green-600" : "text-red-600"}>
                                {level.distanceFromPrice?.toFixed(2) || "0.00"}%
                              </span>
                              <span>
                                <Badge
                                  variant={level.status === "active" || level.active ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {level.status === "active" || level.active ? "Active" : "Inactive"}
                                </Badge>
                              </span>
                              <span>
                                {isGridLevelActiveOnBybit(level) ? (
                                  <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">
                                    Live
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    None
                                  </Badge>
                                )}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-gray-500">No grid levels available</div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* New Tab: Live Bybit Orders */}
          <TabsContent value="liveorders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Live Active Orders on Bybit Spot</CardTitle>
                <CardDescription>These are the currently open spot orders on your Bybit account.</CardDescription>
              </CardHeader>
              <CardContent>
                {liveOrdersLoading ? (
                  <div className="text-gray-500">Loading live Bybit orders...</div>
                ) : liveOrdersError ? (
                  <div className="text-red-600">{liveOrdersError}</div>
                ) : liveOrders.length === 0 ? (
                  <div className="text-gray-500">No live spot orders found.</div>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <div className="grid grid-cols-6 gap-4 text-sm font-medium text-gray-700">
                        <span>Order ID</span>
                        <span>Side</span>
                        <span>Price</span>
                        <span>Quantity</span>
                        <span>Status</span>
                        <span>Time</span>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {liveOrders.map((order: any) => (
                        <div key={order.orderId || order.order_id} className="px-4 py-2 border-b last:border-b-0">
                          <div className="grid grid-cols-6 gap-4 text-sm">
                            <span className="font-mono">{order.orderId || order.order_id}</span>
                            <span>
                              <Badge variant={order.side === "Buy" ? "default" : "secondary"} className="text-xs">
                                {order.side}
                              </Badge>
                            </span>
                            <span>{formatCurrency(Number(order.price))}</span>
                            <span>{Number(order.qty).toFixed(6)}</span>
                            <span>
                              <Badge className="text-xs">{order.orderStatus || order.status}</Badge>
                            </span>
                            <span>
                              {order.createdTime
                                ? new Date(Number(order.createdTime)).toLocaleString()
                                : "-"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* Grid */}
          <TabsContent value="grid" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Grid Configuration</CardTitle>
                <CardDescription>Current grid levels and order placement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Levels:</span>
                      <div className="font-semibold">
                        {gridData?.statistics?.totalLevels || botData?.grid?.levels?.length || 0}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Active Levels:</span>
                      <div className="font-semibold">
                        {gridData?.statistics?.activeLevels || botData?.trading?.activeOrders || 0}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Spacing:</span>
                      <div className="font-semibold">
                        {((gridData?.configuration?.currentSpacing || botData?.grid?.spacing || 0) * 100).toFixed(3)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Investment:</span>
                      <div className="font-semibold">
                        {formatCurrency(gridData?.configuration?.baseInvestment || botData?.grid?.investment || 0)}
                      </div>
                    </div>
                  </div>

                  {gridData?.statistics?.priceRange && (
                    <div className="grid grid-cols-3 gap-4 text-sm bg-gray-50 p-3 rounded">
                      <div>
                        <span className="text-muted-foreground">Lower Bound:</span>
                        <div className="font-semibold">{formatCurrency(gridData.statistics.priceRange.lower)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Current Price:</span>
                        <div className="font-semibold">{formatCurrency(gridData.statistics.priceRange.current)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Upper Bound:</span>
                        <div className="font-semibold">{formatCurrency(gridData.statistics.priceRange.upper)}</div>
                      </div>
                    </div>
                  )}

                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <div className="grid grid-cols-6 gap-4 text-sm font-medium text-gray-700">
                        <span>Level</span>
                        <span>Buy Price</span>
                        <span>Sell Price</span>
                        <span>Quantity</span>
                        <span>Distance</span>
                        <span>Status</span>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {(gridData?.levels || botData?.grid?.levels || []).length > 0 ? (
                        (gridData?.levels || botData?.grid?.levels || []).slice(0, 15).map((level: any, index: number) => (
                          <div key={index} className="px-4 py-2 border-b last:border-b-0">
                            <div className="grid grid-cols-6 gap-4 text-sm">
                              <span className="font-medium">{level.level}</span>
                              <span>{formatCurrency(level.buyPrice)}</span>
                              <span>{formatCurrency(level.sellPrice)}</span>
                              <span>{level.quantity.toFixed(6)}</span>
                              <span className={level.distanceFromPrice > 0 ? "text-green-600" : "text-red-600"}>
                                {level.distanceFromPrice?.toFixed(2) || "0.00"}%
                              </span>
                              <span>
                                <Badge
                                  variant={level.status === "active" || level.active ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {level.status === "active" || level.active ? "Active" : "Inactive"}
                                </Badge>
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-gray-500">No grid levels available</div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Market */}
          <TabsContent value="market" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Price Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Price Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Current Price:</span>
                    <span className="font-semibold">
                      {formatCurrency(marketData?.price?.current || botData?.status?.currentPrice || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Previous Price:</span>
                    <span className="font-semibold">{formatCurrency(marketData?.price?.previous || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>24h Change:</span>
                    <span
                      className={`font-semibold ${(marketData?.price?.changePercentage || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {(marketData?.price?.changePercentage || 0).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Support Level:</span>
                    <span className="font-semibold">{formatCurrency(marketData?.technical?.support || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resistance Level:</span>
                    <span className="font-semibold">{formatCurrency(marketData?.technical?.resistance || 0)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Technical Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Technical Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Market Condition:</span>
                    <Badge
                      className={getMarketConditionColor(
                        marketData?.technical?.marketCondition || botData?.status?.marketCondition || "UNKNOWN",
                      )}
                    >
                      {marketData?.technical?.marketCondition || botData?.status?.marketCondition || "UNKNOWN"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Trend:</span>
                    <span className="font-semibold capitalize">{marketData?.technical?.trend || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ATR:</span>
                    <span className="font-semibold">
                      {(marketData?.technical?.atr || botData?.status?.atr || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Volatility Index:</span>
                    <span className="font-semibold">
                      {(
                        (marketData?.technical?.volatilityIndex || botData?.status?.volatilityIndex || 0) * 100
                      ).toFixed(2)}
                      %
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Volume Information */}
            <Card>
              <CardHeader>
                <CardTitle>Volume Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {formatCurrency(marketData?.volume?.totalVolume || botData?.performance?.totalVolume || 0)}
                    </div>
                    <p className="text-sm text-muted-foreground">Total Volume</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {formatCurrency(marketData?.volume?.averageTradeSize || botData?.performance?.avgTradeSize || 0)}
                    </div>
                    <p className="text-sm text-muted-foreground">Average Trade Size</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{formatCurrency(marketData?.volume?.dailyVolume || 0)}</div>
                    <p className="text-sm text-muted-foreground">Daily Volume</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trades */}
          <TabsContent value="trades" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Trades</CardTitle>
                <CardDescription>Latest trading activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trades.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No trades recorded yet</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b">
                        <div className="grid grid-cols-6 gap-4 text-sm font-medium text-gray-700">
                          <span>Time</span>
                          <span>Type</span>
                          <span>Side</span>
                          <span>Price</span>
                          <span>Quantity</span>
                          <span>P&L</span>
                        </div>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {trades.slice(0, 20).map((trade) => (
                          <div key={trade.id} className="px-4 py-2 border-b last:border-b-0">
                            <div className="grid grid-cols-6 gap-4 text-sm">
                              <span className="text-gray-600">{new Date(trade.timestamp).toLocaleTimeString()}</span>
                              <span>
                                <Badge variant="outline" className="text-xs">
                                  {trade.type.replace("_", " ")}
                                </Badge>
                              </span>
                              <span>
                                {trade.side && (
                                  <Badge variant={trade.side === "buy" ? "default" : "secondary"} className="text-xs">
                                    {trade.side.toUpperCase()}
                                  </Badge>
                                )}
                              </span>
                              <span>{formatCurrency(trade.price)}</span>
                              <span>{trade.quantity.toFixed(6)}</span>
                              <span
                                className={
                                  trade.profit !== undefined
                                    ? trade.profit >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                    : "text-gray-500"
                                }
                              >
                                {trade.profit !== undefined ? formatCurrency(trade.profit) : "-"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance */}
          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Profit & Loss</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Profit:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(botData?.performance?.totalProfit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Loss:</span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(botData?.performance?.totalLoss)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net P&L:</span>
                    <span
                      className={`font-semibold ${botData?.trading?.profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {formatCurrency(botData?.trading?.profitLoss)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Trade Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Win Rate:</span>
                    <span className="font-semibold">{botData?.performance?.winRate?.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Best Trade:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(botData?.performance?.bestTrade)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Worst Trade:</span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(botData?.performance?.worstTrade)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Volume & Size</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Volume:</span>
                    <span className="font-semibold">{formatCurrency(botData?.performance?.totalVolume)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Trade Size:</span>
                    <span className="font-semibold">{formatCurrency(botData?.performance?.avgTradeSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit Factor:</span>
                    <span className="font-semibold">{botData?.performance?.profitFactor?.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bot Configuration</CardTitle>
                <CardDescription>Edit and save grid bot configuration</CardDescription>
              </CardHeader>
              <CardContent>
                {configLoading ? (
                  <div className="text-gray-500">Loading config...</div>
                ) : configError ? (
                  <div className="text-red-600">{configError}</div>
                ) : configValues ? (
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault()
                      saveConfig()
                    }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Symbol</label>
                        <Input
                          value={configValues.SYMBOL || ""}
                          onChange={(e) => handleConfigChange("SYMBOL", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Base Investment</label>
                        <Input
                          type="number"
                          step="any"
                          value={configValues.BASE_INVESTMENT || ""}
                          onChange={(e) => handleConfigChange("BASE_INVESTMENT", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Grid Levels</label>
                        <Input
                          type="number"
                          value={configValues.GRID_LEVELS || ""}
                          onChange={(e) => handleConfigChange("GRID_LEVELS", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Min Grid Spacing</label>
                        <Input
                          type="number"
                          step="any"
                          value={configValues.MIN_GRID_SPACING || ""}
                          onChange={(e) => handleConfigChange("MIN_GRID_SPACING", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Max Grid Spacing</label>
                        <Input
                          type="number"
                          step="any"
                          value={configValues.MAX_GRID_SPACING || ""}
                          onChange={(e) => handleConfigChange("MAX_GRID_SPACING", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">ATR Period</label>
                        <Input
                          type="number"
                          value={configValues.ATR_PERIOD || ""}
                          onChange={(e) => handleConfigChange("ATR_PERIOD", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">ATR Multiplier</label>
                        <Input
                          type="number"
                          step="any"
                          value={configValues.ATR_MULTIPLIER || ""}
                          onChange={(e) => handleConfigChange("ATR_MULTIPLIER", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Rebalance Threshold</label>
                        <Input
                          type="number"
                          step="any"
                          value={configValues.REBALANCE_THRESHOLD || ""}
                          onChange={(e) => handleConfigChange("REBALANCE_THRESHOLD", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">DCA Percentage</label>
                        <Input
                          type="number"
                          step="any"
                          value={configValues.DCA_PERCENTAGE || ""}
                          onChange={(e) => handleConfigChange("DCA_PERCENTAGE", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Max Position Size</label>
                        <Input
                          type="number"
                          step="any"
                          value={configValues.MAX_POSITION_SIZE || ""}
                          onChange={(e) => handleConfigChange("MAX_POSITION_SIZE", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Stop Loss %</label>
                        <Input
                          type="number"
                          step="any"
                          value={configValues.STOP_LOSS_PERCENTAGE || ""}
                          onChange={(e) => handleConfigChange("STOP_LOSS_PERCENTAGE", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Take Profit %</label>
                        <Input
                          type="number"
                          step="any"
                          value={configValues.TAKE_PROFIT_PERCENTAGE || ""}
                          onChange={(e) => handleConfigChange("TAKE_PROFIT_PERCENTAGE", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Max Daily Trades</label>
                        <Input
                          type="number"
                          value={configValues.MAX_DAILY_TRADES || ""}
                          onChange={(e) => handleConfigChange("MAX_DAILY_TRADES", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Volatility Threshold</label>
                        <Input
                          type="number"
                          step="any"
                          value={configValues.VOLATILITY_THRESHOLD || ""}
                          onChange={(e) => handleConfigChange("VOLATILITY_THRESHOLD", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button type="submit" disabled={configSaving}>
                        {configSaving ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={fetchConfig}
                        disabled={configSaving}
                      >
                        Reset
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="text-gray-500">No config loaded.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
