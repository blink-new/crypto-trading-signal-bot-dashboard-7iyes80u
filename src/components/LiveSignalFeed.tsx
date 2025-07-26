import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TradingSignal } from './TradingSignal'
import { blink } from '@/blink/client'
import { cryptoApi, type CoinGeckoMarket } from '@/services/cryptoApi'
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Zap,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface LiveSignal {
  id: string
  symbol: string
  signalType: 'BUY' | 'SELL' | 'HOLD'
  strength: 'STRONG' | 'MODERATE' | 'WEAK'
  confidenceScore: number
  currentPrice: number
  targetPrice?: number
  stopLoss?: number
  reasoning: string
  createdAt: string
  isActive: boolean
  performancePercentage: number
  updatedAt: string
}

interface LiveSignalFeedProps {
  user: any
  cryptos: any[]
  onSignalGenerated?: (count: number) => void
}

export function LiveSignalFeed({ user, cryptos, onSignalGenerated }: LiveSignalFeedProps) {
  const [signals, setSignals] = useState<LiveSignal[]>([])
  const [loading, setLoading] = useState(false)
  const [autoGenerating, setAutoGenerating] = useState(false)
  const [lastSignalUpdate, setLastSignalUpdate] = useState<Date>(new Date())
  const [nextSignalGeneration, setNextSignalGeneration] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const [isUpdating, setIsUpdating] = useState(false)
  const [signalStats, setSignalStats] = useState({
    total: 0,
    active: 0,
    profitable: 0,
    avgPerformance: 0
  })

  // Load existing signals from database
  const loadSignals = useCallback(async () => {
    if (!user) return

    try {
      // Load from recent_signals table for better performance
      const recentSignals = await blink.db.recentSignals.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 20
      })

      const transformedSignals: LiveSignal[] = recentSignals.map(signal => ({
        id: signal.id,
        symbol: signal.symbol,
        signalType: signal.signalType as 'BUY' | 'SELL' | 'HOLD',
        strength: signal.strength as 'STRONG' | 'MODERATE' | 'WEAK',
        confidenceScore: signal.confidenceScore,
        currentPrice: signal.currentPrice,
        targetPrice: signal.targetPrice,
        stopLoss: signal.stopLoss,
        reasoning: signal.reasoning,
        createdAt: signal.createdAt,
        isActive: Number(signal.isActive) > 0,
        performancePercentage: signal.performancePercentage || 0,
        updatedAt: signal.updatedAt
      }))

      setSignals(transformedSignals)

      // Calculate stats
      const activeSignals = transformedSignals.filter(s => s.isActive)
      const profitableSignals = transformedSignals.filter(s => s.performancePercentage > 0)
      const avgPerformance = transformedSignals.length > 0 
        ? transformedSignals.reduce((sum, s) => sum + s.performancePercentage, 0) / transformedSignals.length
        : 0

      setSignalStats({
        total: transformedSignals.length,
        active: activeSignals.length,
        profitable: profitableSignals.length,
        avgPerformance
      })

    } catch (error) {
      console.error('Failed to load signals:', error)
    }
  }, [user])

  // Update signal performance based on current prices
  const updateSignalPerformance = useCallback(async () => {
    if (!user || signals.length === 0 || cryptos.length === 0) return

    setIsUpdating(true)
    try {
      for (const signal of signals.filter(s => s.isActive)) {
        const crypto = cryptos.find(c => c.symbol === signal.symbol)
        if (!crypto) continue

        const currentPrice = crypto.currentPrice
        const initialPrice = signal.currentPrice
        
        // Calculate performance percentage
        let performancePercentage = 0
        if (signal.signalType === 'BUY') {
          performancePercentage = ((currentPrice - initialPrice) / initialPrice) * 100
        } else if (signal.signalType === 'SELL') {
          performancePercentage = ((initialPrice - currentPrice) / initialPrice) * 100
        }

        // Check if target or stop loss hit
        let status = 'active'
        let isActive = true
        let shouldNotify = false

        if (signal.targetPrice && signal.signalType === 'BUY' && currentPrice >= signal.targetPrice) {
          status = 'hit_target'
          isActive = false
          shouldNotify = signal.isActive // Only notify if signal was previously active
          if (shouldNotify) {
            toast.success(`🎯 Target hit for ${signal.symbol}! +${performancePercentage.toFixed(2)}%`, {
              duration: 5000,
              description: `${signal.signalType} signal closed successfully`
            })
          }
        } else if (signal.targetPrice && signal.signalType === 'SELL' && currentPrice <= signal.targetPrice) {
          status = 'hit_target'
          isActive = false
          shouldNotify = signal.isActive
          if (shouldNotify) {
            toast.success(`🎯 Target hit for ${signal.symbol}! +${performancePercentage.toFixed(2)}%`, {
              duration: 5000,
              description: `${signal.signalType} signal closed successfully`
            })
          }
        } else if (signal.stopLoss && signal.signalType === 'BUY' && currentPrice <= signal.stopLoss) {
          status = 'hit_stop_loss'
          isActive = false
          shouldNotify = signal.isActive
          if (shouldNotify) {
            toast.error(`🛑 Stop loss hit for ${signal.symbol}! ${performancePercentage.toFixed(2)}%`, {
              duration: 5000,
              description: `${signal.signalType} signal closed with loss`
            })
          }
        } else if (signal.stopLoss && signal.signalType === 'SELL' && currentPrice >= signal.stopLoss) {
          status = 'hit_stop_loss'
          isActive = false
          shouldNotify = signal.isActive
          if (shouldNotify) {
            toast.error(`🛑 Stop loss hit for ${signal.symbol}! ${performancePercentage.toFixed(2)}%`, {
              duration: 5000,
              description: `${signal.signalType} signal closed with loss`
            })
          }
        }

        // Notify for significant price movements on active signals
        if (isActive && Math.abs(performancePercentage) > 5) {
          const lastPerformance = signal.performancePercentage
          if (Math.abs(performancePercentage - lastPerformance) > 2) {
            const direction = performancePercentage > lastPerformance ? '📈' : '📉'
            toast.info(`${direction} ${signal.symbol} ${performancePercentage > 0 ? '+' : ''}${performancePercentage.toFixed(2)}%`, {
              duration: 3000,
              description: `Significant price movement detected`
            })
          }
        }

        // Update signal in database
        await blink.db.recentSignals.update(signal.id, {
          currentPrice,
          performancePercentage,
          isActive,
          updatedAt: new Date().toISOString()
        })

        // Log performance update
        await blink.db.signalUpdates.create({
          id: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: user.id,
          signalId: signal.id,
          priceAtUpdate: currentPrice,
          performanceChange: performancePercentage,
          updateType: status === 'active' ? 'price_update' : status
        })

        // Update local state
        setSignals(prev => prev.map(s => 
          s.id === signal.id 
            ? { ...s, currentPrice, performancePercentage, isActive, updatedAt: new Date().toISOString() }
            : s
        ))
      }

      setLastSignalUpdate(new Date())
    } catch (error) {
      console.error('Failed to update signal performance:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [user, signals, cryptos])

  // Generate new AI-powered signals
  const generateNewSignals = useCallback(async () => {
    if (!user || cryptos.length === 0) return

    setLoading(true)
    try {
      const newSignals: LiveSignal[] = []
      
      // Generate signals for top performing and trending cryptos
      const topCryptos = cryptos
        .sort((a, b) => Math.abs(b.priceChangePercentage24h) - Math.abs(a.priceChangePercentage24h))
        .slice(0, 6)
      
      for (const crypto of topCryptos) {
        // Generate technical analysis signal
        const technicalSignal = cryptoApi.generateTechnicalSignal({
          id: crypto.id,
          symbol: crypto.symbol.toLowerCase(),
          name: crypto.name,
          image: crypto.image || '',
          current_price: crypto.currentPrice,
          market_cap: crypto.marketCap,
          market_cap_rank: 1,
          fully_diluted_valuation: crypto.marketCap,
          total_volume: crypto.volume24h,
          high_24h: crypto.currentPrice * 1.05,
          low_24h: crypto.currentPrice * 0.95,
          price_change_24h: crypto.priceChange24h,
          price_change_percentage_24h: crypto.priceChangePercentage24h,
          market_cap_change_24h: crypto.marketCap * (crypto.priceChangePercentage24h / 100),
          market_cap_change_percentage_24h: crypto.priceChangePercentage24h,
          circulating_supply: crypto.marketCap / crypto.currentPrice,
          total_supply: null,
          max_supply: null,
          ath: crypto.currentPrice * 2,
          ath_change_percentage: -50,
          ath_date: '2021-11-10T14:24:11.849Z',
          atl: crypto.currentPrice * 0.1,
          atl_change_percentage: 900,
          atl_date: '2020-03-13T02:22:55.391Z',
          roi: null,
          last_updated: crypto.lastUpdated
        })

        // Skip HOLD signals for live feed
        if (technicalSignal.signal === 'HOLD') continue

        const targetPrice = technicalSignal.signal === 'BUY' 
          ? crypto.currentPrice * (1 + Math.random() * 0.12 + 0.03)
          : crypto.currentPrice * (1 - Math.random() * 0.12 - 0.03)
          
        const stopLoss = technicalSignal.signal === 'BUY'
          ? crypto.currentPrice * (1 - Math.random() * 0.06 - 0.02)
          : crypto.currentPrice * (1 + Math.random() * 0.06 + 0.02)

        const signalId = `live_signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const now = new Date().toISOString()

        // Save to database
        await blink.db.recentSignals.create({
          id: signalId,
          userId: user.id,
          symbol: crypto.symbol,
          signalType: technicalSignal.signal,
          strength: technicalSignal.strength,
          confidenceScore: technicalSignal.confidence,
          currentPrice: crypto.currentPrice,
          targetPrice,
          stopLoss,
          reasoning: technicalSignal.reasoning,
          isActive: true,
          performancePercentage: 0,
          createdAt: now,
          updatedAt: now
        })

        newSignals.push({
          id: signalId,
          symbol: crypto.symbol,
          signalType: technicalSignal.signal,
          strength: technicalSignal.strength,
          confidenceScore: technicalSignal.confidence,
          currentPrice: crypto.currentPrice,
          targetPrice,
          stopLoss,
          reasoning: technicalSignal.reasoning,
          createdAt: now,
          isActive: true,
          performancePercentage: 0,
          updatedAt: now
        })
      }

      // Add new signals to the beginning of the list
      setSignals(prev => [...newSignals, ...prev].slice(0, 20))
      
      onSignalGenerated?.(newSignals.length)
      toast.success(`🚀 Generated ${newSignals.length} new live signals!`)
      
    } catch (error) {
      console.error('Failed to generate signals:', error)
      toast.error('Failed to generate new signals. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [user, cryptos, onSignalGenerated])

  // Auto-generate signals every 3 minutes for more frequent signal updates
  useEffect(() => {
    if (!autoGenerating || !user) return

    // Set initial next generation time
    const nextTime = new Date(Date.now() + 3 * 60 * 1000)
    setNextSignalGeneration(nextTime)

    const interval = setInterval(async () => {
      console.log('Auto-generating new signals...')
      await generateNewSignals()
      
      // Update next generation time
      const newNextTime = new Date(Date.now() + 3 * 60 * 1000)
      setNextSignalGeneration(newNextTime)
    }, 3 * 60 * 1000) // 3 minutes

    return () => {
      clearInterval(interval)
      setNextSignalGeneration(null)
    }
  }, [autoGenerating, user, cryptos, generateNewSignals])

  // Countdown timer for next signal generation
  useEffect(() => {
    if (!nextSignalGeneration) return

    const countdownInterval = setInterval(() => {
      const now = Date.now()
      const timeLeft = Math.max(0, nextSignalGeneration.getTime() - now)
      setCountdown(Math.ceil(timeLeft / 1000))
      
      if (timeLeft <= 0) {
        setCountdown(0)
      }
    }, 1000)

    return () => clearInterval(countdownInterval)
  }, [nextSignalGeneration])

  // Update signal performance every 15 seconds for more frequent updates
  useEffect(() => {
    if (!user) return

    const interval = setInterval(updateSignalPerformance, 15000) // 15 seconds
    return () => clearInterval(interval)
  }, [updateSignalPerformance, user])

  // Additional real-time price monitoring every 5 seconds for active signals
  useEffect(() => {
    if (!user || signals.filter(s => s.isActive).length === 0) return

    const quickUpdateInterval = setInterval(async () => {
      console.log('Quick price update for active signals...')
      await updateSignalPerformance()
    }, 5000) // 5 seconds for active signals only

    return () => clearInterval(quickUpdateInterval)
  }, [updateSignalPerformance, user, signals])

  // Load signals on mount
  useEffect(() => {
    loadSignals()
  }, [loadSignals])

  const getPerformanceColor = (percentage: number) => {
    if (percentage > 2) return 'text-green-500'
    if (percentage < -2) return 'text-red-500'
    return 'text-yellow-500'
  }

  const getPerformanceIcon = (percentage: number) => {
    if (percentage > 2) return <CheckCircle className="h-3 w-3" />
    if (percentage < -2) return <XCircle className="h-3 w-3" />
    return <AlertCircle className="h-3 w-3" />
  }

  const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {/* Live Signal Controls */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Live Signal Feed
              <Badge variant="outline" className="text-xs">
                {signals.filter(s => s.isActive).length} Active
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoGenerating(!autoGenerating)}
                className={cn(
                  "gap-2",
                  autoGenerating && "bg-primary/10 border-primary text-primary"
                )}
              >
                <Zap className={cn("h-4 w-4", autoGenerating && "animate-pulse")} />
                Auto {autoGenerating ? 'ON' : 'OFF'}
              </Button>
              <Button
                onClick={() => generateNewSignals()}
                disabled={loading}
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                {loading ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{signalStats.total}</div>
              <div className="text-muted-foreground">Total Signals</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">{signalStats.active}</div>
              <div className="text-muted-foreground">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{signalStats.profitable}</div>
              <div className="text-muted-foreground">Profitable</div>
            </div>
            <div className="text-center">
              <div className={cn(
                "text-2xl font-bold",
                getPerformanceColor(signalStats.avgPerformance)
              )}>
                {signalStats.avgPerformance > 0 ? '+' : ''}{signalStats.avgPerformance.toFixed(1)}%
              </div>
              <div className="text-muted-foreground">Avg Performance</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last update: {lastSignalUpdate.toLocaleTimeString()}
              </div>
              <div className="flex items-center gap-1">
                <RefreshCw className={cn("h-3 w-3", isUpdating && "animate-spin")} />
                {isUpdating ? "Updating..." : "Updates every 15s"}
              </div>
            </div>
            {autoGenerating && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-primary">
                  <Activity className="h-3 w-3 animate-pulse" />
                  Auto-generating every 3 minutes
                </div>
                {countdown > 0 && (
                  <div className="flex items-center gap-1 text-amber-500">
                    <Clock className="h-3 w-3" />
                    Next: {formatCountdown(countdown)}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Signals List */}
      <div className="space-y-4">
        {signals.length > 0 ? (
          signals.map((signal) => (
            <Card key={signal.id} className={cn(
              "border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-200",
              !signal.isActive && "opacity-60"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-semibold">{signal.symbol}</div>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      signal.signalType === 'BUY' ? "border-green-500 text-green-500" : "border-red-500 text-red-500"
                    )}>
                      {signal.signalType === 'BUY' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                      {signal.signalType}
                    </Badge>
                    <Badge className={cn(
                      "text-xs",
                      signal.strength === 'STRONG' ? "bg-green-500/20 text-green-500" :
                      signal.strength === 'MODERATE' ? "bg-yellow-500/20 text-yellow-500" :
                      "bg-gray-500/20 text-gray-500"
                    )}>
                      {signal.strength}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "flex items-center gap-1 text-sm font-medium",
                      getPerformanceColor(signal.performancePercentage)
                    )}>
                      {getPerformanceIcon(signal.performancePercentage)}
                      {signal.performancePercentage > 0 ? '+' : ''}{signal.performancePercentage.toFixed(2)}%
                    </div>
                    <Badge variant={signal.isActive ? "default" : "secondary"} className="text-xs">
                      {signal.isActive ? "Active" : "Closed"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div>Confidence: {signal.confidenceScore}%</div>
                  <div>Created: {new Date(signal.createdAt).toLocaleTimeString()}</div>
                  <div>Updated: {new Date(signal.updatedAt).toLocaleTimeString()}</div>
                </div>
              </CardHeader>
              <CardContent>
                <TradingSignal
                  symbol={signal.symbol}
                  signalType={signal.signalType}
                  strength={signal.strength}
                  confidenceScore={signal.confidenceScore}
                  currentPrice={signal.currentPrice}
                  targetPrice={signal.targetPrice}
                  stopLoss={signal.stopLoss}
                  reasoning={signal.reasoning}
                  createdAt={signal.createdAt}
                />
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No live signals yet</p>
              <p className="text-sm">Click "Generate" to create AI-powered trading signals</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}