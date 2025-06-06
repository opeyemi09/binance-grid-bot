
"use client"

import { useState, useEffect } from "react"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Badge, Tabs, TabsContent, TabsList, TabsTrigger, Progress, Input
} from "@/components/ui"
import {
  Activity, TrendingUp, TrendingDown, DollarSign, BarChart3, Play, Square, RotateCcw, AlertTriangle,
  CheckCircle, Wifi, WifiOff, RefreshCw, Edit, Plus, Trash2
} from "lucide-react"
import { toast } from "sonner"

const API_BASE_URL = "http://localhost:3001"

type SymbolConfig = {
  CAPITAL: number
  RISK_PERCENT: number
  LEVERAGE: number
  GRID_STEPS: number
  GRID_SPACING: number
  FEE_PERCENT: number
  TIMEFRAME: string
  TP1: number
  TP2: number
  TRAIL_START: number
  TRAIL_OFFSET: number
}

type BotStatus = {
  isRunning: boolean
  currentPrice: number
  uptime: number
  demoMode?: boolean
  openTrade?: any
}

type SymbolState = {
  status: BotStatus
  trades: any[]
  performance: any
  priceHistory: number[]
  config: SymbolConfig
}

export default function MultiSymbolTradingBotDashboard() {
  const [symbols, setSymbols] = useState<string[]>([])
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null)
  const [symbolStates, setSymbolStates] = useState<Record<string, SymbolState>>({})
  const [symbolConfigs, setSymbolConfigs] = useState<Record<string, SymbolConfig>>({})
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null)
  const [editConfig, setEditConfig] = useState<Partial<SymbolConfig>>({})
  const [configSaving, setConfigSaving] = useState(false)
  const [addSymbolName, setAddSymbolName] = useState("")
  const [addingSymbol, setAddingSymbol] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{ isConnected: boolean, lastAttempt: Date }>({
    isConnected: false, lastAttempt: new Date()
  })

  // Fetch all symbol states and configs
  const fetchStatus = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/status`)
      if (!resp.ok) throw new Error("status error")
      const data: Record<string, SymbolState> = await resp.json()
      setSymbolStates(data)
      setSymbols(Object.keys(data))
      setSymbolConfigs(Object.fromEntries(Object.entries(data).map(([sym, s]) => [sym, s.config])))
      setConnectionStatus({ isConnected: true, lastAttempt: new Date() })
      if (!activeSymbol && Object.keys(data).length > 0)
        setActiveSymbol(Object.keys(data)[0])
    } catch {
      setConnectionStatus({ isConnected: false, lastAttempt: new Date() })
    }
  }

  // Edit symbol config
  const handleEditConfig = (key: keyof SymbolConfig, value: any) => {
    setEditConfig(prev => ({ ...prev, [key]: value }))
  }
  const startEditSymbol = (sym: string) => {
    setEditingSymbol(sym)
    setEditConfig(symbolConfigs[sym])
  }
  const saveEditConfig = async () => {
    if (!editingSymbol) return
    setConfigSaving(true)
    try {
      const resp = await fetch(`${API_BASE_URL}/api/config/symbol/${editingSymbol}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editConfig)
      })
      if (!resp.ok) throw new Error("save error")
      toast.success("Config saved")
      setEditingSymbol(null)
      await fetchStatus()
    } catch {
      toast.error("Failed to save config")
    }
    setConfigSaving(false)
  }
  // Add symbol
  const handleAddSymbol = async () => {
    if (!addSymbolName.trim()) return
    setAddingSymbol(true)
    try {
      const resp = await fetch(`${API_BASE_URL}/api/config/symbol`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: addSymbolName.trim().toUpperCase(),
          config: {
            ...symbolConfigs[activeSymbol!],
            // Use the currently selected symbol's config as a base
          }
        })
      })
      if (!resp.ok) throw new Error("add error")
      setAddSymbolName("")
      toast.success("Symbol added")
      await fetchStatus()
    } catch {
      toast.error("Failed to add symbol")
    }
    setAddingSymbol(false)
  }
  // Remove symbol
  const handleRemoveSymbol = async (sym: string) => {
    if (!window.confirm(`Remove ${sym}?`)) return
    try {
      const resp = await fetch(`${API_BASE_URL}/api/config/symbol/${sym}`, {
        method: "DELETE"
      })
      if (!resp.ok) throw new Error("delete error")
      toast.success("Symbol removed")
      await fetchStatus()
    } catch {
      toast.error("Failed to remove symbol")
    }
  }

  // Control commands (for currently active symbol)
  const sendControlCommand = async (action: string) => {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, symbol: activeSymbol })
      })
      if (!resp.ok) throw new Error("control error")
      toast.success("Command sent")
      await fetchStatus()
    } catch {
      toast.error("Failed to send control command")
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  // Rendering logic
  const status = activeSymbol ? symbolStates[activeSymbol]?.status : undefined
  const trades = activeSymbol ? symbolStates[activeSymbol]?.trades : []
  const performance = activeSymbol ? symbolStates[activeSymbol]?.performance : {}
  const priceHistory = activeSymbol ? symbolStates[activeSymbol]?.priceHistory : []

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Symbol Nav and Add */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-lg mr-2">Symbols:</span>
            {symbols.map(sym => (
              <Button key={sym} size={activeSymbol === sym ? "default" : "sm"}
                variant={activeSymbol === sym ? "default" : "outline"}
                onClick={() => setActiveSymbol(sym)}
                className="mr-1"
              >
                {sym}
                <Edit className="ml-1 h-3 w-3" onClick={e => { e.stopPropagation(); startEditSymbol(sym) }} />
                <Trash2 className="ml-1 h-3 w-3 text-red-500" onClick={e => { e.stopPropagation(); handleRemoveSymbol(sym) }} />
              </Button>
            ))}
            <Input
              value={addSymbolName}
              onChange={e => setAddSymbolName(e.target.value)}
              placeholder="Add symbol"
              className="w-28 inline-block ml-2"
              disabled={addingSymbol}
              onKeyDown={e => { if (e.key === "Enter") handleAddSymbol() }}
            />
            <Button variant="outline" size="icon" onClick={handleAddSymbol} disabled={addingSymbol || !addSymbolName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 items-center">
            {connectionStatus.isConnected ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Wifi className="h-3 w-3 mr-1" /> API Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                <WifiOff className="h-3 w-3 mr-1" /> API Disconnected
              </Badge>
            )}
            <Button onClick={fetchStatus} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        {/* Status Cards */}
        {status && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
                {status.isRunning
                  ? <CheckCircle className="h-4 w-4 text-green-600" />
                  : <AlertTriangle className="h-4 w-4 text-red-600" />}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{status.isRunning ? "Running" : "Stopped"}</div>
                <p className="text-xs text-muted-foreground">Uptime: {Math.floor((status.uptime || 0) / 60000)} min</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Price</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{status.currentPrice?.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Trade</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xs">{status.openTrade ? (
                  <>
                    {status.openTrade.side.toUpperCase()} @ {status.openTrade.entryPx}
                  </>
                ) : "None"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Demo Mode</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">{status.demoMode ? "Yes" : "No"}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 mt-2">
          <Button onClick={() => sendControlCommand("start")} disabled={!activeSymbol || status?.isRunning}>
            <Play className="h-4 w-4 mr-2" /> Start
          </Button>
          <Button onClick={() => sendControlCommand("stop")} variant="destructive" disabled={!activeSymbol || !status?.isRunning}>
            <Square className="h-4 w-4 mr-2" /> Stop
          </Button>
          <Button onClick={() => sendControlCommand("rebalance")} disabled={!activeSymbol}>
            <RotateCcw className="h-4 w-4 mr-2" /> Rebalance
          </Button>
        </div>

        {/* Main Tabs */}
        <Tabs value="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trades">Trades</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="settings">Symbol Config</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Price History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-32 flex items-center justify-center bg-gray-100 rounded">
                  {priceHistory.length
                    ? <span>{priceHistory.map((p, i) => i % 10 === 0 ? p.toFixed(2) + " | " : "").join("")}</span>
                    : <span className="text-gray-400">No data</span>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trades */}
          <TabsContent value="trades" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Trades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {trades && trades.length ? trades.slice(-20).reverse().map((t, i) => (
                    <div className="flex justify-between text-xs" key={i}>
                      <span>{new Date(t.openTime || t.timestamp).toLocaleString()}</span>
                      <span>{t.side?.toUpperCase()}</span>
                      <span>@ {t.entryPx?.toFixed(2) || t.price?.toFixed(2)}</span>
                      <span>Size: {t.size || t.quantity}</span>
                      <span>PNL: {t.pnl !== undefined ? t.pnl.toFixed(2) : "-"}</span>
                    </div>
                  )) : <span className="text-gray-400">No trades</span>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs">{JSON.stringify(performance, null, 2)}</pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Symbol Config */}
          <TabsContent value="settings" className="space-y-4">
            {editingSymbol && (
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); saveEditConfig(); }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Edit Config: {editingSymbol}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.keys(editConfig || {}).map((key) => (
                        <div key={key}>
                          <label className="block text-xs mb-1">{key}</label>
                          <Input
                            value={editConfig[key as keyof SymbolConfig] ?? ""}
                            type={typeof editConfig[key as keyof SymbolConfig] === "number" ? "number" : "text"}
                            onChange={e => handleEditConfig(key as keyof SymbolConfig, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button type="submit" disabled={configSaving}>{configSaving ? "Saving..." : "Save"}</Button>
                      <Button type="button" variant="outline" onClick={() => setEditingSymbol(null)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            )}
            {!editingSymbol && activeSymbol && (
              <Card>
                <CardHeader>
                  <CardTitle>Symbol Config: {activeSymbol}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(symbolConfigs[activeSymbol] || {}).map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-xs mb-1">{key}</label>
                        <span className="font-mono">{value?.toString()}</span>
                      </div>
                    ))}
                  </div>
                  <Button className="mt-4" onClick={() => startEditSymbol(activeSymbol)}>Edit</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
