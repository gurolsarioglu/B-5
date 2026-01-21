const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

async function quickTest() {
    console.log('🔥 HIZLI TEST...\n');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
        // Sadece gemini-pro ile basit test
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent('Merhaba');

        console.log('✅✅✅ ÇALIŞTI!!!');
        console.log('Cevap:', result.response.text());
    } catch (e) {
        console.error('Hata:', e.message);
    }
}

quickTest();
