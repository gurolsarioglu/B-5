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
const priceTracker = new Map();
const lastAlertTime = new Map();
const lastDivAlertTime = new Map();
let activeSymbols = new Map();

const BOOST_THRESHOLD = 2.0;
const BOOST_WINDOW_MS = 60 * 1000;
const ALERT_COOLDOWN = 15 * 60 * 1000;
const DIV_COOLDOWN = 4 * 60 * 60 * 1000;
const MAX_COIN_AGE_DAYS = 20;

console.log('⚡ CoinKe Special Bot (Advanced Divergence + On-Demand) Aktif!');

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    chatIds.add(chatId);
    console.log(`✅ Yeni kayıt (Special): ${chatId} - ${msg.from.first_name}`);
    bot.sendMessage(chatId, "🚀 *CoinKe Special (Divergence Avcısı) Aktif!*\n\n• 1 Saatlik grafiklerde uyumsuzlukları takip ediyorum.\n• Bir coin ismi yazarsan (Örn: BTC) anında analiz yaparım!");
});

// --- INITIALIZATION ---
async function init() {
    await updateExchangeInfo();
    setInterval(updateExchangeInfo, 60 * 60 * 1000);

    // Monitor 1: Rapid Price Changes
    monitorMarket();

    // Monitor 2: Periodic 1H Divergence Scan
    scanDeepDivergences();
    setInterval(scanDeepDivergences, 10 * 60 * 1000);
}

// --- ON-DEMAND ANALYSIS (TELEGRAM MESSAGE LISTENER) ---
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.toUpperCase().trim();
    if (!text || text.startsWith('/')) return;

    let symbol = text;
    if (!symbol.endsWith('USDT')) symbol += 'USDT';

    if (activeSymbols.has(symbol)) {
        bot.sendMessage(chatId, `🔍 *#${symbol} inceleniyor, saniyeler içinde cevap geliyor...*`, { parse_mode: 'Markdown' });
        await analyzeOnDemand(chatId, symbol);
    }
});

async function analyzeOnDemand(chatId, symbol) {
    try {
        const [k1h, k15m, k5m] = await Promise.all([
            getKlines(symbol, '1h', 100),
            getKlines(symbol, '15m', 60),
            getKlines(symbol, '5m', 60)
        ]);

        if (!k1h.length) return;

        const currentPrice = k1h[k1h.length - 1].close;
        const rsi1h = calculateRSI(k1h.map(k => k.close), 14);
        const div = detectPivotDivergence(k1h, rsi1h);

        const i15m = calculateAllIndicators(k15m);
        const i5m = calculateAllIndicators(k5m);

        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const binanceUrl = `https://www.binance.com/en/futures/${symbol}`;

        let header = `📊 *#${symbol} DETAYLI TEKNİK RAPOR*`;
        let divInfo = div ? `⚠️ *${div.type}* | *${div.target}*` : `➖ Uyumsuzluk Tespit Edilmedi.`;

        let tp = div ? (div.target === 'SHORT' ? (currentPrice * 0.90).toFixed(4) : (currentPrice * 1.10).toFixed(4)) : (currentPrice * 1.10).toFixed(4);
        let sl = div ? div.sl.toFixed(4) : (currentPrice * 0.95).toFixed(4);

        const msg =
            `${header}\n` +
            `----------------------------------\n` +
            `💰 *Fiyat:* ${currentPrice.toFixed(4)}\n` +
            `📢 *Uyumsuzluk:* ${divInfo}\n` +
            `----------------------------------\n` +
            `📉 *RSI (1sa):* ${Math.round(rsi1h[rsi1h.length - 1])}\n` +
            `📊 *RSI (15dk):* ${Math.round(i15m.rsi)}\n` +
            `📊 *RSI (5dk):* ${Math.round(i5m.rsi)}\n` +
            `──────────────────\n` +
            `✅ *ONAYLAR:*\n` +
            `• 15m WT: ${i15m.wt.cross || '➖'} | Stoch: ${Math.round(i15m.stoch.k)}/${Math.round(i15m.stoch.d)}\n` +
            `• 5m WT: ${i5m.wt.cross || '➖'}\n` +
            `──────────────────\n` +
            `🎯 *Strateji Hedefi (%10):* ${tp}\n` +
            `🛑 *Stop Loss:* ${sl}\n` +
            `──────────────────\n` +
            `🔗 [Binance Futures](${binanceUrl}) | ⏰ ${now}`;

        bot.sendMessage(chatId, msg, { parse_mode: 'Markdown', disable_web_page_preview: true });

    } catch (e) {
        bot.sendMessage(chatId, `❌ *Analiz Hatası:* ${symbol} verileri alınamadı.`);
    }
}

