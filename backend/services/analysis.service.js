const binanceService = require('./binance.service');
const technicalService = require('./technical.service');
const config = require('../config/binance.config');

class AnalysisService {
    /**
     * Analyze BTC market status and trend
     */
    async analyzeBTCStatus() {
        try {
            const symbol = 'BTCUSDT';

            // Get BTC klines for analysis
            const klines = await binanceService.getKlines(symbol, '1h', 100);
            const closePrices = klines.map(k => k.close);
            const currentPrice = closePrices[closePrices.length - 1];
            const previousPrice = closePrices[closePrices.length - 2];

            // Calculate technical indicators
            const indicators = await technicalService.calculateAllIndicators(closePrices);

            // Get 24hr ticker for additional data
            const allTickers = await binanceService.get24hrTickers();
            const btcTicker = allTickers.find(t => t.symbol === symbol);

            // Calculate price change
            const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;
            const priceChange24h = btcTicker.priceChangePercent;

            // Determine trend
            const trend = this.determineTrend(
                priceChange24h,
                indicators.rsi,
                indicators.stochRSI,
                currentPrice,
                indicators.sma7,
                indicators.ema7
            );

            // Generate analysis commentary
            const commentary = this.generateCommentary(trend, indicators, priceChange24h);

            return {
                symbol,
                currentPrice,
                priceChange: priceChange.toFixed(2),
                priceChange24h: priceChange24h.toFixed(2),
                volume24h: btcTicker.quoteVolume,
                high24h: btcTicker.high24h,
                low24h: btcTicker.low24h,
                rsi: indicators.rsi,
                rsiInterpretation: indicators.rsiInterpretation,
                stochRSI: indicators.stochRSI,
                stochRSIInterpretation: indicators.stochRSIInterpretation,
                sma7: indicators.sma7,
                ema7: indicators.ema7,
                trend,
                commentary,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error analyzing BTC status:', error.message);
            throw error;
        }
    }

    /**
     * Determine market trend based on multiple factors
     */
    determineTrend(priceChange24h, rsi, stochRSI, currentPrice, sma7, ema7) {
        let score = 0;

        // Price change factor
        if (priceChange24h > 3) score += 2;
        else if (priceChange24h > 1) score += 1;
        else if (priceChange24h < -3) score -= 2;
        else if (priceChange24h < -1) score -= 1;

        // RSI factor
        if (rsi) {
            if (rsi > 70) score -= 1; // Overbought
            else if (rsi > 55) score += 1;
            else if (rsi < 30) score += 1; // Oversold, potential bounce
            else if (rsi < 45) score -= 1;
        }

        // Stochastic RSI factor
        if (stochRSI) {
            if (stochRSI > 80) score -= 0.5;
            else if (stochRSI > 60) score += 0.5;
            else if (stochRSI < 20) score += 0.5;
            else if (stochRSI < 40) score -= 0.5;
        }

        // Moving average factor
        if (sma7 && currentPrice) {
            if (currentPrice > sma7) score += 1;
            else score -= 1;
        }

        if (ema7 && currentPrice) {
            if (currentPrice > ema7) score += 0.5;
            else score -= 0.5;
        }

        // Determine trend based on score
        if (score >= 3) return 'GÜÇLÜ YÜKSELİŞ';
        if (score >= 1) return 'YÜKSELİŞ';
        if (score <= -3) return 'GÜÇLÜ DÜŞÜŞ';
        if (score <= -1) return 'DÜŞÜŞ';
        return 'NÖTR';
    }

    /**
     * Generate human-readable commentary
     */
    generateCommentary(trend, indicators, priceChange24h) {
        let commentary = [];

        // Trend commentary
        switch (trend) {
            case 'GÜÇLÜ YÜKSELİŞ':
                commentary.push('Bitcoin güçlü bir yükseliş trendinde.');
                break;
            case 'YÜKSELİŞ':
                commentary.push('Bitcoin yükseliş eğilimi gösteriyor.');
                break;
            case 'DÜŞÜŞ':
                commentary.push('Bitcoin düşüş eğilimi gösteriyor.');
                break;
            case 'GÜÇLÜ DÜŞÜŞ':
                commentary.push('Bitcoin güçlü bir düşüş trendinde.');
                break;
            default:
                commentary.push('Bitcoin nötral bir seyir izliyor.');
        }

        // Price change commentary
        commentary.push(`24 saatlik değişim: %${priceChange24h}.`);

        // RSI commentary
        if (indicators.rsi) {
            if (indicators.rsiInterpretation === 'OVERBOUGHT') {
                commentary.push('RSI aşırı alım bölgesinde, düzeltme olasılığı var.');
            } else if (indicators.rsiInterpretation === 'OVERSOLD') {
                commentary.push('RSI aşırı satım bölgesinde, toparlanma fırsatı olabilir.');
            }
        }

        // Stochastic RSI commentary
        if (indicators.stochRSI) {
            if (indicators.stochRSIInterpretation === 'OVERBOUGHT') {
                commentary.push('Stochastic RSI yüksek seviyelerde.');
            } else if (indicators.stochRSIInterpretation === 'OVERSOLD') {
                commentary.push('Stochastic RSI düşük seviyelerde.');
            }
        }

        return commentary.join(' ');
    }

    /**
     * Get comprehensive market analysis for all USDT pairs
     */
    async getMarketAnalysis() {
        try {
            const [tickers, btcAnalysis] = await Promise.all([
                binanceService.get24hrTickers(),
                this.analyzeBTCStatus()
            ]);

            // Process limited number of coins for performance
            // We can add pagination later
            const topCoins = tickers
                .sort((a, b) => b.quoteVolume - a.quoteVolume)
                .slice(0, 50); // Top 50 by volume

            return {
                btcAnalysis,
                totalPairs: tickers.length,
                analyzedPairs: topCoins.length,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting market analysis:', error.message);
            throw error;
        }
    }
}

module.exports = new AnalysisService();
