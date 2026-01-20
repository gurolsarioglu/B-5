const TelegramBot = require('node-telegram-bot-api');
const token = '8550972845:AAGC7bq_Lly9i3gL57z8DIZm50mPskrxq9Y';
const bot = new TelegramBot(token, { polling: true });

console.log('Testing bot token...');

bot.getMe().then(me => {
    console.log('Bot identity found:', me.username);
}).catch(err => {
    console.error('Bot identity error:', err.message);
});

bot.on('message', (msg) => {
    console.log('Received:', msg.text);
    bot.sendMessage(msg.chat.id, 'I am alive!');
});

bot.on('polling_error', (error) => {
    console.log('Polling Error:', error.message);
});
