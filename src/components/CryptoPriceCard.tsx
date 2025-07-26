import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Star, StarOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CryptoPriceCardProps {
  symbol: string
  name: string
  currentPrice: number
  priceChange24h: number
  priceChangePercentage24h: number
  volume24h: number
  image?: string
  isWatched?: boolean
  onToggleWatch?: () => void
}

export function CryptoPriceCard({
  symbol,
  name,
  currentPrice,
  priceChange24h,
  priceChangePercentage24h,
  volume24h,
  image,
  isWatched = false,
  onToggleWatch
}: CryptoPriceCardProps) {
  const isPositive = priceChange24h >= 0
  const formattedPrice = currentPrice.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: currentPrice < 1 ? 6 : 2
  })
  
  const formattedVolume = (volume24h / 1000000).toFixed(1) + 'M'

  return (
    <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          <div className="flex items-center gap-2">
            {image && (
              <img 
                src={image} 
                alt={`${name} logo`} 
                className="w-6 h-6 rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
            <span className="font-semibold">{symbol}</span>
            <span className="text-xs text-muted-foreground">{name}</span>
          </div>
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleWatch}
          className="h-8 w-8 p-0"
        >
          {isWatched ? (
            <Star className="h-4 w-4 fill-accent text-accent" />
          ) : (
            <StarOff className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold">{formattedPrice}</div>
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium",
              isPositive ? "text-primary" : "text-destructive"
            )}>
              {isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {priceChangePercentage24h.toFixed(2)}%
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>24h Change</span>
            <span className={cn(
              "font-medium",
              isPositive ? "text-primary" : "text-destructive"
            )}>
              {isPositive ? '+' : ''}${priceChange24h.toFixed(2)}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Volume</span>
            <span>${formattedVolume}</span>
          </div>
          

        </div>
      </CardContent>
    </Card>
  )
}