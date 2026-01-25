const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load config
dotenv.config({ path: path.join(__dirname, '.env') });

const token = process.env.HUNTER_SPECIAL_TOKEN;
if (!token) {
    console.error("❌ HUNTER_SPECIAL_TOKEN eksik! .env dosyasını kontrol edin.");
    process.exit(1);
}
const bot = new TelegramBot(token, { polling: true });

const chatIds = new Set();
// Track prices for boost calculation: Symbol -> { price, time }
const priceTracker = new Map();
// Prevent spamming the same coin: Symbol -> timestamp
const lastAlertTime = new Map();
// Store active pairs and their onboarding time
let activeSymbols = new Map(); // Symbol -> Onboard Date (ms)

const BOOST_THRESHOLD = 1.0; // %1.0 instant change
const BOOST_WINDOW_MS = 60 * 1000; // 1 minute window for boost
const ALERT_COOLDOWN = 15 * 60 * 1000; // 15 mins cooldown per coin
const MAX_COIN_AGE_DAYS = 20; // "New" status threshold (User requested 20 days)

console.log('⚡ CoinKe Special Bot (Dashboard Mode) Aktif!');

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    chatIds.add(chatId);
    console.log(`✅ Yeni kayıt (Special): ${chatId} - ${msg.from.first_name}`);
    bot.sendMessage(chatId, "🚀 *CoinKe Dashboard Bot Aktif!*\n\nAni fiyat hareketlerinde detaylı teknik analiz paneli göndereceğim.");
});

// --- INITIALIZATION ---
async function init() {
    await updateExchangeInfo();
    // Refresh exchange info every hour
    setInterval(updateExchangeInfo, 60 * 60 * 1000);
    // Start monitoring
    monitorMarket();
}

async function updateExchangeInfo() {
    try {
        console.log('🔄 Exchange Info güncelleniyor...');
        const res = await axios.get('https://fapi.binance.com/fapi/v1/exchangeInfo');
        const now = Date.now();
        activeSymbols.clear();
        res.data.symbols.forEach(s => {
            if (s.quoteAsset === 'USDT' && s.status === 'TRADING') {
                activeSymbols.set(s.symbol, s.onboardDate);
            }
        });
        console.log(`✅ ${activeSymbols.size} aktif çift yüklendi.`);
    } catch (e) {
        console.error('❌ Exchange Info yüklenemedi:', e.message);
    }
}

// --- CORE ANALYTICS ---

