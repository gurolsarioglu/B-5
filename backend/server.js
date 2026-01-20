require('dotenv').config();
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const binanceService = require('./services/binance.service');
const technicalService = require('./services/technical.service');
const analysisService = require('./services/analysis.service');
const cache = require('./utils/cache');
const alertService = require('./services/alert.service'); // Import AlertService

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ==================== REST API ENDPOINTS ====================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * GET /api/coins
 * Get all USDT pairs with basic market data
 */
app.get('/api/coins', async (req, res) => {
    try {
        // Check cache first
        const cacheKey = 'all_coins';
        let coins = cache.get(cacheKey);

        if (!coins) {
            console.log('Cache miss - fetching from Binance API');
            coins = await binanceService.get24hrTickers();
            cache.set(cacheKey, coins, 30); // Cache for 30 seconds
        }

        res.json({
            success: true,
            count: coins.length,
            data: coins,
            cached: !!cache.get(cacheKey)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/coins/:symbol
 * Get detailed data for a specific coin including technical indicators
 */
app.get('/api/coins/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const cacheKey = `coin_${symbol}`;

        let coinData = cache.get(cacheKey);

        if (!coinData) {
            // Get ticker data
            const allTickers = await binanceService.get24hrTickers();
            const ticker = allTickers.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());

            if (!ticker) {
                return res.status(404).json({
                    success: false,
                    error: 'Symbol not found'
                });
            }

            // Get klines for technical analysis
            const klines = await binanceService.getKlines(symbol, '1h', 100);
            const closePrices = klines.map(k => k.close);

            // Calculate technical indicators
            const indicators = await technicalService.calculateAllIndicators(closePrices);

            coinData = {
                ...ticker,
                technicalIndicators: indicators,
                klineData: {
                    interval: '1h',
                    count: klines.length
                }
            };

            cache.set(cacheKey, coinData, 60); // Cache for 60 seconds
        }

        res.json({
            success: true,
            data: coinData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/coins-with-indicators
 * Get all USDT pairs with technical indicators (heavy operation)
 * This endpoint processes data in batches
 */
app.get('/api/coins-with-indicators', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const cacheKey = `coins_indicators_${limit}`;

        let data = cache.get(cacheKey);

        if (!data) {
            // Get all tickers
            const tickers = await binanceService.get24hrTickers();

            // Sort by volume and take top coins
            const topCoins = tickers
                .sort((a, b) => b.quoteVolume - a.quoteVolume)
                .slice(0, limit);

            // Calculate indicators for each coin in parallel (with limit)
            const batchSize = 5;
            const results = [];

            for (let i = 0; i < topCoins.length; i += batchSize) {
                const batch = topCoins.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                    batch.map(async (coin) => {
                        try {
                            const klines = await binanceService.getKlines(coin.symbol, '1h', 100);
                            const closePrices = klines.map(k => k.close);
                            const indicators = await technicalService.calculateAllIndicators(closePrices);

                            return {
                                ...coin,
                                technicalIndicators: indicators
                            };
                        } catch (error) {
                            console.error(`Error processing ${coin.symbol}:`, error.message);
                            return {
                                ...coin,
                                technicalIndicators: {
                                    rsi: null,
                                    stochRSI: null,
                                    error: error.message
                                }
                            };
                        }
                    })
                );

                results.push(...batchResults);
            }

            data = results;
            cache.set(cacheKey, data, 120); // Cache for 2 minutes
        }

        res.json({
            success: true,
            count: data.length,
            data,
            cached: !!cache.get(cacheKey)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/btc-status
 * Get Bitcoin market analysis and trend
 */
app.get('/api/btc-status', async (req, res) => {
    try {
        const cacheKey = 'btc_status';
        let btcStatus = cache.get(cacheKey);

        if (!btcStatus) {
            btcStatus = await analysisService.analyzeBTCStatus();
            cache.set(cacheKey, btcStatus, 60); // Cache for 60 seconds
        }

        res.json({
            success: true,
            data: btcStatus,
            cached: !!cache.get(cacheKey)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/top-drops
 * Get coins with biggest price drops
 */
app.get('/api/top-drops', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const drops = await binanceService.getBiggestDrops(limit);

        res.json({
            success: true,
            count: drops.length,
            data: drops
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/top-volume
 * Get coins with highest trading volume
 */
app.get('/api/top-volume', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const topCoins = await binanceService.getTopCoinsByVolume(limit);

        res.json({
            success: true,
            count: topCoins.length,
            data: topCoins
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/cache/stats
 * Get cache statistics
 */
app.get('/api/cache/stats', (req, res) => {
    res.json({
        success: true,
        data: cache.getStats(),
        keys: cache.keys()
    });
});

/**
 * DELETE /api/cache
 * Clear all cache
 */
app.delete('/api/cache', (req, res) => {
    cache.flush();
    res.json({
        success: true,
        message: 'Cache cleared'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
app.listen(port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Binance Crypto Monitor API Server                   ║
║                                                           ║
║   Server running on: http://localhost:${port}              ║
║   Environment: ${process.env.NODE_ENV || 'development'}                          ║
║                                                           ║
║   Available endpoints:                                    ║
║   - GET  /api/health                                      ║
║   - GET  /api/coins                                       ║
║   - GET  /api/coins/:symbol                               ║
║   - POST /api/subscribe                                   ║
║   - GET  /api/coins-with-indicators?limit=20              ║
║   - GET  /api/btc-status                                  ║
║   - GET  /api/top-drops?limit=10                          ║
║   - GET  /api/top-volume?limit=10                         ║
║   - GET  /api/cache/stats                                 ║
║   - DEL  /api/cache                                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});