// --- CORE SCANNER & PIVOT LOGIC ---

async function scanDeepDivergences() {
    if (chatIds.size === 0) return;
    const symbols = Array.from(activeSymbols.keys());
    for (let i = 0; i < symbols.length; i += 20) {
        const chunk = symbols.slice(i, i + 20);
        await Promise.all(chunk.map(s => checkDivergence(s)));
        await new Promise(r => setTimeout(r, 500));
    }
}

async function checkDivergence(symbol) {
    try {
        const k1h = await getKlines(symbol, '1h', 100);
        if (k1h.length < 50) return;
        const rsi1h = calculateRSI(k1h.map(k => k.close), 14);
        const divergence = detectPivotDivergence(k1h, rsi1h);
        if (divergence) {
            const now = Date.now();
            if (!lastDivAlertTime.has(symbol) || (now - lastDivAlertTime.get(symbol) > DIV_COOLDOWN)) {
                lastDivAlertTime.set(symbol, now);
                await sendDivergenceAlert(symbol, divergence, k1h[k1h.length - 1].close);
            }
        }
    } catch (e) { }
}

function detectPivotDivergence(candles, rsi) {
    const prices = candles.map(k => k.high);
    const lows = candles.map(k => k.low);
    const pHighs = findPivots(prices, 3);
    if (pHighs.length >= 2) {
        const last = pHighs[pHighs.length - 1];
        const prev = pHighs[pHighs.length - 2];
        if (last.val > prev.val && rsi[last.idx] < rsi[prev.idx] && rsi[last.idx] > 60) {
            return { type: 'AYI UYUMSUZLUĞU (BEARISH) 🔴', target: 'SHORT', rsi: rsi[last.idx], sl: last.val * 1.01 };
        }
    }
    const pLows = findPivots(lows, 3, false);
    if (pLows.length >= 2) {
        const last = pLows[pLows.length - 1];
        const prev = pLows[pLows.length - 2];
        if (last.val < prev.val && rsi[last.idx] > rsi[prev.idx] && rsi[last.idx] < 40) {
            return { type: 'BOĞA UYUMSUZLUĞU (BULLISH) 🟢', target: 'LONG', rsi: rsi[last.idx], sl: last.val * 0.99 };
        }
    }
    return null;
}

function findPivots(data, window, isHigh = true) {
    let pivots = [];
    for (let i = window; i < data.length - window; i++) {
        let isPivot = true;
        for (let j = 1; j <= window; j++) {
            if (isHigh) {
                if (data[i] <= data[i - j] || data[i] <= data[i + j]) isPivot = false;
            } else {
                if (data[i] >= data[i - j] || data[i] >= data[i + j]) isPivot = false;
            }
        }
        if (isPivot) pivots.push({ val: data[i], idx: i });
    }
    return pivots;
}

// --- ALERTS ---

