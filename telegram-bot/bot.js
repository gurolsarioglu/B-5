require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Bot Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN bulunamadı! .env dosyasını kontrol edin.');
    process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Telegram Bot başlatılıyor...');

// ==================== HELPER FUNCTIONS ====================

/**
 * Format price with appropriate decimals
 */
function formatPrice(price) {
    if (!price) return 'N/A';
    const num = parseFloat(price);
    if (num >= 1) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return num.toFixed(8).replace(/\.?0+$/, '');
}

/**
 * Format volume in billions/millions
 */
function formatVolume(volume) {
    if (!volume) return 'N/A';
    const num = parseFloat(volume);
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(0);
}

/**
 * Get emoji for price change
 */
function getChangeEmoji(change) {
    if (change > 0) return '📈';
    if (change < 0) return '📉';
    return '➖';
}

/**
 * Get emoji for RSI status
 */
function getRSIEmoji(rsi) {
    if (!rsi) return '❓';
    if (rsi >= 70) return '🔴'; // Overbought
    if (rsi <= 30) return '🟢'; // Oversold
    return '🟡'; // Neutral
}

// Debug listener
bot.on('message', (msg) => {
    console.log(`📩 Message received from ${msg.chat.id}: ${msg.text}`);
});

/**
 * Fetch data from backend API
 */
async function fetchAPI(endpoint) {
    try {
        const response = await axios.get(`${API_BASE_URL}${endpoint}`);
        return response.data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error.message);
        throw new Error('Backend API ile bağlantı kurulamadı. Lütfen server\'ın çalıştığından emin olun.');
    }
}

// ==================== COMMAND HANDLERS ====================

/**
 * /start command
 */
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'Kullanıcı';

    console.log(`🚀 /start command received from ${chatId}`);

    // Subscribe user to alerts automatically
    try {
        await axios.post(`${API_BASE_URL}/subscribe`, { chatId });
        console.log(`✅ User ${chatId} subscribed to alerts via /start`);
    } catch (error) {
        console.error('Subscription error:', error.message);
    }

    const welcomeMessage = `
🚀 *Hoş Geldin ${userName}!*

Binance kripto para takip botuna hoş geldiniz!

✅ *OTOMATİK ALARM SİSTEMİ AKTİF!*
Sizi otomatik olarak alarm listesine ekledim. Fiyat ve indicator sinyalleri yakaladığımda size mesaj atacağım.

*📊 Kullanılabilir Komutlar:*
/coins - Top 10 coin listesi
/btc - Bitcoin analizi
/drops - En çok düşen coinler
/analyze <SYMBOL> - Coin analizi

📈 Hadi başlayalım!
    `;

    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '💰 Top Coinler', callback_data: 'cmd_coins' },
                    { text: '₿ Bitcoin', callback_data: 'cmd_btc' }
                ],
                [
                    { text: '📉 Düşenler', callback_data: 'cmd_drops' },
                    { text: 'ℹ️ Yardım', callback_data: 'cmd_help' }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, welcomeMessage, options);
});

/**
 * /help command
 */
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;

    const helpMessage = `
*📚 Komut Listesi*

*Temel Komutlar:*
/start \\- Bot'u başlat
/help \\- Bu yardım menüsü

*Market Verileri:*
/coins \\- Top 10 coin \\(hacme göre\\)
/btc \\- Bitcoin analizi
/drops \\- En çok düşen coinler
/volume \\- En yüksek hacimli coinler

*Coin Analizi:*
/analyze \\<SYMBOL\\> \\- Belirli coin detayları

*Örnekler:*
\`/analyze BTC\`
\`/analyze ETH\`
\`/analyze SOL\`

*📊 Gösterilen Bilgiler:*
• Anlık fiyat
• 24s değişim
• Hacim
• RSI \\(14 periyot\\)
• Stochastic RSI
• BTC trend analizi

💡 *İpucu:* Inline butonları kullanarak da komutları çalıştırabilirsiniz!
  `;

    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🔙 Ana Menü', callback_data: 'cmd_start' }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, helpMessage, options);
});

/**
 * /coins command
 */
bot.onText(/\/coins/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        // Send loading message
        const loadingMsg = await bot.sendMessage(chatId, '⏳ Veriler yükleniyor...');

        // Fetch top coins by volume
        const data = await fetchAPI('/top-volume?limit=10');
        const coins = data.data;

        // Build message
        let message = '💰 *TOP 10 COIN (Hacim)*\n';
        message += '──────────────────\n\n';

        coins.forEach((coin, index) => {
            const emoji = coin.priceChangePercent >= 0 ? '📈' : '📉';
            const changeSign = coin.priceChangePercent >= 0 ? '+' : '';

            message += `*${index + 1}. ${coin.coinName}*\n`;
            message += `• Fiyat: $${formatPrice(coin.currentPrice)}\n`;
            message += `• Değişim: ${emoji} ${changeSign}${coin.priceChangePercent.toFixed(2)}%\n`;
            message += `• Hacim: $${formatVolume(coin.quoteVolume)}\n\n`;
        });

        message += `_Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')}_`;

        // Delete loading message
        bot.deleteMessage(chatId, loadingMsg.message_id);

        // Send result
        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔄 Yenile', callback_data: 'cmd_coins' },
                        { text: '🔙 Menü', callback_data: 'cmd_start' }
                    ]
                ]
            }
        };

        bot.sendMessage(chatId, message, options);

    } catch (error) {
        bot.sendMessage(chatId, `❌ Hata: ${error.message}`);
    }
});

