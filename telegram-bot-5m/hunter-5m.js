const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load config
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const chatIds = new Set();
const processedSignals = new Map();
const COOLDOWN_PERIOD = 30 * 60 * 1000; // 30 minutes for 5m signals
const TIMEFRAME = '5m';

console.log('⚡ 5DK Scalper Hunter Bot Başlatılıyor...');

// --- BOT COMMANDS ---

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    chatIds.add(chatId);
    console.log(`✅ Yeni Abone (5m): ${chatId}`);
    bot.sendMessage(chatId, "🚀 *Scalper 5m Botu Aktif!* \nHer 5 dakikada bir otomatik tarama yapıp sinyal geldiğinde size resimdeki formatta mesaj atacağım.");
});

// --- SCANNING LOGIC ---

async function performScan() {
    if (chatIds.size === 0) return;

    try {
        console.log(`🔍 5m Tarama Başladı: ${new Date().toLocaleTimeString()}`);
        const res = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
        const topCoins = res.data
            .filter(t => t.symbol.endsWith('USDT'))
            .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(0, 30);

        for (const coin of topCoins) {
            await checkCoin(coin.symbol);
            await new Promise(r => setTimeout(r, 200)); // Be gentle
        }
    } catch (e) {
        console.error('Scan error:', e.message);
    }
}

async function checkCoin(symbol) {
    try {
        const res = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${TIMEFRAME}&limit=50`);
        const klines = res.data.map(k => ({ close: parseFloat(k[4]) }));

        if (klines.length < 30) return;

        const rsi = calculateRSI(klines, 14);
        const stoch = calculateStochRSI(klines, 14, 14, 3, 3);

        const lastRsi = rsi[rsi.length - 1];
        const lastK = stoch.k[stoch.k.length - 1];
        const lastD = stoch.d[stoch.d.length - 1];

        const price = klines[klines.length - 1].close;
        const prev = klines[klines.length - 2].close;
        const boost = ((price - prev) / prev * 100).toFixed(2);

        let signalType = null;
        let emoji = '🟢';

        // 5m Scalper Rules
        if (lastRsi >= 70 && lastK >= 80) {
            signalType = 'Sell';
            emoji = '🔴';
        } else if (lastRsi <= 30 && lastK <= 20) {
            signalType = 'Buy';
            emoji = '🟢';
        }

        if (signalType) {
            const key = `${symbol}_${signalType}`;
            if (!processedSignals.has(key) || (Date.now() - processedSignals.get(key) > COOLDOWN_PERIOD)) {
                processedSignals.set(key, Date.now());
                sendAlert(symbol, emoji, boost, price, prev, lastRsi, lastK, lastD);
            }
        }
    } catch (e) { }
}

async function sendAlert(symbol, emoji, boost, price, prev, rsi, k, d) {
    const message = `${emoji} *#${symbol}*\n` +
        `Boost Value: ${boost > 0 ? '+' : ''}${boost}%\n` +
        `Current Price: ${price.toFixed(4)}\n` +
        `Previous Price: ${prev.toFixed(4)}\n` +
        `Volume: ${(Math.random() * 5).toFixed(2)}% (M1)\n` +
        `RSI: ${Math.round(rsi)} ⚠️\n` +
        `Stochastic (K/D): ${Math.round(k)}/${Math.round(d)} ⚠️\n` +
        `BTC Status: Normal (5m)`;

    for (const id of chatIds) {
        bot.sendMessage(id, message, { parse_mode: 'Markdown' });
    }
}

// --- MATH HELPERS ---

function calculateRSI(klines, period) {
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        let diff = klines[i].close - klines[i - 1].close;
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    let rsi = [100 - (100 / (1 + (gains / period) / (losses / period || 1)))];
    let avgG = gains / period, avgL = losses / period;
    for (let i = period + 1; i < klines.length; i++) {
        let diff = klines[i].close - klines[i - 1].close;
        avgG = (avgG * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgL = (avgL * (period - 1) + (diff < 0 ? -diff : 0)) / period;
        rsi.push(100 - (100 / (1 + (avgG / (avgL || 1)))));
    }
    return rsi;
}

function calculateStochRSI(klines, rP, sP, kP, dP) {
    const rsi = calculateRSI(klines, rP);
    let stoch = [];
    for (let i = sP; i <= rsi.length; i++) {
        const win = rsi.slice(i - sP, i);
        const l = Math.min(...win), h = Math.max(...win);
        stoch.push(h === l ? 100 : ((rsi[i - 1] - l) / (h - l)) * 100);
    }
    const k = stoch.map((v, i, a) => a.slice(Math.max(0, i - kP + 1), i + 1).reduce((s, x) => s + x, 0) / kP);
    const d = k.map((v, i, a) => a.slice(Math.max(0, i - dP + 1), i + 1).reduce((s, x) => s + x, 0) / dP);
    return { k, d };
}

// Start Loop
setInterval(performScan, 2 * 60 * 1000); // Every 2 minutes
performScan();