async function sendDivergenceAlert(symbol, div, price) {
    const [k5m, k15m] = await Promise.all([
        getKlines(symbol, '5m', 50),
        getKlines(symbol, '15m', 50)
    ]);
    const i5m = calculateAllIndicators(k5m);
    const i15m = calculateAllIndicators(k15m);
    const tp10 = div.target === 'SHORT' ? (price * 0.90).toFixed(4) : (price * 1.10).toFixed(4);
    const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const binanceUrl = `https://www.binance.com/en/futures/${symbol}`;
    const msg =
        `🚨 *OTOMATİK UYUMSUZLUK TESPİTİ (1H)*\n` +
        `----------------------------------\n` +
        `💎 *#${symbol}*\n` +
        `📢 *${div.type}* | *${div.target}*\n` +
        `----------------------------------\n` +
        `💰 *Giriş:* ${price.toFixed(4)}\n` +
        `🎯 *Hedef (%10):* ${tp10}\n` +
        `🛑 *Stop Loss:* ${div.sl.toFixed(4)}\n` +
        `──────────────────\n` +
        `📉 *RSI (1saat):* ${Math.round(div.rsi)} (Uyumsuzluk)\n` +
        `📊 *RSI (15dk):* ${Math.round(i15m.rsi)}\n` +
        `📊 *RSI (5dk):* ${Math.round(i5m.rsi)}\n` +
        `──────────────────\n` +
        `✅ *ONAYLAR (Alt Zaman Dilimi):*\n` +
        `• 15m WT: ${i15m.wt.cross || '➖'}\n` +
        `• 5m WT: ${i5m.wt.cross || '➖'}\n` +
        `──────────────────\n` +
        `🔗 [Binance Futures](${binanceUrl}) | ⏰ ${now}`;

    for (const id of chatIds) {
        bot.sendMessage(id, msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
    }
}

// --- HELPERS ---

async function getKlines(symbol, interval, limit = 100) {
    try {
        const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
        return res.data.map(k => ({
            time: k[0], close: parseFloat(k[4]), high: parseFloat(k[2]), low: parseFloat(k[3]),
            hlc3: (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3
        }));
    } catch (e) { return []; }
}

function calculateAllIndicators(klines) {
    if (!klines.length) return { rsi: 50, stoch: { k: 50, d: 50 }, wt: { cross: null } };
    const closes = klines.map(k => k.close);
    const rsi = calculateRSI(closes, 14);
    const stoch = calculateStochRSI(closes, 14, 14, 3, 3);
    const wt = calculateWaveTrend(klines);
    return {
        rsi: rsi[rsi.length - 1],
        stoch: { k: stoch.k[stoch.k.length - 1], d: stoch.d[stoch.d.length - 1] },
        wt: wt
    };
}

function calculateRSI(closes, period = 14) {
    if (closes.length <= period) return Array(closes.length).fill(50);
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period; i++) {
        let diff = closes[i] - closes[i - 1];
        if (diff >= 0) avgGain += diff; else avgLoss -= diff;
    }
    avgGain /= period; avgLoss /= period;
    let rsiArr = new Array(period).fill(50);
    rsiArr.push(100 - (100 / (1 + (avgGain / (avgLoss || 1)))));
    for (let i = period + 1; i < closes.length; i++) {
        let diff = closes[i] - closes[i - 1];
        avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
        rsiArr.push(100 - (100 / (1 + (avgGain / (avgLoss || 1)))));
    }
    return rsiArr;
}

function calculateStochRSI(d, rP, sP, kP, dP) {
    const r = calculateRSI(d, rP);
    let s = [];
    for (let i = sP; i <= r.length; i++) {
        let w = r.slice(i - sP, i);
        let low = Math.min(...w), h = Math.max(...w);
        if (h === low) s.push(100);
        else {
            const logStoch = Math.log(Math.max(r[i - 1], 0.01) / Math.max(low, 0.01)) / Math.log(Math.max(h, 0.01) / Math.max(low, 0.01));
            s.push(logStoch * 100);
        }
    }
    const kData = s.map((v, i, a) => a.slice(Math.max(0, i - kP + 1), i + 1).reduce((p, c) => p + c, 0) / kP);
    const dData = kData.map((v, i, a) => a.slice(Math.max(0, i - dP + 1), i + 1).reduce((p, c) => p + c, 0) / dP);
    return { k: kData, d: dData };
}

function calculateWaveTrend(klines) {
    const n1 = 10, n2 = 21;
    const ap = klines.map(k => k.hlc3);
    if (ap.length < n2) return { wt1: 0, wt2: 0, cross: null };
    const ema = (data, len) => {
        const k = 2 / (len + 1);
        let res = [data[0]];
        for (let i = 1; i < data.length; i++) res.push(data[i] * k + res[i - 1] * (1 - k));
        return res;
    };
    const esa = ema(ap, n1);
    const d = ema(ap.map((v, i) => Math.abs(v - esa[i])), n1);
    const ci = ap.map((v, i) => (v - esa[i]) / (0.015 * d[i] || 1));
    const wt1 = ema(ci, n2);
    const wt2 = wt1.map((v, i, a) => a.slice(Math.max(0, i - 3), i + 1).reduce((s, c) => s + c, 0) / (i < 3 ? i + 1 : 4));
    let cross = null;
    const last = wt1.length - 1;
    if (wt1[last - 1] < wt2[last - 1] && wt1[last] > wt2[last]) cross = 'Yükseliş 🟢';
    else if (wt1[last - 1] > wt2[last - 1] && wt1[last] < wt2[last]) cross = 'Düşüş 🔴';
    return { wt1: wt1[last], wt2: wt2[last], cross };
}

// --- MARKET MONITOR ---

async function updateExchangeInfo() {
    try {
        const res = await axios.get('https://fapi.binance.com/fapi/v1/exchangeInfo');
        activeSymbols.clear();
        res.data.symbols.forEach(s => {
            if (s.quoteAsset === 'USDT' && s.status === 'TRADING') activeSymbols.set(s.symbol, s.onboardDate);
        });
        console.log(`✅ ${activeSymbols.size} aktif çift yüklendi.`);
    } catch (e) { console.error('❌ Exchange Info hatası:', e.message); }
}

async function monitorMarket() {
    try {
        const res = await axios.get('https://fapi.binance.com/fapi/v1/ticker/price');
        const now = Date.now();
        for (const item of res.data) {
            const sym = item.symbol;
            if (!sym.endsWith('USDT')) continue;
            const price = parseFloat(item.price);
            if (!priceTracker.has(sym)) { priceTracker.set(sym, { price, time: now }); continue; }
            const prev = priceTracker.get(sym);
            if (now - prev.time > BOOST_WINDOW_MS) { priceTracker.set(sym, { price, time: now }); continue; }
            const perc = ((price - prev.price) / prev.price) * 100;
            if (Math.abs(perc) >= BOOST_THRESHOLD) {
                if (!lastAlertTime.has(sym) || (now - lastAlertTime.get(sym) > ALERT_COOLDOWN)) {
                    lastAlertTime.set(sym, now);
                    analyzeBoost(sym, price, prev.price, perc.toFixed(2));
                }
            }
        }
    } catch (e) { }
    setTimeout(monitorMarket, 2000);
}

async function analyzeBoost(symbol, currentPrice, previousPrice, boostPercent) {
    const [k5m, k15m, k1h] = await Promise.all([
        getKlines(symbol, '5m', 60), getKlines(symbol, '15m', 60), getKlines(symbol, '1h', 60)
    ]);
    const i5m = calculateAllIndicators(k5m);
    const i15m = calculateAllIndicators(k15m);
    const i1h = calculateAllIndicators(k1h);
    const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const binanceUrl = `https://www.binance.com/en/futures/${symbol}`;
    const directionEmoji = boostPercent > 0 ? '🟢' : '🔴';
    const msg =
        `${boostPercent > 0 ? '📈' : '📉'} *[BOOST] #${symbol}* (${directionEmoji} %${boostPercent})\n` +
        `----------------------------------\n` +
        `• Fiyat: ${currentPrice}\n` +
        `• RSI (1s): ${Math.round(i1h.rsi)} | (15d): ${Math.round(i15m.rsi)}\n` +
        `• Onay (15d WT): ${i15m.wt.cross || '➖'} | 5m: ${i5m.wt.cross || '➖'}\n` +
        `----------------------------------\n` +
        `🔗 [Aç](${binanceUrl}) | ⏰ ${now}`;
    for (const id of chatIds) {
        bot.sendMessage(id, msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
    }
}

init();