/**
 * /btc command - Bitcoin analysis
 */
bot.onText(/\/btc/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const loadingMsg = await bot.sendMessage(chatId, '⏳ Bitcoin analizi yapılıyor...');

        const data = await fetchAPI('/btc-status');
        const btc = data.data;

        const emoji = getChangeEmoji(btc.priceChange24h);
        const changeSign = btc.priceChange24h >= 0 ? '+' : '';
        const rsiEmoji = getRSIEmoji(btc.rsi);

        let message = `₿ *BITCOIN (BTC) ANALİZİ*\n`;
        message += `──────────────────\n\n`;
        message += `• *Fiyat:* $${formatPrice(btc.currentPrice)}\n`;
        message += `• *24s Değişim:* ${emoji} ${changeSign}${btc.priceChange24h}%\n`;
        message += `• *Trend:* ${btc.trend}\n\n`;

        message += `📊 *TEKNİK GÖSTERGELER*\n`;
        message += `• *RSI:* ${btc.rsi ? btc.rsi.toFixed(2) : 'N/A'} (${btc.rsiInterpretation || 'N/A'})\n`;
        message += `• *Stoch RSI:* ${btc.stochRSI ? btc.stochRSI.toFixed(2) : 'N/A'}\n\n`;

        message += `💰 *24 SAAT VERİLERİ*\n`;
        message += `• Yüksek: $${formatPrice(btc.high24h)} | Düşük: $${formatPrice(btc.low24h)}\n`;
        message += `• Hacim: $${formatVolume(btc.volume24h)}\n\n`;

        message += `📝 *ANALİZ:*\n_${btc.commentary}_\n\n`;
        message += `⏰ ${new Date().toLocaleTimeString('tr-TR')}`;

        bot.deleteMessage(chatId, loadingMsg.message_id);

        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔄 Yenile', callback_data: 'cmd_btc' },
                        { text: '🔙 Menü', callback_data: 'cmd_start' }
                    ]
                ]
            }
        };

        bot.sendMessage(chatId, message, options);

    } catch (error) {
        bot.sendMessage(chatId, `❌ Hata: ${error.message}`);
    }
});

/**
 * /drops command - Show biggest price drops
 */
bot.onText(/\/drops/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const loadingMsg = await bot.sendMessage(chatId, '⏳ Düşen coinler analiz ediliyor...');

        const data = await fetchAPI('/top-drops?limit=10');
        const coins = data.data;

        let message = '📉 *EN ÇOK DÜŞEN 10 COIN*\n';
        message += '──────────────────\n\n';

        coins.forEach((coin, index) => {
            message += `*${index + 1}. ${coin.coinName}*\n`;
            message += `• Fiyat: $${formatPrice(coin.currentPrice)}\n`;
            message += `• Değişim: 📉 ${coin.priceChangePercent.toFixed(2)}%\n`;
            message += `• Hacim: $${formatVolume(coin.quoteVolume)}\n\n`;
        });

        message += `_Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')}_`;

        bot.deleteMessage(chatId, loadingMsg.message_id);

        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔄 Yenile', callback_data: 'cmd_drops' },
                        { text: '🔙 Menü', callback_data: 'cmd_start' }
                    ]
                ]
            }
        };

        bot.sendMessage(chatId, message, options);

    } catch (error) {
        bot.sendMessage(chatId, `❌ Hata: ${error.message}`);
    }
});

/**
 * /volume command - Show highest volume coins
 */
bot.onText(/\/volume/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const loadingMsg = await bot.sendMessage(chatId, '⏳ Hacim verileri yükleniyor...');

        const data = await fetchAPI('/top-volume?limit=10');
        const coins = data.data;

        let message = '📊 *EN YÜKSEK HACİMLİ 10 COIN*\n';
        message += '──────────────────\n\n';

        coins.forEach((coin, index) => {
            const emoji = coin.priceChangePercent >= 0 ? '📈' : '📉';
            const changeSign = coin.priceChangePercent >= 0 ? '+' : '';

            message += `*${index + 1}. ${coin.coinName}*\n`;
            message += `• Hacim: $${formatVolume(coin.quoteVolume)}\n`;
            message += `• Fiyat: $${formatPrice(coin.currentPrice)}\n`;
            message += `• Değişim: ${emoji} ${changeSign}${coin.priceChangePercent.toFixed(2)}%\n\n`;
        });

        message += `_Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')}_`;

        bot.deleteMessage(chatId, loadingMsg.message_id);

        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔄 Yenile', callback_data: 'cmd_volume' },
                        { text: '🔙 Menü', callback_data: 'cmd_start' }
                    ]
                ]
            }
        };

        bot.sendMessage(chatId, message, options);

    } catch (error) {
        bot.sendMessage(chatId, `❌ Hata: ${error.message}`);
    }
});

