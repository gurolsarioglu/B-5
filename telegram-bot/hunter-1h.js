const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
// const { GoogleGenerativeAI } = require('@google/generative-ai'); // Gemini AI - Şimdilik devre dışı

// Load config
dotenv.config({ path: path.join(__dirname, '.env') });

// Token from .env for 1h bot
const token = process.env.HUNTER_1H_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const chatIds = new Set();
const processedSignals = new Map();
const COOLDOWN_PERIOD = 3 * 60 * 60 * 1000; // 3 hours cooldown for 1h signals
const TIMEFRAME = '1h';

console.log('⚡ CoinKe V2.0 (1 Saatlik & Futures) Aktif!');

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    chatIds.add(chatId);
    console.log(`✅ Yeni kayıt (1H): ${chatId} (${msg.from.first_name || 'Anonim'})`);
    bot.sendMessage(chatId, "🚀 *CoinKe V2.0 (1S) Aktif!*\n\nHer 1 saatlik mum açılışında tüm Futures çiftlerini tarıyorum.");
});

/**
 * Fetch all active USDT Futures symbols and filter out delisted/leverage tokens
 */
let activeTradingPairs = new Set();
async function loadActiveTradingPairs() {
    try {
        console.log('🔄 Exchange Info yüklüyor (1H)...');
        const res = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
        const tradingPairs = res.data.symbols
            .filter(s => s.status === 'TRADING' && s.symbol.endsWith('USDT'))
            .filter(s => {
                const symbol = s.symbol;
                return !symbol.includes('BULL') && !symbol.includes('BEAR') &&
                    !symbol.includes('UP') && !symbol.includes('DOWN');
            })
            .map(s => s.symbol);

        activeTradingPairs = new Set(tradingPairs);
        console.log(`✅ ${activeTradingPairs.size} aktif USDT çifti yüklendi (1H)`);
    } catch (e) {
        console.error('❌ Exchange Info yüklenemedi:', e.message);
    }
}

async function getFuturesSymbols() {
    try {
        const res = await axios.get('https://fapi.binance.com/fapi/v1/exchangeInfo');
        return res.data.symbols
            .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING' && s.contractType === 'PERPETUAL')
            .filter(s => activeTradingPairs.has(s.symbol)) // Delist filtresi
            .map(s => s.symbol);
    } catch (e) {
        console.error('Sembol listesi alınamadı:', e.message);
        return [];
    }
}

// Bot başlatıldığında yükle
loadActiveTradingPairs();


// Global trackers for summary
let lowestRSI = [];
let highestRSI = [];

async function performScan() {
    if (chatIds.size === 0) return;

    // Reset trackers
    lowestRSI = [];
    highestRSI = [];

    try {
        console.log(`🔍 [${new Date().toLocaleTimeString()}] 1sa Futures Taraması Başlıyor...`);
        const symbols = await getFuturesSymbols();
        console.log(`📈 Toplam ${symbols.length} aktif Futures çifti taranacak.`);

        for (const symbol of symbols) {
            await checkCoin(symbol);
            await new Promise(r => setTimeout(r, 60)); // API limitlerini korumak için küçük bekleme
        }


        // Sort and Log Summary
        lowestRSI.sort((a, b) => a.rsi - b.rsi);
        highestRSI.sort((a, b) => b.rsi - a.rsi);

        console.log(`✅ [${new Date().toLocaleTimeString()}] Tarama Tamamlandı.`);

        console.log('\n📉 EN DÜŞÜK RSI (Oversold Candidates):');
        lowestRSI.slice(0, 3).forEach(c => console.log(`   #${c.symbol}: ${c.rsi.toFixed(2)}`));

        console.log('\n📈 EN YÜKSEK RSI (Overbought Candidates):');
        highestRSI.slice(0, 3).forEach(c => console.log(`   #${c.symbol}: ${c.rsi.toFixed(2)}`));
        console.log('--------------------------------------------------\n');

        // Schedule Delist Check (10 minutes after scan)
        console.log('⏳ Delist kontrolü 10 dakika sonra yapılacak...');
        setTimeout(() => checkDelistedCoins(), 10 * 60 * 1000);

    } catch (e) {
        console.error('Tarama Hatası:', e.message);
    }
}

