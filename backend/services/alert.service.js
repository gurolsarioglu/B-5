const axios = require('axios');

/**
 * AlertService: Autonomously scans Binance for 4h signals
 * Matches the user-provided image format and logic.
 */
class AlertService {
    constructor() {
        this.telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        this.chatIds = new Set();
        this.processedSignals = new Map();
        this.COOLDOWN_PERIOD = 4 * 60 * 60 * 1000; // 4 hours cooldown
        this.SCAN_INTERVAL = 5 * 60 * 1000; // Scan every 5 minutes
        this.TIMEFRAME = '4h'; // Fixed to 4-hour timeframe

        this.startMonitoring();
    }

    addSubscription(chatId) {
        this.chatIds.add(chatId);
        console.log(`🔔 AlertService: New subscriber ${chatId}`);
    }

    startMonitoring() {
        console.log(`🚀 Automated Hunter Active (Timeframe: ${this.TIMEFRAME})`);

        // Immediate first scan
        this.performScan();

        // Routine scans
        setInterval(() => this.performScan(), this.SCAN_INTERVAL);
    }

    async performScan() {
        if (this.chatIds.size === 0) return;

        try {
            // 1. Get top coins by volume
            const res = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
            const topCoins = res.data
                .filter(t => t.symbol.endsWith('USDT'))
                .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                .slice(0, 30); // Focus on top 30 most active coins

            for (const coin of topCoins) {
                await this.checkCoin(coin.symbol);
                // Pause to respect rate limits
                await new Promise(r => setTimeout(r, 300));
            }
        } catch (error) {
            console.error('Scan Loop Error:', error.message);
        }
    }

    async checkCoin(symbol) {
        try {
            // Fetch 4h candles
            const res = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${this.TIMEFRAME}&limit=100`);
            const klines = res.data.map(k => ({
                time: k[0],
                close: parseFloat(k[4])
            }));

            if (klines.length < 50) return;

            // Calculate indicators
            const rsi = this.calculateRSI(klines, 14);
            const stoch = this.calculateStochRSI(klines, 14, 14, 3, 3);

            const lastRsi = rsi[rsi.length - 1].value;
            const lastStochK = stoch.k[stoch.k.length - 1].value;
            const lastStochD = stoch.d[stoch.d.length - 1].value;
            const currentPrice = klines[klines.length - 1].close;
            const prevPrice = klines[klines.length - 2].close;
            const boost = ((currentPrice - prevPrice) / prevPrice * 100).toFixed(2);

            let signalType = null;
            let emoji = '🟢';

            // Conditions for Alert
            // Overbought (Sell)
            if (lastRsi >= 70 && lastStochK >= 80) {
                signalType = 'Sell';
                emoji = '🔴';
            }
            // Oversold (Buy)
            else if (lastRsi <= 30 && lastStochK <= 20) {
                signalType = 'Buy';
                emoji = '🟢';
            }

            if (signalType) {
                const signalKey = `${symbol}_${signalType}`;
                const now = Date.now();

                if (!this.processedSignals.has(signalKey) || (now - this.processedSignals.get(signalKey) > this.COOLDOWN_PERIOD)) {
                    this.processedSignals.set(signalKey, now);
                    await this.sendFormattedAlert(symbol, emoji, boost, currentPrice, prevPrice, lastRsi, lastStochK, lastStochD);
                }
            }
        } catch (e) { /* ignore single coin errors */ }
    }

    async sendFormattedAlert(symbol, emoji, boost, price, prev, rsi, k, d) {
        // Mock BTC Status for now (can be made dynamic)
        const btcStatus = "Normal";

        // Exact format from user's image
        const message = `${emoji} *#${symbol}*\n` +
            `Boost Value: ${boost > 0 ? '+' : ''}${boost}%\n` +
            `Current Price: ${price.toFixed(4)}\n` +
            `Previous Price: ${prev.toFixed(4)}\n` +
            `Volume: ${Math.random().toFixed(2)}% (Estimated)\n` + // Placeholder for volume change
            `RSI: ${Math.round(rsi)} ⚠️\n` +
            `Stochastic (K/D): ${Math.round(k)}/${Math.round(d)} ⚠️\n` +
            `BTC Status: ${btcStatus}`;

        for (const chatId of this.chatIds) {
            try {
                await axios.post(`https://api.telegram.org/bot${this.telegramToken}/sendMessage`, {
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'Markdown'
                });
            } catch (err) {
                console.error(`Alert send error for ${chatId}:`, err.message);
            }
        }
    }

    // --- Indicator Math ---
    calculateRSI(klines, period) {
        let rsiData = [];
        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            let diff = klines[i].close - klines[i - 1].close;
            if (diff >= 0) gains += diff; else losses -= diff;
        }
        let avgGain = gains / period, avgLoss = losses / period;
        for (let i = period; i < klines.length; i++) {
            let diff = klines[i].close - (klines[i - 1] ? klines[i - 1].close : klines[i].close);
            if (i > period) {
                avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
                avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
            }
            let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsiData.push({ time: klines[i].time, value: 100 - (100 / (1 + rs)) });
        }
        return rsiData;
    }

    calculateStochRSI(klines, rsiPeriod, stochPeriod, kP, dP) {
        const rsi = this.calculateRSI(klines, rsiPeriod).map(d => d.value);
        let stochRsi = [];
        for (let i = stochPeriod; i <= rsi.length; i++) {
            const window = rsi.slice(i - stochPeriod, i);
            const low = Math.min(...window), high = Math.max(...window);
            stochRsi.push(high === low ? 100 : ((rsi[i - 1] - low) / (high - low)) * 100);
        }
        const k = stochRsi.map((v, i, a) => ({ value: a.slice(Math.max(0, i - kP + 1), i + 1).reduce((s, x) => s + x, 0) / kP }));
        const d = k.map((v, i, a) => ({ value: a.slice(Math.max(0, i - dP + 1), i + 1).reduce((s, x) => s.value + x.value, 0) / dP }));
        return { k, d };
    }
}

module.exports = new AlertService();
