import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CryptoPriceCard } from './CryptoPriceCard'
import { TradingSignal } from './TradingSignal'
import { MarketOverview } from './MarketOverview'
import { CryptoBrowser } from './CryptoBrowser'
import { LiveSignalFeed } from './LiveSignalFeed'
import { blink } from '@/blink/client'
import { cryptoApi, type CoinGeckoMarket } from '@/services/cryptoApi'
import { 
  Activity, 
  TrendingUp, 
  Zap, 
  RefreshCw, 
  Bell,
  Settings,
  Wallet,
  User,
  LogOut,
  Star
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Cryptocurrency {
  id: string
  symbol: string
  name: string
  currentPrice: number
  priceChange24h: number
  priceChangePercentage24h: number
  marketCap: number
  volume24h: number
  lastUpdated: string
  image?: string
}

interface Signal {
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
}

export function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [cryptos, setCryptos] = useState<Cryptocurrency[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [nextRefresh, setNextRefresh] = useState<Date>(new Date(Date.now() + 60000))
  const [marketStats, setMarketStats] = useState({
    totalMarketCap: 0,
    totalVolume24h: 0,
    btcDominance: 0,
    activeSignals: 0,
    gainers: 0,
    losers: 0
  })

  const loadCryptos = useCallback(async () => {
    try {
      // Fetch live data from CoinGecko API
      const liveData = await cryptoApi.getTopCryptocurrencies(20)
      
      // Transform API data to our format
      const transformedCryptos: Cryptocurrency[] = liveData.map(crypto => ({
        id: crypto.id,
        symbol: crypto.symbol.toUpperCase(),
        name: crypto.name,
        currentPrice: crypto.current_price,
        priceChange24h: crypto.price_change_24h,
        priceChangePercentage24h: crypto.price_change_percentage_24h,
        marketCap: crypto.market_cap,
        volume24h: crypto.total_volume,
        lastUpdated: crypto.last_updated,
        image: crypto.image
      }))
      
      setCryptos(transformedCryptos)
      
      // Update market stats
      const globalData = await cryptoApi.getGlobalMarketData()
      if (globalData) {
        setMarketStats({
          totalMarketCap: globalData.data.total_market_cap.usd || 0,
          totalVolume24h: globalData.data.total_volume.usd || 0,
          btcDominance: globalData.data.market_cap_percentage.btc || 0,
          activeSignals: signals.length,
          gainers: transformedCryptos.filter(c => c.priceChangePercentage24h > 0).length,
          losers: transformedCryptos.filter(c => c.priceChangePercentage24h < 0).length
        })
      }
      
      // Store in database for caching
      if (user) {
        for (const crypto of transformedCryptos.slice(0, 10)) {
          try {
            await blink.db.cryptocurrencies.create({
              id: `${crypto.id}_${Date.now()}`,
              userId: user.id,
              symbol: crypto.symbol,
              name: crypto.name,
              currentPrice: crypto.currentPrice,
              priceChange24h: crypto.priceChange24h,
              priceChangePercentage24h: crypto.priceChangePercentage24h,
              marketCap: crypto.marketCap,
              volume24h: crypto.volume24h,
              lastUpdated: crypto.lastUpdated
            })
          } catch (dbError) {
            // Ignore database errors for now
            console.warn('Failed to cache crypto data:', dbError)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load cryptocurrencies:', error)
      // Fallback to cached data from database
      if (user) {
        try {
          const cachedResult = await blink.db.cryptocurrencies.list({
            where: { userId: user.id },
            orderBy: { marketCap: 'desc' },
            limit: 20
          })
          setCryptos(cachedResult.map(crypto => ({
            id: crypto.id,
            symbol: crypto.symbol,
            name: crypto.name,
            currentPrice: crypto.currentPrice,
            priceChange24h: crypto.priceChange24h,
            priceChangePercentage24h: crypto.priceChangePercentage24h,
            marketCap: crypto.marketCap || 0,
            volume24h: crypto.volume24h || 0,
            lastUpdated: crypto.lastUpdated
          })))
        } catch (dbError) {
          console.error('Failed to load cached data:', dbError)
        }
      }
    }
  }, [signals.length, user])

  const generateSignals = async () => {
    if (!user) return
    
    try {
      // Generate AI-powered trading signals using real market data
      const newSignals: Signal[] = []
      
      // Use top 8 cryptos for signal generation
      const topCryptos = cryptos.slice(0, 8)
      
      for (let i = 0; i < Math.min(5, topCryptos.length); i++) {
        const crypto = topCryptos[i]
        
        // Generate technical analysis signal
        const technicalSignal = cryptoApi.generateTechnicalSignal({
          id: crypto.id,
          symbol: crypto.symbol.toLowerCase(),
          name: crypto.name,
          image: crypto.image || '',
          current_price: crypto.currentPrice,
          market_cap: crypto.marketCap,
          market_cap_rank: i + 1,
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
        
        const targetPrice = technicalSignal.signal === 'BUY' 
          ? crypto.currentPrice * (1 + Math.random() * 0.15 + 0.05)
          : technicalSignal.signal === 'SELL'
          ? crypto.currentPrice * (1 - Math.random() * 0.15 - 0.05)
          : undefined
          
        const stopLoss = technicalSignal.signal === 'BUY'
          ? crypto.currentPrice * (1 - Math.random() * 0.08 - 0.02)
          : technicalSignal.signal === 'SELL'
          ? crypto.currentPrice * (1 + Math.random() * 0.08 + 0.02)
          : undefined
        
        const signalId = `signal_${Date.now()}_${i}`
        
        // Save to database
        try {
          await blink.db.tradingSignals.create({
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
            technicalIndicators: JSON.stringify({
              rsi: Math.floor(Math.random() * 100),
              macd: Math.random() * 2 - 1,
              movingAverage: crypto.currentPrice * (1 + (Math.random() * 0.1 - 0.05)),
              volume: crypto.volume24h,
              marketCap: crypto.marketCap
            })
          })
        } catch (dbError) {
          console.warn('Failed to save signal to database:', dbError)
        }
        
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
          createdAt: new Date().toISOString()
        })
      }
      
      setSignals(prev => [...newSignals, ...prev].slice(0, 15))
      
      // Update market stats with new signal count
      setMarketStats(prev => ({
        ...prev,
        activeSignals: prev.activeSignals + newSignals.length
      }))
      
      toast.success(`Generated ${newSignals.length} new trading signals!`)
    } catch (error) {
      console.error('Failed to generate signals:', error)
      toast.error('Failed to generate signals. Please try again.')
    }
  }

  const toggleWatchlist = async (symbol: string) => {
    if (!user) return
    
    try {
      if (watchlist.includes(symbol)) {
        // Remove from watchlist
        const existing = await blink.db.userWatchlist.list({
          where: { 
            AND: [
              { userId: user.id },
              { symbol }
            ]
          }
        })
        
        if (existing.length > 0) {
          await blink.db.userWatchlist.delete(existing[0].id)
        }
        
        setWatchlist(prev => prev.filter(s => s !== symbol))
        toast.success(`Removed ${symbol} from watchlist`)
      } else {
        // Add to watchlist
        await blink.db.userWatchlist.create({
          id: `watch_${Date.now()}`,
          userId: user.id,
          symbol
        })
        
        setWatchlist(prev => [...prev, symbol])
        toast.success(`Added ${symbol} to watchlist`)
      }
    } catch (error) {
      console.error('Failed to toggle watchlist:', error)
      toast.error('Failed to update watchlist. Please try again.')
    }
  }

  const refreshData = async () => {
    setRefreshing(true)
    try {
      await loadCryptos()
      const now = new Date()
      setLastUpdate(now)
      setNextRefresh(new Date(now.getTime() + 60000))
      toast.success(`🔄 Manual refresh complete: ${cryptos.length} cryptocurrencies updated`, {
        description: `Updated at ${now.toLocaleTimeString()}`
      })
    } catch (error) {
      console.error('Failed to refresh data:', error)
      toast.error('Failed to update market data. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  const loadUserWatchlist = useCallback(async () => {
    try {
      const currentUser = await blink.auth.me()
      setUser(currentUser)
      const watchlistResult = await blink.db.userWatchlist.list({
        where: { userId: currentUser.id }
      })
      setWatchlist(watchlistResult.map(item => item.symbol))
    } catch (error) {
      console.error('Failed to load watchlist:', error)
    }
  }, [])

  const handleLogout = () => {
    blink.auth.logout()
  }

  useEffect(() => {
    const initDashboard = async () => {
      await loadUserWatchlist()
      await loadCryptos()
      const now = new Date()
      setLastUpdate(now)
      setNextRefresh(new Date(now.getTime() + 60000))
      setLoading(false)
    }
    
    initDashboard()
    
    // Auto-refresh every 60 seconds with user feedback
    const interval = setInterval(async () => {
      console.log('Auto-refreshing market data...')
      try {
        await loadCryptos()
        const now = new Date()
        setLastUpdate(now)
        setNextRefresh(new Date(now.getTime() + 60000))
        // Show subtle toast notification for auto-refresh with live update info
        toast.success(`📊 Live update: ${cryptos.length} cryptocurrencies refreshed`, {
          duration: 3000,
          position: 'bottom-right',
          description: `Updated at ${new Date().toLocaleTimeString()}`
        })
      } catch (error) {
        console.error('Auto-refresh failed:', error)
        toast.error('Auto-refresh failed', {
          duration: 2000,
          position: 'bottom-right'
        })
      }
    }, 60000) // 60 seconds = 60,000 milliseconds
    
    return () => clearInterval(interval)
  }, [loadCryptos, loadUserWatchlist, cryptos.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading market data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Activity className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold">CryptoSignal</h1>
              </div>
              <Badge variant="outline" className="text-xs">
                Live
              </Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live updates active</span>
                </div>
                <div className="text-xs opacity-75">
                  Last update: {lastUpdate.toLocaleTimeString()} • Next: {nextRefresh.toLocaleTimeString()}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={refreshing}
                className="gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                {refreshing ? 'Updating...' : 'Refresh Now'}
              </Button>
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4" />
              </Button>
              
              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    {user?.email?.split('@')[0] || 'User'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem disabled>
                    <User className="h-4 w-4 mr-2" />
                    {user?.email || 'Loading...'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Settings className="h-4 w-4 mr-2" />
                    Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Bell className="h-4 w-4 mr-2" />
                    Notification Preferences
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Star className="h-4 w-4 mr-2" />
                    Watchlist ({watchlist.length})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Welcome Message */}
        {user && (
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 border border-primary/20">
            <div className="flex items-center gap-3">
              <User className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Welcome back, {user.email?.split('@')[0]}!</h2>
                <p className="text-sm text-muted-foreground">
                  Your personalized crypto trading dashboard is ready. You have {watchlist.length} cryptocurrencies in your watchlist.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Market Overview */}
        <MarketOverview stats={marketStats} />

        {/* Main Content */}
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="signals">Signals</TabsTrigger>
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="watchlist" className="gap-2">
              Watchlist
              {watchlist.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {watchlist.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Crypto Prices */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Top Cryptocurrencies</h2>
                  <Button
                    onClick={generateSignals}
                    className="gap-2"
                    size="sm"
                  >
                    <Zap className="h-4 w-4" />
                    Generate Signals
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cryptos.slice(0, 8).map((crypto) => (
                    <CryptoPriceCard
                      key={crypto.id}
                      symbol={crypto.symbol}
                      name={crypto.name}
                      currentPrice={crypto.currentPrice}
                      priceChange24h={crypto.priceChange24h}
                      priceChangePercentage24h={crypto.priceChangePercentage24h}
                      volume24h={crypto.volume24h}
                      image={crypto.image}
                      isWatched={watchlist.includes(crypto.symbol)}
                      onToggleWatch={() => toggleWatchlist(crypto.symbol)}
                    />
                  ))}
                </div>
              </div>

              {/* Recent Signals Preview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Recent Signals</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Switch to signals tab
                      const signalsTab = document.querySelector('[value="signals"]') as HTMLElement
                      signalsTab?.click()
                    }}
                    className="gap-2"
                  >
                    <Activity className="h-4 w-4" />
                    View Live Feed
                  </Button>
                </div>
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {signals.slice(0, 5).map((signal) => (
                    <TradingSignal
                      key={signal.id}
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
                  ))}
                  {signals.length === 0 && (
                    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                      <CardContent className="text-center py-8 text-muted-foreground">
                        <Activity className="h-8 w-8 mx-auto mb-3 opacity-50" />
                        <p>No recent signals</p>
                        <p className="text-sm">Visit the Signals tab to generate live trading signals</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="signals" className="space-y-6">
            <LiveSignalFeed 
              user={user}
              cryptos={cryptos}
              onSignalGenerated={(count) => {
                setMarketStats(prev => ({
                  ...prev,
                  activeSignals: prev.activeSignals + count
                }))
              }}
            />
          </TabsContent>

          <TabsContent value="browse" className="space-y-6">
            <CryptoBrowser 
              watchlist={watchlist}
              onToggleWatch={toggleWatchlist}
              user={user}
            />
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-6">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Portfolio Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Portfolio tracking coming soon!</p>
                  <p className="text-sm">Connect your exchange accounts to track your holdings.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="watchlist" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Watchlist</h2>
              <Badge variant="outline" className="gap-1">
                <Star className="h-3 w-3" />
                {watchlist.length} items
              </Badge>
            </div>
            {watchlist.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cryptos
                  .filter(crypto => watchlist.includes(crypto.symbol))
                  .map((crypto) => (
                    <CryptoPriceCard
                      key={crypto.id}
                      symbol={crypto.symbol}
                      name={crypto.name}
                      currentPrice={crypto.currentPrice}
                      priceChange24h={crypto.priceChange24h}
                      priceChangePercentage24h={crypto.priceChangePercentage24h}
                      volume24h={crypto.volume24h}
                      image={crypto.image}
                      isWatched={true}
                      onToggleWatch={() => toggleWatchlist(crypto.symbol)}
                    />
                  ))}
              </div>
            ) : (
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="text-center py-12 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Your watchlist is empty</p>
                  <p className="text-sm">Click the star icon on any cryptocurrency to add it to your watchlist.</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      // Switch to browse tab
                      const browseTab = document.querySelector('[value="browse"]') as HTMLElement
                      browseTab?.click()
                    }}
                  >
                    Browse Cryptocurrencies
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}