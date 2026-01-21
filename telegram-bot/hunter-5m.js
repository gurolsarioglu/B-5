const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load config
dotenv.config();

const token = process.env.SCALPER_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const chatIds = new Set();
const processedSignals = new Map();
const COOLDOWN_PERIOD = 30 * 60 * 1000;
const TIMEFRAME = '5m';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 500,
    }
});

console.log('⚡ CoinKe V2.0 (Trend & Hacim Odaklı) Aktif!');

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    chatIds.add(chatId);
    bot.sendMessage(chatId, "🚀 *CoinKe V2.0 Aktif!*\n\nBu bir deneme sürecidir, süreç Gürol SARIOĞLU tarafından yürütülmektedir.");
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

        // 3. Divergence Detection
        const divergence = detectDivergence(klines, rsi, stoch.k);

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

                await sendAlert(symbol, signalType, boost, price, prev, lastRsi, lastK, lastD, volStatus, trendStatus, divergence);
                return true;
            }
        }
    } catch (e) { return false; }
}

// AI Analysis Function - Gemini 2.0 Powered
async function getAIAnalysis(symbol, price, prev, rsi, k, d, divergenceType, type) {
    try {
        // Gemini prompt
        const prompt = `Sen profesyonel bir kripto scalping uzmanısın. Aşağıdaki coin için kısa vadeli (15-60 dakika) analiz yap:

Coin: ${symbol}
Mevcut Fiyat: $${price}
Önceki Fiyat: $${prev}
RSI: ${Math.round(rsi)}
Stoch K/D: ${Math.round(k)}/${Math.round(d)}
Divergence: ${divergenceType === 'bullish' ? 'BULLISH (yukarış)' : 'BEARISH (düşüş)'}
Sinyal: ${type}

ÖNEMLİ: Entry (giriş) fiyatı belirle! 
- Eğer bullish ise: yakın destek veya küçük pullback seviyesi
- Eğer bearish ise: yakın direnç veya küçük rally seviyesi
- Entry mevcut fiyattan %0.3-1.0 farklı olabilir

Kısa ve öz yanıt ver. Format:

ENTRY: [giriş yapılacak fiyat, sayı]
HEDEF: [hedef fiyat, sayı]
STOP: [stop loss fiyat, sayı]
R/R: 1:[oran]
SKOR: [güven 0-100]
SÜRE: [15-30 formatında dakika]
YORUM: [max 2 cümle Türkçe, entry zamanı ve strateji]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Parse Gemini response
        const entryMatch = text.match(/ENTRY[:\s]+\$?([\d.]+)/);
        const hedefMatch = text.match(/HEDEF[:\s]+\$?([\d.]+)/);
        const stopMatch = text.match(/STOP[:\s]+\$?([\d.]+)/);
        const rrMatch = text.match(/R\/R[:\s]+(1:[\d.]+)/);
        const skorMatch = text.match(/SKOR[:\s]+(\d+)/);
        const sureMatch = text.match(/SÜRE[:\s]+([\d-]+)/);
        const yorumMatch = text.match(/YORUM[:\s]+(.+?)(?=\n|$)/s);

        // Calculate entry if AI didn't provide
        let entryFiyat;
        if (entryMatch) {
            entryFiyat = parseFloat(entryMatch[1]);
        } else {
            // Fallback: conservative entry calculation
            if (divergenceType === 'bullish') {
                // For bullish, suggest entry slightly below current (wait for dip)
                entryFiyat = price * 0.997; // 0.3% below
            } else {
                // For bearish, suggest entry slightly above current (wait for bounce)
                entryFiyat = price * 1.003; // 0.3% above
            }
        }

        const hedefFiyat = hedefMatch ? parseFloat(hedefMatch[1]) : price * 1.015;
        const stopLoss = stopMatch ? parseFloat(stopMatch[1]) : price * 0.995;
        const guvenSkoru = skorMatch ? parseInt(skorMatch[1]) : 75;

        console.log(`✅ Gemini AI: ${symbol} (Güven: %${guvenSkoru})`);

        return {
            entryFiyat,
            hedefFiyat,
            stopLoss,
            riskReward: rrMatch ? rrMatch[1] : '1:2.0',
            guvenSkoru,
            sure: (sureMatch ? sureMatch[1] : '20-40') + ' dk',
            yorum: yorumMatch ? yorumMatch[1].trim() : 'Divergence teyit bekleyin, hacim artışı gözlemleyin.'
        };
    } catch (error) {
        console.error('❌ Gemini AI Hatası:', error.message);

        // Fallback to simple calculation if Gemini fails
        const targetPct = divergenceType === 'bullish' ? 1.5 : -1.5;
        const hedefFiyat = price * (1 + targetPct / 100);
        const stopLoss = price * (1 - (targetPct > 0 ? 0.6 : -0.6) / 100);

        console.log(`⚠️ Fallback Pattern AI kullanıldı`);

        const fallbackEntry = divergenceType === 'bullish' ? price * 0.997 : price * 1.003;

        return {
            entryFiyat: fallbackEntry,
            hedefFiyat,
            stopLoss,
            riskReward: '1:2.5',
            guvenSkoru: 70,
            sure: '20-40 dk',
            yorum: `${divergenceType === 'bullish' ? 'Bullish' : 'Bearish'} divergence tespit edildi. Teyit bekleyin.`
        };
    }
}

async function sendAlert(symbol, type, boost, price, prev, rsi, k, d, vol, trend, divergence) {
    let fr = "N/A";
    let marketType = "Spot";
    let longShortRatio = "N/A";
    let liquidity = "N/A";

    try {
        const frRes = await axios.get(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`);
        fr = (parseFloat(frRes.data.lastFundingRate) * 100).toFixed(4) + '%';
        marketType = "Spot | Futures ⚡";
    } catch (e) {
        // If futures endpoint fails, it's likely spot only
        marketType = "Spot Only ⚪";
    }

    // Long/Short Ratio
    try {
        const lsRes = await axios.get(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`);
        if (lsRes.data && lsRes.data.length > 0) {
            const longRatio = parseFloat(lsRes.data[0].longAccount);
            const shortRatio = parseFloat(lsRes.data[0].shortAccount);
            const longPct = (longRatio / (longRatio + shortRatio) * 100).toFixed(0);
            const shortPct = (100 - longPct).toFixed(0);
            longShortRatio = `${longPct}% / ${shortPct}%`;
        }
    } catch (e) {
        // Long/Short data not available
    }

    // 24h Liquidity (using quote volume from 24hr ticker)
    try {
        const tickerRes = await axios.get(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`);
        if (tickerRes.data && tickerRes.data.quoteVolume) {
            const volumeInMillion = (parseFloat(tickerRes.data.quoteVolume) / 1000000).toFixed(1);
            liquidity = `$${volumeInMillion}M`;
        }
    } catch (e) {
        // Liquidity data not available
    }

    const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const binanceUrl = `https://www.binance.com/en/trade/${symbol.replace('USDT', '')}_USDT?type=spot`;

    // Divergence warning message
    let divergenceWarning = '';
    if (divergence) {
        if (divergence === 'bullish') {
            divergenceWarning = `⚠️ *UYARI: RSI ve SRSI'da YUKARIŞ UYUMSUZLUĞU var!* 🟢\n`;
        } else if (divergence === 'bearish') {
            divergenceWarning = `⚠️ *UYARI: RSI ve SRSI'da DÜŞÜŞ UYUMSUZLUĞU var!* 🔴\n`;
        }
    }

    // AI Analysis (only if divergence detected)
    let aiSection = '';
    let aiCommentary = '';
    if (divergence) {
        console.log(`🤖 AI Analizi başlatılıyor: ${symbol}`);
        const aiData = await getAIAnalysis(symbol, price, prev, rsi, k, d, divergence, type);

        if (aiData && aiData.hedefFiyat) {
            // AI prediction section (between Önceki Fiyat and Boost Value)
            const entryChange = aiData.entryFiyat ? ((aiData.entryFiyat - price) / price * 100).toFixed(2) : '0.00';
            const hedefChange = ((aiData.hedefFiyat - price) / price * 100).toFixed(2);
            const stopChange = aiData.stopLoss ? ((aiData.stopLoss - price) / price * 100).toFixed(2) : 'N/A';

            let skorEmoji = '⭐';
            if (aiData.guvenSkoru >= 80) skorEmoji = '🔥';
            else if (aiData.guvenSkoru >= 60) skorEmoji = '⭐';
            else skorEmoji = '⚠️';

            aiSection = `\n🤖 *AI TAHMİNİ:*\n` +
                `📍 *Entry (Giriş):* $${aiData.entryFiyat ? aiData.entryFiyat.toFixed(4) : price.toFixed(4)} (${entryChange > 0 ? '+' : ''}${entryChange}%)\n` +
                `🎯 *Hedef Fiyat:* $${aiData.hedefFiyat.toFixed(4)} (${hedefChange > 0 ? '+' : ''}${hedefChange}%)\n` +
                `🛑 *Stop Loss:* ${aiData.stopLoss ? '$' + aiData.stopLoss.toFixed(4) + ' (' + stopChange + '%)' : 'N/A'}\n` +
                `⚖️ *Risk/Reward:* ${aiData.riskReward}\n` +
                `${skorEmoji} *Güven Skoru:* %${aiData.guvenSkoru || 'N/A'}\n` +
                `⏱️ *Tahmini Süre:* ${aiData.sure}\n`;

            // AI commentary (after Scalp Önerisi)
            aiCommentary = `\n💬 *AI Yorumu:* ${aiData.yorum}\n`;
        }
    }

    // Clean symbol - remove non-ASCII characters (Chinese/Japanese coins)
    const cleanSymbol = symbol.replace(/[^\x00-\x7F]/g, '');

    const message = `📡 *${type} SİNYALİ: #${cleanSymbol}*\n` +
        `━━━━━━━━━━━━━━━\n` +
        divergenceWarning +
        `💎 *Coin:* ${symbol}\n` +
        `🏪 *Market:* ${marketType}\n` +
        `💰 *Fiyat:* ${price.toFixed(4)}\n` +
        `💰 *Önceki Fiyat:* ${prev.toFixed(4)}` +
        aiSection +
        `\n📊 *Boost Value:* ${boost > 0 ? '+' : ''}${boost}%\n` +
        `⚠️ *RSI:* ${Math.round(rsi)}\n` +
        `⚠️ *Stochastic (K/D):* ${Math.round(k)}/${Math.round(d)}\n` +
        `📉 *Trend Değeri (ADX):* ${Math.round(trend === "💪 Güçlü Trend" ? 1 : 0)}\n` +
        `📈 *Trend Durumu:* ${trend}\n` +
        `🔥 *Hacim:* ${vol}\n` +
        `💸 *Funding Rate (FR):* ${fr}\n` +
        `⚖️ *Long/Short:* ${longShortRatio}\n` +
        `💧 *24h Likidite:* ${liquidity}\n` +
        `━━━━━━━━━━━━━━━\n` +
        `💡 *Scalp Önerisi:* ${type.includes('Buy') ? 'Long İşlem' : 'Short İşlem'} için onay beklenebilir.` +
        aiCommentary +
        `\n🔗 [Binance'de İncele](${binanceUrl})  |  ⏰ ${now}`;


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

