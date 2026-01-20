const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');

// Load config
dotenv.config();

const token = process.env.SCALPER_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const chatIds = new Set();
const processedSignals = new Map();
const COOLDOWN_PERIOD = 30 * 60 * 1000;
const TIMEFRAME = '5m';

console.log('⚡ Scalper Hunter v2.0 (Trend & Hacim Odaklı) Aktif!');

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    chatIds.add(chatId);
    bot.sendMessage(chatId, "🚀 *Scalper Hunter v2.0 Aktif!*\n\nBu bir deneme sürecidir, süreç Gürol SARIOĞLU tarafından yürütülmektedir.");
});

async function performScan() {
    if (chatIds.size === 0) return;
    try {
        console.log(`🔍 [${new Date().toLocaleTimeString()}] Tarama Başlıyor (Top 100)...`);
        const res = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
        const topCoins = res.data
            .filter(t => t.symbol.endsWith('USDT'))
            .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(0, 100);

        for (const coin of topCoins) {
            await checkCoin(coin.symbol);
            await new Promise(r => setTimeout(r, 50));
        }
    } catch (e) {
        console.error('Tarama Hatası:', e.message);
    }
}

async function checkCoin(symbol) {
    try {
        const res = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${TIMEFRAME}&limit=100`);
        const klines = res.data.map(k => ({
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));

        if (klines.length < 50) return false;

        // 1. Technical Indicators
        const rsi = calculateRSI(klines, 14);
        const stoch = calculateStochRSI(klines, 14, 14, 3, 3);
        const adx = calculateADX(klines, 14);

        const lastRsi = rsi[rsi.length - 1];
        const lastK = stoch.k[stoch.k.length - 1];
        const lastD = stoch.d[stoch.d.length - 1];
        const lastAdx = adx[adx.length - 1];

        // 2. Volume Analysis
        const lastVol = klines[klines.length - 1].volume;
        const avgVol = klines.slice(-11, -1).reduce((s, k) => s + k.volume, 0) / 10;
        const isHighVolume = lastVol > (avgVol * 1.5); // 50% more volume than average

        const price = klines[klines.length - 1].close;
        const prev = klines[klines.length - 2].close;
        const boost = ((price - prev) / prev * 100).toFixed(2);

        let signalType = null;

        // SCALPER CRITERIA v2.0
        if (lastRsi <= 30 && lastK <= 20) signalType = 'Buy 🟢';
        else if (lastRsi >= 70 && lastK >= 80) signalType = 'Sell 🔴';

        if (signalType) {
            const key = `${symbol}_${signalType}`;
            if (!processedSignals.has(key) || (Date.now() - processedSignals.get(key) > COOLDOWN_PERIOD)) {
                processedSignals.set(key, Date.now());

                let volStatus = isHighVolume ? "🔥 YÜKSEK HACİM" : "Normal";
                let trendStatus = lastAdx > 25 ? "💪 Güçlü Trend" : "Zayıf Trend";

                await sendAlert(symbol, signalType, boost, price, prev, lastRsi, lastK, lastD, volStatus, trendStatus);
                return true;
            }
        }
    } catch (e) { return false; }
}

async function sendAlert(symbol, type, boost, price, prev, rsi, k, d, vol, trend) {
    let fr = "N/A";
    try {
        const frRes = await axios.get(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`);
        fr = (parseFloat(frRes.data.lastFundingRate) * 100).toFixed(4) + '%';
    } catch (e) { }

    const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const binanceUrl = `https://www.binance.com/en/trade/${symbol.replace('USDT', '')}_USDT?type=spot`;

    const message = `📡 *${type} SİNYALİ: #${symbol}*\n` +
        `━━━━━━━━━━━━━━━\n` +
        `💰 *Fiyat:* ${price.toFixed(4)}\n` +
        `💰 *Önceki Fiyat:* ${prev.toFixed(4)}\n` +
        `📊 *Boost Value:* ${boost > 0 ? '+' : ''}${boost}%\n` +
        `⚠️ *RSI:* ${Math.round(rsi)}\n` +
        `⚠️ *Stochastic (K/D):* ${Math.round(k)}/${Math.round(d)}\n` +
        `📉 *Trend Değeri (ADX):* ${Math.round(trend === "💪 Güçlü Trend" ? 1 : 0)}\n` +
        `📈 *Trend Durumu:* ${trend}\n` +
        `🔥 *Hacim:* ${vol}\n` +
        `💸 *Funding Rate (FR):* ${fr}\n` +
        `━━━━━━━━━━━━━━━\n` +
        `💡 *Scalp Önerisi:* ${type.includes('Buy') ? 'Long İşlem' : 'Short İşlem'} için onay beklenebilir.\n\n` +
        `🔗 [Binance'de İncele](${binanceUrl})  |  ⏰ ${now}`;

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
        s.push(h === low ? 100 : ((r[i - 1] - low) / (h - low)) * 100);
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

setInterval(performScan, 2 * 60 * 1000);
performScan();