async function checkDelistedCoins() {
    if (chatIds.size === 0) return;

    console.log(`💀 [${new Date().toLocaleTimeString()}] Delist Kontrolü Başlıyor...`);
    try {
        const res = await axios.get('https://fapi.binance.com/fapi/v1/exchangeInfo');
        const now = Date.now();

        // Filter for PERPETUAL contracts with a "soon" delivery date
        // Standard delivery date is ~2100 (4133404800000). Anything earlier is a scheduled settlement/delist.
        // REMOVED: s.status === 'TRADING' filter to catch 'SETTLING' or 'PRE_DELIVERING' coins.
        const delistingCoins = res.data.symbols.filter(s => {
            return s.contractType === 'PERPETUAL' &&
                s.deliveryDate > now &&
                s.deliveryDate < 4000000000000; // Filter out default 2100 date
        });

        if (delistingCoins.length === 0) {
            console.log('✅ Planlanmış delist/settlement bulunamadı.');
            return;
        }

        let message = '⚠️ *DELIST & SETTLEMENT UYARISI* ⚠️\n\n';

        delistingCoins.forEach(coin => {
            const delistTime = new Date(coin.deliveryDate);
            const timeLeft = coin.deliveryDate - now;

            // Calculate time left breakdown
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

            let timeString = '';
            if (days > 0) timeString += `${days}g `;
            if (hours > 0) timeString += `${hours}s `;
            timeString += `${minutes}d`;

            message += `🔻 *#${coin.symbol}*\n`;
            message += `📅 Tarih: ${delistTime.toLocaleString('tr-TR')}\n`;
            message += `⏳ Kalan: ${timeString}\n`;
            message += `──────────────────\n`;
        });

        message += `\n_Bu coinler yakın zamanda delist edilecek veya uzlaşıya (settlement) gidecektir. Pozisyonlarınızı kontrol ediniz._`;

        for (const id of chatIds) {
            bot.sendMessage(id, message, { parse_mode: 'Markdown' });
        }
        console.log(`⚠️ ${delistingCoins.length} adet delist uyarısı gönderildi.`);

    } catch (e) {
        console.error('Delist kontrolü hatası:', e.message);
    }
}

async function checkCoin(symbol) {
    try {
        // Limit 500 yapıldı (Daha hassas RSI için)
        const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${TIMEFRAME}&limit=500`);
        let klines = res.data.map(k => ({
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));

        // Remove the last candle (which is the currently open/incomplete candle)
        // to rely only on CONFIRMED closed candle data.
        klines.pop();

        if (klines.length < 50) return false;

        const rsi = calculateRSI(klines, 14);
        const stoch = calculateStochRSI(klines, 14, 14, 3, 3);
        const adx = calculateADX(klines, 14);

        // Now 'last' data points refer to the closed candle
        const lastRsi = rsi[rsi.length - 1];
        const lastK = stoch.k[stoch.k.length - 1];
        const lastD = stoch.d[stoch.d.length - 1];
        // const lastAdx = adx[adx.length - 1];

        const price = klines[klines.length - 1].close;
        const prev = klines[klines.length - 2].close;
        const boost = ((price - prev) / prev * 100).toFixed(2);

        // const divergence = detectDivergence(klines, rsi, stoch.k);

        let signalType = null;

        // SCALPER CRITERIA (Updated: Wider Range)
        if (lastRsi <= 25) signalType = 'Buy 🟢';
        else if (lastRsi >= 70) signalType = 'Sell 🔴';

        // Track for summary
        lowestRSI.push({ symbol, rsi: lastRsi });
        highestRSI.push({ symbol, rsi: lastRsi });

        if (signalType) {
            const key = `${symbol}_${signalType}`;
            if (!processedSignals.has(key) || (Date.now() - processedSignals.get(key) > COOLDOWN_PERIOD)) {
                processedSignals.set(key, Date.now());

                const lastVol = klines[klines.length - 1].volume;
                const avgVol = klines.slice(-11, -1).reduce((s, k) => s + k.volume, 0) / 10;
                let volStatus = lastVol > (avgVol * 1.05) ? "🔥 YÜKSEK HACİM" : "Normal";

                // Multi-Timeframe RSI
                const rsi15m = await getMTFRSI(symbol, '15m'); // 15m info only
                const rsi4h = await getMTFRSI(symbol, '4h');
                const rsi1d = await getMTFRSI(symbol, '1d');

                await sendAlert(symbol, signalType, boost, price, lastRsi, lastK, lastD, volStatus, rsi15m, rsi4h, rsi1d);
                return true;
            }
        }
    } catch (e) { return false; }
}

async function getMTFRSI(symbol, interval) {
    try {
        const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=500`);
        let klines = res.data.map(k => ({
            close: parseFloat(k[4])
        }));
        klines.pop(); // Use closed candle
        if (klines.length < 50) return null;
        const rsi = calculateRSI(klines, 14);
        return Math.round(rsi[rsi.length - 1]);
    } catch (e) {
        return 'N/A';
    }
}

