import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Minus, Clock, Target, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TradingSignalProps {
  symbol: string
  signalType: 'BUY' | 'SELL' | 'HOLD'
  strength: 'STRONG' | 'MODERATE' | 'WEAK'
  confidenceScore: number
  currentPrice: number
  targetPrice?: number
  stopLoss?: number
  reasoning: string
  createdAt: string
  onExecute?: () => void
}

export function TradingSignal({
  symbol,
  signalType,
  strength,
  confidenceScore,
  currentPrice,
  targetPrice,
  stopLoss,
  reasoning,
  createdAt,
  onExecute
}: TradingSignalProps) {
  const getSignalIcon = () => {
    switch (signalType) {
      case 'BUY':
        return <TrendingUp className="h-4 w-4" />
      case 'SELL':
        return <TrendingDown className="h-4 w-4" />
      default:
        return <Minus className="h-4 w-4" />
    }
  }

  const getSignalColor = () => {
    switch (signalType) {
      case 'BUY':
        return 'text-primary border-primary bg-primary/10'
      case 'SELL':
        return 'text-destructive border-destructive bg-destructive/10'
      default:
        return 'text-muted-foreground border-muted-foreground bg-muted/10'
    }
  }

  const getStrengthColor = () => {
    switch (strength) {
      case 'STRONG':
        return 'signal-strong'
      case 'MODERATE':
        return 'signal-moderate'
      default:
        return 'signal-weak'
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 1 ? 6 : 2
    })
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{symbol}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs", getStrengthColor())}>
              {strength}
            </Badge>
            <Badge variant="outline" className={cn("text-xs", getSignalColor())}>
              {getSignalIcon()}
              {signalType}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(createdAt)}
          </div>
          <div className="flex items-center gap-1">
            <span>Confidence:</span>
            <span className="font-medium text-foreground">{confidenceScore}%</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Current</div>
            <div className="font-medium">{formatPrice(currentPrice)}</div>
          </div>
          {targetPrice && (
            <div>
              <div className="text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" />
                Target
              </div>
              <div className="font-medium text-primary">{formatPrice(targetPrice)}</div>
            </div>
          )}
          {stopLoss && (
            <div>
              <div className="text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Stop Loss
              </div>
              <div className="font-medium text-destructive">{formatPrice(stopLoss)}</div>
            </div>
          )}
        </div>
        
        <div>
          <div className="text-sm text-muted-foreground mb-1">Analysis</div>
          <p className="text-sm leading-relaxed">{reasoning}</p>
        </div>
        
        {onExecute && (
          <Button 
            className={cn(
              "w-full",
              signalType === 'BUY' 
                ? "bg-primary hover:bg-primary/90" 
                : signalType === 'SELL'
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-muted hover:bg-muted/90"
            )}
            onClick={onExecute}
          >
            Execute {signalType} Signal
          </Button>
        )}
      </CardContent>
    </Card>
  )
}