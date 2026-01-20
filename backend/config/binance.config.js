module.exports = {
  // Binance API Configuration
  BINANCE_API_URL: process.env.BINANCE_API_URL || 'https://api.binance.com',
  BINANCE_WS_URL: process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443',
  
  // API Keys (optional for public endpoints)
  BINANCE_API_KEY: process.env.BINANCE_API_KEY || '',
  BINANCE_API_SECRET: process.env.BINANCE_API_SECRET || '',
  
  // Trading pairs to monitor
  QUOTE_ASSET: 'USDT',
  
  // Technical indicator settings
  RSI_PERIOD: 14,
  STOCH_RSI_PERIOD: 14,
  KLINE_INTERVAL: '1h', // 1h, 4h, 1d
  KLINE_LIMIT: 100, // Number of candles to fetch
  
  // Cache settings
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 60, // seconds
  CACHE_CHECK_PERIOD: parseInt(process.env.CACHE_CHECK_PERIOD) || 120, // seconds
  
  // Rate limiting
  MAX_REQUESTS_PER_MINUTE: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 50,
  
  // WebSocket settings
  WS_RECONNECT_DELAY: 5000, // 5 seconds
  WS_PING_INTERVAL: 30000, // 30 seconds
  
  // BTC analysis thresholds
  BTC_SYMBOLS: ['BTCUSDT'],
  TREND_THRESHOLDS: {
    STRONG_BULLISH: { rsi: [40, 70], priceChange: 3 },
    BULLISH: { rsi: [35, 65], priceChange: 1 },
    NEUTRAL: { rsi: [30, 70], priceChange: [-1, 1] },
    BEARISH: { rsi: [35, 65], priceChange: -1 },
    STRONG_BEARISH: { rsi: [30, 60], priceChange: -3 }
  }
};
