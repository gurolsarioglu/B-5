// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// API Service
class APIService {
    constructor() {
        this.baseURL = API_BASE_URL;
    }

    /**
     * Generic fetch wrapper with error handling
     */
    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    /**
     * Get all USDT coins
     */
    async getAllCoins() {
        return this.request('/coins');
    }

    /**
     * Get specific coin details
     */
    async getCoinDetails(symbol) {
        return this.request(`/coins/${symbol}`);
    }

    /**
     * Get coins with technical indicators
     * @param {number} limit - Number of coins to return
     */
    async getCoinsWithIndicators(limit = 20) {
        return this.request(`/coins-with-indicators?limit=${limit}`);
    }

    /**
     * Get BTC market status and analysis
     */
    async getBTCStatus() {
        return this.request('/btc-status');
    }

    /**
     * Get coins with biggest price drops
     */
    async getTopDrops(limit = 10) {
        return this.request(`/top-drops?limit=${limit}`);
    }

    /**
     * Get coins with highest volume
     */
    async getTopVolume(limit = 10) {
        return this.request(`/top-volume?limit=${limit}`);
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        return this.request('/cache/stats');
    }

    /**
   * Clear cache
   */
    async clearCache() {
        return this.request('/cache', { method: 'DELETE' });
    }

    /**
     * Get kline/candlestick data for charts
     * @param {string} symbol - Trading pair symbol (e.g., 'BTCUSDT')
     * @param {string} interval - Interval (1m, 5m, 15m, 1h, 4h, 1d)
     * @param {number} limit - Number of candles (default: 100)
     */
    async getKlineData(symbol, interval = '1h', limit = 100) {
        // We'll use Binance API directly since we don't have this endpoint in backend yet
        const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const response = await fetch(binanceUrl);
        const data = await response.json();

        // Convert to lightweight-charts format
        return data.map(candle => ({
            time: candle[0] / 1000, // Convert to seconds
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
        }));
    }
}

// Export singleton instance
const api = new APIService();