/**
 * /analyze command - Analyze specific coin
 */
bot.onText(/\/analyze (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const symbol = match[1].toUpperCase().trim();

    try {
        const loadingMsg = await bot.sendMessage(chatId, `⏳ ${symbol} analiz ediliyor...`);

        // Add USDT if not present
        const fullSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;

        const data = await fetchAPI(`/coins/${fullSymbol}`);
        const coin = data.data;
        const indicators = coin.technicalIndicators || {};

        const emoji = getChangeEmoji(coin.priceChangePercent);
        const changeSign = coin.priceChangePercent >= 0 ? '+' : '';
        const rsiEmoji = getRSIEmoji(indicators.rsi);

        let message = `📊 *${coin.coinName} ANALİZ*\n`;
        message += `──────────────────\n\n`;
        message += `• *Fiyat:* $${formatPrice(coin.currentPrice)}\n`;
        message += `• *Değişim:* ${emoji} ${changeSign}${coin.priceChangePercent.toFixed(2)}%\n`;
        message += `• *24s Yüksek/Düşük:* $${formatPrice(coin.high24h)} / $${formatPrice(coin.low24h)}\n`;
        message += `• *Hacim:* $${formatVolume(coin.quoteVolume)}\n\n`;

        message += `📊 *TEKNİK GÖSTERGELER*\n`;
        message += `• RSI: ${indicators.rsi ? indicators.rsi.toFixed(2) : 'N/A'} (${indicators.rsiInterpretation || 'N/A'})\n`;
        message += `• Stoch RSI: ${indicators.stochRSI ? indicators.stochRSI.toFixed(2) : 'N/A'} (${indicators.stochRSIInterpretation || 'N/A'})\n\n`;

        if (indicators.sma7) {
            message += `📈 *HAREKETLİ ORTALAMALAR*\n`;
            message += `• SMA(7): $${formatPrice(indicators.sma7)}\n`;
            message += `• EMA(7): $${formatPrice(indicators.ema7)}\n\n`;
        }

        message += `⏰ ${new Date().toLocaleTimeString('tr-TR')}`;

        bot.deleteMessage(chatId, loadingMsg.message_id);

        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔄 Yenile', callback_data: `analyze_${fullSymbol}` },
                        { text: '🔙 Menü', callback_data: 'cmd_start' }
                    ]
                ]
            }
        };

        bot.sendMessage(chatId, message, options);

    } catch (error) {
        bot.sendMessage(chatId, `❌ Hata: ${symbol} için veri bulunamadı. Coin sembolünü kontrol edin.\n\nÖrnek: /analyze BTC`);
    }
});

// ==================== CALLBACK QUERY HANDLER ====================

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    // Answer the callback to remove loading state
    bot.answerCallbackQuery(query.id);

    // Handle different callbacks
    if (data === 'cmd_start') {
        bot.sendMessage(chatId, '/start');
    } else if (data === 'cmd_help') {
        bot.sendMessage(chatId, '/help');
    } else if (data === 'cmd_coins') {
        bot.sendMessage(chatId, '/coins');
    } else if (data === 'cmd_btc') {
        bot.sendMessage(chatId, '/btc');
    } else if (data === 'cmd_drops') {
        bot.sendMessage(chatId, '/drops');
    } else if (data === 'cmd_volume') {
        bot.sendMessage(chatId, '/volume');
    } else if (data.startsWith('analyze_')) {
        const symbol = data.replace('analyze_', '');
        bot.sendMessage(chatId, `/analyze ${symbol}`);
    }
});

// ==================== ERROR HANDLING ====================

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
});

bot.on('error', (error) => {
    console.error('Bot error:', error.message);
});

// ==================== START BOT ====================

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🤖 Telegram Bot Started!                               ║
║                                                           ║
║   Bot is now listening for commands...                    ║
║   Backend API: ${API_BASE_URL}                            ║
║                                                           ║
║   Available commands:                                     ║
║   /start  - Start the bot                                 ║
║   /coins  - Top coins                                     ║
║   /btc    - Bitcoin analysis                              ║
║   /drops  - Biggest drops                                 ║
║   /volume - Highest volume                                ║
║   /analyze <SYMBOL> - Analyze coin                        ║
║   /help   - Help menu                                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
