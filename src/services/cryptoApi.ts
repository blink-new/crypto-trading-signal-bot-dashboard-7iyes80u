// CoinGecko API service for real-time cryptocurrency data
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3'

export interface CoinGeckoMarket {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  fully_diluted_valuation: number | null
  total_volume: number
  high_24h: number
  low_24h: number
  price_change_24h: number
  price_change_percentage_24h: number
  market_cap_change_24h: number
  market_cap_change_percentage_24h: number
  circulating_supply: number
  total_supply: number | null
  max_supply: number | null
  ath: number
  ath_change_percentage: number
  ath_date: string
  atl: number
  atl_change_percentage: number
  atl_date: string
  roi: any | null
  last_updated: string
}

export interface GlobalMarketData {
  data: {
    active_cryptocurrencies: number
    upcoming_icos: number
    ongoing_icos: number
    ended_icos: number
    markets: number
    total_market_cap: Record<string, number>
    total_volume: Record<string, number>
    market_cap_percentage: Record<string, number>
    market_cap_change_percentage_24h_usd: number
    updated_at: number
  }
}

class CryptoApiService {
  private async fetchWithRetry(url: string, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
          },
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        return await response.json()
      } catch (error) {
        console.error(`API request failed (attempt ${i + 1}):`, error)
        if (i === retries - 1) throw error
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
      }
    }
  }

  async getTopCryptocurrencies(limit = 20): Promise<CoinGeckoMarket[]> {
    try {
      // For larger limits, we might need multiple pages
      if (limit <= 250) {
        const url = `${COINGECKO_API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&locale=en`
        return await this.fetchWithRetry(url)
      } else {
        // For very large limits, fetch multiple pages
        const results: CoinGeckoMarket[] = []
        const perPage = 250
        const pages = Math.ceil(limit / perPage)
        
        for (let page = 1; page <= pages; page++) {
          const url = `${COINGECKO_API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false&locale=en`
          const pageResults = await this.fetchWithRetry(url)
          results.push(...pageResults)
          
          if (results.length >= limit) break
        }
        
        return results.slice(0, limit)
      }
    } catch (error) {
      console.error('Failed to fetch top cryptocurrencies:', error)
      return this.getFallbackData()
    }
  }

  async getGlobalMarketData(): Promise<GlobalMarketData | null> {
    try {
      const url = `${COINGECKO_API_BASE}/global`
      return await this.fetchWithRetry(url)
    } catch (error) {
      console.error('Failed to fetch global market data:', error)
      return null
    }
  }

  async getCryptocurrencyById(id: string): Promise<any> {
    try {
      const url = `${COINGECKO_API_BASE}/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
      return await this.fetchWithRetry(url)
    } catch (error) {
      console.error(`Failed to fetch cryptocurrency ${id}:`, error)
      return null
    }
  }

  async getMarketChart(id: string, days = 7): Promise<any> {
    try {
      const url = `${COINGECKO_API_BASE}/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`
      return await this.fetchWithRetry(url)
    } catch (error) {
      console.error(`Failed to fetch market chart for ${id}:`, error)
      return null
    }
  }

  // Fallback data when API is unavailable
  private getFallbackData(): CoinGeckoMarket[] {
    return [
      {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
        current_price: 43250.00,
        market_cap: 847500000000,
        market_cap_rank: 1,
        fully_diluted_valuation: 908250000000,
        total_volume: 18500000000,
        high_24h: 44100.00,
        low_24h: 42800.00,
        price_change_24h: 450.00,
        price_change_percentage_24h: 1.05,
        market_cap_change_24h: 8850000000,
        market_cap_change_percentage_24h: 1.05,
        circulating_supply: 19600000,
        total_supply: 21000000,
        max_supply: 21000000,
        ath: 69045,
        ath_change_percentage: -37.4,
        ath_date: '2021-11-10T14:24:11.849Z',
        atl: 67.81,
        atl_change_percentage: 63650.8,
        atl_date: '2013-07-06T00:00:00.000Z',
        roi: null,
        last_updated: new Date().toISOString()
      },
      {
        id: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        image: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        current_price: 2650.00,
        market_cap: 318500000000,
        market_cap_rank: 2,
        fully_diluted_valuation: 318500000000,
        total_volume: 12800000000,
        high_24h: 2720.00,
        low_24h: 2580.00,
        price_change_24h: 35.50,
        price_change_percentage_24h: 1.36,
        market_cap_change_24h: 4270000000,
        market_cap_change_percentage_24h: 1.36,
        circulating_supply: 120280000,
        total_supply: 120280000,
        max_supply: null,
        ath: 4878.26,
        ath_change_percentage: -45.7,
        ath_date: '2021-11-10T14:24:19.604Z',
        atl: 0.432979,
        atl_change_percentage: 611850.1,
        atl_date: '2015-10-20T00:00:00.000Z',
        roi: null,
        last_updated: new Date().toISOString()
      },
      {
        id: 'binancecoin',
        symbol: 'bnb',
        name: 'BNB',
        image: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
        current_price: 315.50,
        market_cap: 47200000000,
        market_cap_rank: 3,
        fully_diluted_valuation: 47200000000,
        total_volume: 1850000000,
        high_24h: 322.00,
        low_24h: 308.50,
        price_change_24h: 4.20,
        price_change_percentage_24h: 1.35,
        market_cap_change_24h: 628000000,
        market_cap_change_percentage_24h: 1.35,
        circulating_supply: 149500000,
        total_supply: 149500000,
        max_supply: 200000000,
        ath: 686.31,
        ath_change_percentage: -54.0,
        ath_date: '2021-05-10T07:24:17.097Z',
        atl: 0.0398177,
        atl_change_percentage: 792150.5,
        atl_date: '2017-10-19T00:00:00.000Z',
        roi: null,
        last_updated: new Date().toISOString()
      },
      {
        id: 'solana',
        symbol: 'sol',
        name: 'Solana',
        image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
        current_price: 98.50,
        market_cap: 44800000000,
        market_cap_rank: 4,
        fully_diluted_valuation: 56200000000,
        total_volume: 2150000000,
        high_24h: 102.50,
        low_24h: 95.20,
        price_change_24h: 2.80,
        price_change_percentage_24h: 2.93,
        market_cap_change_24h: 1270000000,
        market_cap_change_percentage_24h: 2.93,
        circulating_supply: 454800000,
        total_supply: 570500000,
        max_supply: null,
        ath: 259.96,
        ath_change_percentage: -62.1,
        ath_date: '2021-11-06T21:54:35.825Z',
        atl: 0.500801,
        atl_change_percentage: 19560.8,
        atl_date: '2020-05-11T19:35:23.449Z',
        roi: null,
        last_updated: new Date().toISOString()
      },
      {
        id: 'cardano',
        symbol: 'ada',
        name: 'Cardano',
        image: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
        current_price: 0.485,
        market_cap: 17200000000,
        market_cap_rank: 5,
        fully_diluted_valuation: 21800000000,
        total_volume: 485000000,
        high_24h: 0.495,
        low_24h: 0.472,
        price_change_24h: 0.008,
        price_change_percentage_24h: 1.68,
        market_cap_change_24h: 284000000,
        market_cap_change_percentage_24h: 1.68,
        circulating_supply: 35450000000,
        total_supply: 45000000000,
        max_supply: 45000000000,
        ath: 3.09,
        ath_change_percentage: -84.3,
        ath_date: '2021-09-02T06:00:10.474Z',
        atl: 0.01925275,
        atl_change_percentage: 2420.1,
        atl_date: '2020-03-13T02:22:55.391Z',
        roi: null,
        last_updated: new Date().toISOString()
      }
    ]
  }

  // Technical analysis helpers
  calculateRSI(prices: number[], period = 14): number {
    if (prices.length < period + 1) return 50 // Default neutral RSI
    
    let gains = 0
    let losses = 0
    
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1]
      if (change > 0) {
        gains += change
      } else {
        losses -= change
      }
    }
    
    const avgGain = gains / period
    const avgLoss = losses / period
    
    if (avgLoss === 0) return 100
    
    const rs = avgGain / avgLoss
    return 100 - (100 / (1 + rs))
  }

  calculateMovingAverage(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0
    
    const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0)
    return sum / period
  }

  generateTechnicalSignal(crypto: CoinGeckoMarket): {
    signal: 'BUY' | 'SELL' | 'HOLD'
    strength: 'STRONG' | 'MODERATE' | 'WEAK'
    confidence: number
    reasoning: string
  } {
    const priceChange = crypto.price_change_percentage_24h
    const volume = crypto.total_volume
    const marketCap = crypto.market_cap
    
    // Simple signal generation based on price action and volume
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
    let strength: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK'
    let confidence = 50
    let reasoning = ''
    
    if (priceChange > 5 && volume > marketCap * 0.1) {
      signal = 'BUY'
      strength = 'STRONG'
      confidence = 85
      reasoning = `Strong bullish momentum with ${priceChange.toFixed(2)}% gain and high volume. Technical indicators suggest continued upward movement.`
    } else if (priceChange > 2) {
      signal = 'BUY'
      strength = 'MODERATE'
      confidence = 70
      reasoning = `Positive price action with ${priceChange.toFixed(2)}% gain. Moderate bullish sentiment with room for growth.`
    } else if (priceChange < -5 && volume > marketCap * 0.1) {
      signal = 'SELL'
      strength = 'STRONG'
      confidence = 80
      reasoning = `Significant bearish pressure with ${Math.abs(priceChange).toFixed(2)}% decline and high volume. Risk of further downside.`
    } else if (priceChange < -2) {
      signal = 'SELL'
      strength = 'MODERATE'
      confidence = 65
      reasoning = `Negative price momentum with ${Math.abs(priceChange).toFixed(2)}% decline. Caution advised as trend may continue.`
    } else {
      signal = 'HOLD'
      strength = Math.abs(priceChange) > 1 ? 'MODERATE' : 'WEAK'
      confidence = 60
      reasoning = `Consolidation phase with ${priceChange.toFixed(2)}% change. Mixed signals suggest waiting for clearer direction.`
    }
    
    return { signal, strength, confidence, reasoning }
  }
}

export const cryptoApi = new CryptoApiService()