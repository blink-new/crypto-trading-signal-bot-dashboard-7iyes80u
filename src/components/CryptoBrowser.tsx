import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { CryptoPriceCard } from './CryptoPriceCard'
import { cryptoApi, type CoinGeckoMarket } from '@/services/cryptoApi'
import { blink } from '@/blink/client'
import { 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Star,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CryptoBrowserProps {
  watchlist: string[]
  onToggleWatch: (symbol: string) => void
  user: any
}

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
  marketCapRank: number
}

export function CryptoBrowser({ watchlist, onToggleWatch, user }: CryptoBrowserProps) {
  const [cryptos, setCryptos] = useState<Cryptocurrency[]>([])
  const [filteredCryptos, setFilteredCryptos] = useState<Cryptocurrency[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'market_cap' | 'price' | 'volume' | 'change'>('market_cap')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterBy, setFilterBy] = useState<'all' | 'gainers' | 'losers' | 'watchlist'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 20

  const loadAllCryptocurrencies = useCallback(async (page = 1) => {
    try {
      setLoading(page === 1)
      setRefreshing(page !== 1)
      
      // Fetch more cryptocurrencies for browsing (up to 250)
      const liveData = await cryptoApi.getTopCryptocurrencies(250)
      
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
        image: crypto.image,
        marketCapRank: crypto.market_cap_rank
      }))
      
      setCryptos(transformedCryptos)
      setTotalPages(Math.ceil(transformedCryptos.length / itemsPerPage))
      
      // Cache some data in database for offline access
      if (user && transformedCryptos.length > 0) {
        try {
          // Cache top 50 for offline access
          for (const crypto of transformedCryptos.slice(0, 50)) {
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
          }
        } catch (dbError) {
          console.warn('Failed to cache crypto data:', dbError)
        }
      }
      
      toast.success(`Loaded ${transformedCryptos.length} cryptocurrencies`)
    } catch (error) {
      console.error('Failed to load cryptocurrencies:', error)
      toast.error('Failed to load cryptocurrency data')
      
      // Fallback to cached data
      if (user) {
        try {
          const cachedResult = await blink.db.cryptocurrencies.list({
            where: { userId: user.id },
            orderBy: { marketCap: 'desc' },
            limit: 100
          })
          
          const cachedCryptos = cachedResult.map(crypto => ({
            id: crypto.id,
            symbol: crypto.symbol,
            name: crypto.name,
            currentPrice: crypto.currentPrice,
            priceChange24h: crypto.priceChange24h,
            priceChangePercentage24h: crypto.priceChangePercentage24h,
            marketCap: crypto.marketCap || 0,
            volume24h: crypto.volume24h || 0,
            lastUpdated: crypto.lastUpdated,
            marketCapRank: 0
          }))
          
          setCryptos(cachedCryptos)
          setTotalPages(Math.ceil(cachedCryptos.length / itemsPerPage))
        } catch (dbError) {
          console.error('Failed to load cached data:', dbError)
        }
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  // Filter and sort cryptocurrencies
  useEffect(() => {
    let filtered = [...cryptos]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(crypto => 
        crypto.name.toLowerCase().includes(query) ||
        crypto.symbol.toLowerCase().includes(query)
      )
    }

    // Apply category filter
    switch (filterBy) {
      case 'gainers':
        filtered = filtered.filter(crypto => crypto.priceChangePercentage24h > 0)
        break
      case 'losers':
        filtered = filtered.filter(crypto => crypto.priceChangePercentage24h < 0)
        break
      case 'watchlist':
        filtered = filtered.filter(crypto => watchlist.includes(crypto.symbol))
        break
      default:
        // 'all' - no additional filtering
        break
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: number, bValue: number
      
      switch (sortBy) {
        case 'price':
          aValue = a.currentPrice
          bValue = b.currentPrice
          break
        case 'volume':
          aValue = a.volume24h
          bValue = b.volume24h
          break
        case 'change':
          aValue = a.priceChangePercentage24h
          bValue = b.priceChangePercentage24h
          break
        default: // 'market_cap'
          aValue = a.marketCap
          bValue = b.marketCap
          break
      }
      
      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue
    })

    setFilteredCryptos(filtered)
    setTotalPages(Math.ceil(filtered.length / itemsPerPage))
    setCurrentPage(1) // Reset to first page when filters change
  }, [cryptos, searchQuery, sortBy, sortOrder, filterBy, watchlist])

  // Get current page items
  const getCurrentPageItems = () => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredCryptos.slice(startIndex, endIndex)
  }

  const handleRefresh = async () => {
    await loadAllCryptocurrencies(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top of browser
    document.getElementById('crypto-browser-top')?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    loadAllCryptocurrencies()
  }, [loadAllCryptocurrencies])

  const currentItems = getCurrentPageItems()
  const totalItems = filteredCryptos.length
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="space-y-6" id="crypto-browser-top">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Browse Cryptocurrencies</h2>
          <p className="text-sm text-muted-foreground">
            Discover and add cryptocurrencies to your watchlist
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
          variant="outline"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Filters and Search */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cryptocurrencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cryptocurrencies</SelectItem>
                  <SelectItem value="gainers">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Top Gainers
                    </div>
                  </SelectItem>
                  <SelectItem value="losers">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      Top Losers
                    </div>
                  </SelectItem>
                  <SelectItem value="watchlist">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-accent" />
                      My Watchlist ({watchlist.length})
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sort By</label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="market_cap">Market Cap</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="volume">Volume</SelectItem>
                  <SelectItem value="change">24h Change</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Order</label>
              <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Highest First</SelectItem>
                  <SelectItem value="asc">Lowest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="text-sm text-muted-foreground">
              Showing {startItem}-{endItem} of {totalItems} cryptocurrencies
            </div>
            <div className="flex items-center gap-2">
              {filterBy === 'gainers' && (
                <Badge variant="outline" className="text-primary border-primary/50">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Gainers Only
                </Badge>
              )}
              {filterBy === 'losers' && (
                <Badge variant="outline" className="text-destructive border-destructive/50">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  Losers Only
                </Badge>
              )}
              {filterBy === 'watchlist' && (
                <Badge variant="outline" className="text-accent border-accent/50">
                  <Star className="h-3 w-3 mr-1" />
                  Watchlist
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="outline">
                  <Search className="h-3 w-3 mr-1" />
                  "{searchQuery}"
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cryptocurrency Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="border-border/50 bg-card/50">
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : currentItems.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {currentItems.map((crypto) => (
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
                onToggleWatch={() => onToggleWatch(crypto.symbol)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className="w-10"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="text-center py-12">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No cryptocurrencies found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? `No results found for "${searchQuery}". Try adjusting your search or filters.`
                : 'No cryptocurrencies match your current filters.'
              }
            </p>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery('')
                setFilterBy('all')
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}