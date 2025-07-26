import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarketStats {
  totalMarketCap: number
  totalVolume24h: number
  btcDominance: number
  activeSignals: number
  gainers: number
  losers: number
}

interface MarketOverviewProps {
  stats: MarketStats
}

export function MarketOverview({ stats }: MarketOverviewProps) {
  const formatLargeNumber = (num: number) => {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T'
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
    return num.toLocaleString()
  }

  const marketSentiment = stats.gainers > stats.losers ? 'bullish' : 'bearish'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Market Cap</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${formatLargeNumber(stats.totalMarketCap)}</div>
          <p className="text-xs text-muted-foreground">
            Total cryptocurrency market
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">24h Volume</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${formatLargeNumber(stats.totalVolume24h)}</div>
          <p className="text-xs text-muted-foreground">
            Trading volume last 24h
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">BTC Dominance</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.btcDominance.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            Bitcoin market share
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Signals</CardTitle>
          <Activity className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">{stats.activeSignals}</div>
          <p className="text-xs text-muted-foreground">
            Current trading signals
          </p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 lg:col-span-4 border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Market Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-2xl font-bold text-primary">{stats.gainers}</div>
                  <div className="text-sm text-muted-foreground">Gainers</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                <div>
                  <div className="text-2xl font-bold text-destructive">{stats.losers}</div>
                  <div className="text-sm text-muted-foreground">Losers</div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={cn(
                "text-lg font-semibold capitalize",
                marketSentiment === 'bullish' ? 'text-primary' : 'text-destructive'
              )}>
                {marketSentiment}
              </div>
              <div className="text-sm text-muted-foreground">
                Market sentiment
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}