async function getKlines(symbol, interval, limit = 100) {
    try {
        const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
        return res.data.map(k => ({
            time: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            // hlc3 for wavetrend
            hlc3: (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3
        }));
    } catch (e) {
        console.error(`Kline fetch error (${symbol} ${interval}):`, e.message);
        return [];
    }
}

async function analyzeCoin(symbol, currentPrice, previousPrice, boostPercent) {
    if (chatIds.size === 0) return;

    // Parallel fetch for 1m, 5m, 15m, 1h
    const [k1m, k5m, k15m, k1h, kBTC] = await Promise.all([
        getKlines(symbol, '1m', 60),
        getKlines(symbol, '5m', 60),
        getKlines(symbol, '15m', 60),
        getKlines(symbol, '1h', 60),
        getKlines('BTCUSDT', '15m', 20) // For BTC Volatility
    ]);

    if (!k1m.length || !k5m.length || !k15m.length || !k1h.length) return;

    // --- INDICATOR CALCULATIONS ---
    const i1m = calculateAllIndicators(k1m);
    const i5m = calculateAllIndicators(k5m);
    const i15m = calculateAllIndicators(k15m);
    const i1h = calculateAllIndicators(k1h);

    const btcVolatility = calculateVolatility(kBTC);
    const isNewCoin = (Date.now() - (activeSymbols.get(symbol) || 0)) < (MAX_COIN_AGE_DAYS * 24 * 60 * 60 * 1000);
    const ageDays = Math.floor((Date.now() - (activeSymbols.get(symbol) || 0)) / (1000 * 60 * 60 * 24));

    // --- MESSAGE FORMATTING ---
    const cleanSymbol = symbol.replace('USDT', '');
    const directionEmoji = boostPercent > 0 ? '🟢' : '🔴';
    const boostStr = `${boostPercent > 0 ? '+' : ''}${boostPercent}%`;

    // Helper for RSI formatting (warn if >= 80 -> !!!, <= 20 -> !!!, etc)
    const fmtRSI = (val) => {
        const v = Math.round(val);
        let warn = '';
        if (v >= 80) warn = '❗❗❗';
        // If user didn't specify low, maybe just keep it simple or add one ! for low.
        // User text: "80 eşit ve büyükse 3 ünlem"

        return `${v}${warn}`;
    };

    // Helper for Stoch formatting
    const fmtStoch = (k, d) => `${Math.round(k)}/${Math.round(d)}`;

    // Helper for Divergence
    const fmtDiv = (div) => div ? '✅' : '➖';

    // Helper for WT Cross (Red/Green circle)
    const fmtWT = (wt) => {
        if (wt.cross === 'Bullish') return '🟢';
        if (wt.cross === 'Bearish') return '🔴';
        return '➖';
    };

    // New CLEAN Format
    const msg =
        `${directionEmoji} #${symbol}

Boost Value: ${boostStr}
Current Price: ${currentPrice}

*RSI:* 1m:${fmtRSI(i1m.rsi)} | 5m:${fmtRSI(i5m.rsi)} | 15m:${fmtRSI(i15m.rsi)} | 1h:${fmtRSI(i1h.rsi)}
*SRSI:* 1m:${fmtStoch(i1m.stoch.k, i1m.stoch.d)} | 5m:${fmtStoch(i5m.stoch.k, i5m.stoch.d)} | 15m:${fmtStoch(i15m.stoch.k, i15m.stoch.d)} | 1h:${fmtStoch(i1h.stoch.k, i1h.stoch.d)}

*Divergence:* 1m${fmtDiv(i1m.div)} 5m${fmtDiv(i5m.div)} 15m${fmtDiv(i15m.div)} 1h${fmtDiv(i1h.div)}
*WT Cross:* 1m${fmtWT(i1m.wt)} 5m${fmtWT(i5m.wt)} 15m${fmtWT(i15m.wt)} 1h${fmtWT(i1h.wt)}

*BTC Status:* ${btcVolatility ? 'Volatilite ⚡' : 'Normal'}
*Coin Status:* ${isNewCoin ? `Yeni (${ageDays}g) ❗` : 'Normal'}
`;

    // Send
    for (const id of chatIds) {
        bot.sendMessage(id, msg, { parse_mode: 'Markdown' });
    }
}

function calculateAllIndicators(klines) {
    // We need closed candles mostly, but for "current" status we often use the latest incomplete one too.
    // However, usually indicators are safer on Closed. Let's use all.
    const rsi = calculateRSI(klines.map(k => k.close), 14);
    const stoch = calculateStochRSI(klines.map(k => k.close), 14, 14, 3, 3);
    const wt = calculateWaveTrend(klines);
    const div = detectDivergence(klines, rsi);

    return {
        rsi: rsi[rsi.length - 1],
        stoch: stoch, // {k, d}
        wt: wt, // {wt1, wt2, cross}
        div: div // boolean
    };
}

// --- MATH & INDICATORS ---

function calculateRSI(closes, period = 14) {
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        let diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    let rsiArr = [100 - (100 / (1 + (avgGain / avgLoss || 1)))];

    for (let i = period + 1; i < closes.length; i++) {
        let diff = closes[i] - closes[i - 1];
        avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
        rsiArr.push(100 - (100 / (1 + (avgGain / avgLoss || 1))));
    }
    return rsiArr;
}

function calculateStochRSI(closes, rsiPeriod, stochPeriod, kPeriod, dPeriod) {
    const rsi = calculateRSI(closes, rsiPeriod);
    // Simple latest calc
    if (rsi.length < stochPeriod) return { k: 50, d: 50 };

    // Calculate last Stoch K
    let currentRSI = rsi[rsi.length - 1];
    let rsiWindow = rsi.slice(-stochPeriod);
    let minRSI = Math.min(...rsiWindow);
    let maxRSI = Math.max(...rsiWindow);
    let stochVal = (currentRSI - minRSI) / (maxRSI - minRSI || 1) * 100;

    return { k: stochVal, d: stochVal }; // Simply returning K for display (simplified)
}

function calculateWaveTrend(klines) {
    const n1 = 10;
    const n2 = 21;
    const ap = klines.map(k => k.hlc3);

    // EMA function
    const ema = (data, len) => {
        const k = 2 / (len + 1);
        let res = [data[0]];
        for (let i = 1; i < data.length; i++) {
            res.push(data[i] * k + res[i - 1] * (1 - k));
        }
        return res;
    };

    const esa = ema(ap, n1);
    const d = ema(ap.map((v, i) => Math.abs(v - esa[i])), n1);
    const ci = ap.map((v, i) => (v - esa[i]) / (0.015 * d[i] || 1));
    const wt1 = ema(ci, n2); // tci

    // SMA for wt2
    const sma = (data, len) => {
        let res = [];
        for (let i = 0; i < data.length; i++) {
            if (i < len - 1) { res.push(data[i]); continue; }
            let sum = 0;
            for (let j = 0; j < len; j++) sum += data[i - j];
            res.push(sum / len);
        }
        return res;
    };

    const wt2 = sma(wt1, 4);

    const last = wt1.length - 1;
    const currWT1 = wt1[last];
    const currWT2 = wt2[last];
    const prevWT1 = wt1[last - 1];
    const prevWT2 = wt2[last - 1];

    // Detect Cross
    let cross = null;
    if (prevWT1 < prevWT2 && currWT1 > currWT2) cross = 'Bullish';
    else if (prevWT1 > prevWT2 && currWT1 < currWT2) cross = 'Bearish';

    return { wt1: currWT1, wt2: currWT2, cross };
}

function detectDivergence(klines, rsi) {
    // Simply check last 5 candles for regular divergence (Price LL vs RSI HL)
    const len = klines.length;
    if (len < 10) return false;

    // Look for pivot
    // Very simplified check: Price drops but RSI rises (Bullish Div)
    const priceLast = klines[len - 1].close;
    const pricePrev = klines[len - 5].close;
    const rsiLast = rsi[len - 1];
    const rsiPrev = rsi[len - 5];

    if (priceLast < pricePrev && rsiLast > rsiPrev) return true; // Bullish
    if (priceLast > pricePrev && rsiLast < rsiPrev) return true; // Bearish

    return false;
}

function calculateVolatility(klines) {
    if (!klines || klines.length < 5) return false;
    // Average body size
    let sumBody = 0;
    klines.forEach(k => sumBody += Math.abs(k.close - k.open));
    const avg = sumBody / klines.length;
    const last = Math.abs(klines[klines.length - 1].close - klines[klines.length - 1].open);

    return last > avg * 1.5; // If last candle is 1.5x larger than avg
}


// --- MAIN LOOP ---

async function monitorMarket() {
    try {
        const res = await axios.get('https://fapi.binance.com/fapi/v1/ticker/price');
        const now = Date.now();

        for (const item of res.data) {
            const sym = item.symbol;
            if (!sym.endsWith('USDT')) continue;

            const price = parseFloat(item.price);

            // Initial track
            if (!priceTracker.has(sym)) {
                priceTracker.set(sym, { price, time: now });
                continue;
            }

            const prev = priceTracker.get(sym);
            // Check time window
            if (now - prev.time > BOOST_WINDOW_MS) {
                // Update baseline
                priceTracker.set(sym, { price, time: now });
                continue;
            }

            // Check Perc Change
            const perc = ((price - prev.price) / prev.price) * 100;

            if (Math.abs(perc) >= BOOST_THRESHOLD) {
                // Check Cooldown
                if (!lastAlertTime.has(sym) || (now - lastAlertTime.get(sym) > ALERT_COOLDOWN)) {
                    console.log(`🚀 BOOST DETECTED: ${sym} ${perc.toFixed(2)}%`);
                    lastAlertTime.set(sym, now);
                    priceTracker.set(sym, { price, time: now }); // reset baseline

                    analyzeAndSend(sym, price, prev.price, perc.toFixed(2));
                }
            }
        }
    } catch (e) {
        console.error('Monitor Tick Error:', e.message);
    }

    setTimeout(monitorMarket, 2000); // Check every 2 seconds
}

// Wrapper for async analysis
async function analyzeAndSend(symbol, curr, prev, boost) {
    await analyzeCoin(symbol, curr, prev, boost);
}

// Start
init();