async function sendAlert(symbol, type, boost, price, rsi, k, d, vol, rsi15m, rsi4h, rsi1d) {
    const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const binanceUrl = `https://www.binance.com/en/futures/${symbol}`;

    // RSI Star & Exclamation Rules (Updated)
    // BUY: <=20 (3 Stars), <=23 (2 Stars), <=25 (1 Star)
    // SELL: >=75 (3 Stars), >=73 (2 Stars), >=70 (1 Star)
    let rsiWarning = '⭐'; // Default 1 star if triggered
    const roundedRsi = Math.round(rsi);

    if (type.includes('Buy')) {
        if (roundedRsi <= 20) rsiWarning = '⭐⭐⭐';
        else if (roundedRsi <= 23) rsiWarning = '⭐⭐';
        else if (roundedRsi <= 25) rsiWarning = '⭐';
    } else {
        if (roundedRsi >= 75) rsiWarning = '⭐⭐⭐';
        else if (roundedRsi >= 73) rsiWarning = '⭐⭐';
        else if (roundedRsi >= 70) rsiWarning = '⭐';
    }

    const cleanSymbol = symbol.replace(/[^\x00-\x7F]/g, '');

    // 1H Style: Lighter emojis (Blue/Orange), Less Bold to simulate "smaller/lighter" text
    const trendEmoji = type.includes('Buy') ? '🔹' : '🔸';

    const message = `${trendEmoji} *[1 Saatlik Sinyal]*\n` +
        `#${cleanSymbol} ${type.toUpperCase()}\n` +
        `──────────────────\n` +
        `Fiyat: ${price.toFixed(4)} (${boost > 0 ? '+' : ''}${boost}%)\n` +
        `RSI (1s): ${roundedRsi} ${rsiWarning}\n` +
        `RSI (15d): ${rsi15m}\n` +
        `RSI (4s): ${rsi4h}\n` +
        `Stoch: ${Math.round(k)}/${Math.round(d)}\n` +
        `Hacim: ${vol}\n` +
        `──────────────────\n` +
        `🔗 [Binance](${binanceUrl}) | ⏰ ${now}`;

    for (const id of chatIds) {
        bot.sendMessage(id, message, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
    }
}

// --- MATH HELPERS ---
function calculateRSI(d, p) {
    let g = 0, l = 0;
    for (let i = 1; i <= p; i++) {
        let diff = d[i].close - d[i - 1].close;
        if (diff >= 0) g += diff; else l -= diff;
    }
    let rsi = [100 - (100 / (1 + (g / p) / (l / p || 1)))];
    let ag = g / p, al = l / p;
    for (let i = p + 1; i < d.length; i++) {
        let diff = d[i].close - d[i - 1].close;
        ag = (ag * (p - 1) + (diff > 0 ? diff : 0)) / p;
        al = (al * (p - 1) + (diff < 0 ? -diff : 0)) / p;
        rsi.push(100 - (100 / (1 + (ag / (al || 1)))));
    }
    return rsi;
}

function calculateStochRSI(d, rP, sP, kP, dP) {
    const r = calculateRSI(d, rP);
    let s = [];
    for (let i = sP; i <= r.length; i++) {
        let w = r.slice(i - sP, i);
        let low = Math.min(...w), h = Math.max(...w);
        if (h === low) {
            s.push(100);
        } else {
            const safeR = Math.max(r[i - 1], 0.01);
            const safeL = Math.max(low, 0.01);
            const safeH = Math.max(h, 0.01);
            const logStoch = Math.log(safeR / safeL) / Math.log(safeH / safeL);
            s.push(logStoch * 100);
        }
    }
    const kData = s.map((v, i, a) => a.slice(Math.max(0, i - kP + 1), i + 1).reduce((p, c) => p + c, 0) / kP);
    const dData = kData.map((v, i, a) => a.slice(Math.max(0, i - dP + 1), i + 1).reduce((p, c) => p + c, 0) / dP);
    return { k: kData, d: dData };
}

function calculateADX(d, p) {
    let tr = [], dmP = [], dmM = [];
    for (let i = 1; i < d.length; i++) {
        let h = d[i].high, l = d[i].low, pc = d[i - 1].close, ph = d[i - 1].high, pl = d[i - 1].low;
        tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
        dmP.push(h - ph > pl - l && h - ph > 0 ? h - ph : 0);
        dmM.push(pl - l > h - ph && pl - l > 0 ? pl - l : 0);
    }
    let smoothTR = [], smoothDMP = [], smoothDMM = [];
    let sumTR = tr.slice(0, p).reduce((a, b) => a + b, 0), sumDMP = dmP.slice(0, p).reduce((a, b) => a + b, 0), sumDMM = dmM.slice(0, p).reduce((a, b) => a + b, 0);
    smoothTR.push(sumTR); smoothDMP.push(sumDMP); smoothDMM.push(sumDMM);
    for (let i = p; i < tr.length; i++) {
        sumTR = sumTR - (sumTR / p) + tr[i];
        sumDMP = sumDMP - (sumDMP / p) + dmP[i];
        sumDMM = sumDMM - (sumDMM / p) + dmM[i];
        smoothTR.push(sumTR); smoothDMP.push(sumDMP); smoothDMM.push(sumDMM);
    }
    let dx = [];
    for (let i = 0; i < smoothTR.length; i++) {
        let diP = (smoothDMP[i] / smoothTR[i]) * 100, diM = (smoothDMM[i] / smoothTR[i]) * 100;
        dx.push(Math.abs(diP - diM) / (diP + diM) * 100);
    }
    let adx = [dx.slice(0, p).reduce((a, b) => a + b, 0) / p];
    for (let i = p; i < dx.length; i++) adx.push((adx[adx.length - 1] * (p - 1) + dx[i]) / p);
    return adx;
}

function detectDivergence(klines, rsi, stochK) {
    const lookback = 10;
    if (klines.length < lookback + 5 || rsi.length < lookback + 5) return null;
    const recentPrices = klines.slice(-lookback).map(k => k.close);
    const recentRSI = rsi.slice(-lookback);
    const recentStochK = stochK.slice(-lookback);
    const midPoint = Math.floor(lookback / 2);
    const earlyPriceAvg = recentPrices.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint;
    const latePriceAvg = recentPrices.slice(midPoint).reduce((a, b) => a + b, 0) / (lookback - midPoint);
    const priceTrend = latePriceAvg - earlyPriceAvg;
    const earlyRSIAvg = recentRSI.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint;
    const lateRSIAvg = recentRSI.slice(midPoint).reduce((a, b) => a + b, 0) / (lookback - midPoint);
    const rsiTrend = lateRSIAvg - earlyRSIAvg;
    const earlyStochAvg = recentStochK.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint;
    const lateStochAvg = recentStochK.slice(midPoint).reduce((a, b) => a + b, 0) / (lookback - midPoint);
    const stochTrend = lateStochAvg - earlyStochAvg;
    const threshold = 0.001;
    if (priceTrend < -threshold && (rsiTrend > threshold || stochTrend > threshold)) return 'bullish';
    if (priceTrend > threshold && (rsiTrend < -threshold || stochTrend < -threshold)) return 'bearish';
    return null;
}

/**
 * Schedule scan to run exactly at the beginning of every 1-hour candle
 */
function scheduleNextScan() {
    const now = Date.now();
    const intervalMs = 60 * 60 * 1000;
    const nextScan = Math.ceil(now / intervalMs) * intervalMs;
    // Delay slightly (5s) after the candle opens to ensure exchange data is ready
    const delay = nextScan - now + 5000;

    console.log(`⏰ Bir sonraki tarama ${new Date(nextScan).toLocaleTimeString()} saatinde yap\u0131lacak.`);
    setTimeout(async () => {
        await performScan();
        scheduleNextScan();
    }, delay);
}

// Initial start
scheduleNextScan();
performScan();
