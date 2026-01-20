const axios = require('axios');
const config = require('../config/binance.config');

class BinanceService {
    constructor() {
        this.baseURL = config.BINANCE_API_URL;
        this.apiKey = config.BINANCE_API_KEY;
    }

    /**
     * Get all USDT trading pairs with 24h statistics
     */
    async get24hrTickers() {
        try {
            const response = await axios.get(`${this.baseURL}/api/v3/ticker/24hr`);

            // Filter only USDT pairs and exclude leveraged tokens
            const usdtPairs = response.data.filter(ticker =>
                ticker.symbol.endsWith(config.QUOTE_ASSET) &&
                !ticker.symbol.includes('UP') &&
                !ticker.symbol.includes('DOWN') &&
                !ticker.symbol.includes('BULL') &&
                !ticker.symbol.includes('BEAR')
            );

            return usdtPairs.map(ticker => ({
                symbol: ticker.symbol,
                coinName: ticker.symbol.replace(config.QUOTE_ASSET, ''),
                currentPrice: parseFloat(ticker.lastPrice),
                previousPrice: parseFloat(ticker.openPrice),
                priceChange: parseFloat(ticker.priceChange),
                priceChangePercent: parseFloat(ticker.priceChangePercent),
                volume: parseFloat(ticker.volume),
                quoteVolume: parseFloat(ticker.quoteVolume),
                volumeChangePercent: this.calculateVolumeChange(ticker),
                high24h: parseFloat(ticker.highPrice),
                low24h: parseFloat(ticker.lowPrice),
                trades: ticker.count
            }));
        } catch (error) {
            console.error('Error fetching 24hr tickers:', error.message);
            throw new Error('Failed to fetch market data from Binance');
        }
    }

    /**
     * Get kline/candlestick data for technical analysis
     * @param {string} symbol - Trading pair symbol (e.g., 'BTCUSDT')
     * @param {string} interval - Kline interval (1m, 5m, 1h, 1d, etc.)
     * @param {number} limit - Number of klines to return
     */
    async getKlines(symbol, interval = config.KLINE_INTERVAL, limit = config.KLINE_LIMIT) {
        try {
            const response = await axios.get(`${this.baseURL}/api/v3/klines`, {
                params: {
                    symbol,
                    interval,
                    limit
                }
            });

            return response.data.map(kline => ({
                openTime: kline[0],
                open: parseFloat(kline[1]),
                high: parseFloat(kline[2]),
                low: parseFloat(kline[3]),
                close: parseFloat(kline[4]),
                volume: parseFloat(kline[5]),
                closeTime: kline[6],
                quoteVolume: parseFloat(kline[7]),
                trades: kline[8]
            }));
        } catch (error) {
            console.error(`Error fetching klines for ${symbol}:`, error.message);
            throw new Error(`Failed to fetch kline data for ${symbol}`);
        }
    }

    /**
     * Get current price for a specific symbol
     */
    async getCurrentPrice(symbol) {
        try {
            const response = await axios.get(`${this.baseURL}/api/v3/ticker/price`, {
                params: { symbol }
            });
            return parseFloat(response.data.price);
        } catch (error) {
            console.error(`Error fetching price for ${symbol}:`, error.message);
            throw new Error(`Failed to fetch price for ${symbol}`);
        }
    }

    /**
     * Get exchange info to validate symbols
     */
    async getExchangeInfo() {
        try {
            const response = await axios.get(`${this.baseURL}/api/v3/exchangeInfo`);
            return response.data;
        } catch (error) {
            console.error('Error fetching exchange info:', error.message);
            throw new Error('Failed to fetch exchange info');
        }
    }

    /**
     * Calculate volume change percentage
     * Binance doesn't provide this directly, so we estimate it
     */
    calculateVolumeChange(ticker) {
        // This is an approximation since Binance doesn't provide previous volume
        // We can improve this by storing historical data
        const avgVolume = parseFloat(ticker.quoteVolume) / 24; // Rough hourly average
        const currentVolume = parseFloat(ticker.quoteVolume);
        return ((currentVolume - avgVolume) / avgVolume * 100).toFixed(2);
    }

    /**
     * Get top coins by volume
     */
    async getTopCoinsByVolume(limit = 10) {
        try {
            const tickers = await this.get24hrTickers();
            return tickers
                .sort((a, b) => b.quoteVolume - a.quoteVolume)
                .slice(0, limit);
        } catch (error) {
            console.error('Error fetching top coins:', error.message);
            throw error;
        }
    }

    /**
     * Get coins with biggest price drops
     */
    async getBiggestDrops(limit = 10) {
        try {
            const tickers = await this.get24hrTickers();
            return tickers
                .filter(ticker => ticker.priceChangePercent < 0)
                .sort((a, b) => a.priceChangePercent - b.priceChangePercent)
                .slice(0, limit);
        } catch (error) {
            console.error('Error fetching biggest drops:', error.message);
            throw error;
        }
    }
}

module.exports = new BinanceService();