// Divergence Detection Function
function detectDivergence(klines, rsi, stochK) {
    const lookback = 10; // Look back 10 candles
    if (klines.length < lookback + 5 || rsi.length < lookback + 5) return null;

    // Get recent data
    const recentPrices = klines.slice(-lookback).map(k => k.close);
    const recentRSI = rsi.slice(-lookback);
    const recentStochK = stochK.slice(-lookback);

    // Calculate price trend (comparing first half vs second half)
    const midPoint = Math.floor(lookback / 2);
    const earlyPriceAvg = recentPrices.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint;
    const latePriceAvg = recentPrices.slice(midPoint).reduce((a, b) => a + b, 0) / (lookback - midPoint);
    const priceTrend = latePriceAvg - earlyPriceAvg;

    // Calculate RSI trend
    const earlyRSIAvg = recentRSI.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint;
    const lateRSIAvg = recentRSI.slice(midPoint).reduce((a, b) => a + b, 0) / (lookback - midPoint);
    const rsiTrend = lateRSIAvg - earlyRSIAvg;

    // Calculate StochK trend
    const earlyStochAvg = recentStochK.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint;
    const lateStochAvg = recentStochK.slice(midPoint).reduce((a, b) => a + b, 0) / (lookback - midPoint);
    const stochTrend = lateStochAvg - earlyStochAvg;

    // Detect divergence (price and indicators moving in opposite directions)
    const threshold = 0.001; // Minimum trend strength to consider

    // Bullish Divergence: Price falling but RSI/Stoch rising
    if (priceTrend < -threshold && (rsiTrend > threshold || stochTrend > threshold)) {
        return 'bullish';
    }

    // Bearish Divergence: Price rising but RSI/Stoch falling
    if (priceTrend > threshold && (rsiTrend < -threshold || stochTrend < -threshold)) {
        return 'bearish';
    }

    return null;
}

setInterval(performScan, 2 * 60 * 1000);
performScan();
