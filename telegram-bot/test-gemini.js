const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

async function testGeminiAPI() {
    console.log('🔍 Gemini API Test Başlıyor...\n');

    const apiKey = process.env.GEMINI_API_KEY;
    console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'BULUNAMADI');

    try {
        const genAI = new GoogleGenerativeAI(apiKey);

        // Try different model names
        const modelNames = [
            'gemini-pro',
            'gemini-1.5-flash',
            'gemini-1.5-flash-latest',
            'models/gemini-1.5-flash',
            'models/gemini-pro'
        ];

        for (const modelName of modelNames) {
            try {
                console.log(`\n🧪 Deneniyor: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });

                const result = await model.generateContent('Test');
                const text = result.response.text();

                console.log(`✅ ÇALIŞTI! Model: ${modelName}`);
                console.log(`📥 Cevap: ${text.substring(0, 100)}...`);
                return;
            } catch (err) {
                console.log(`❌ ${modelName} çalışmadı: ${err.message.substring(0, 80)}`);
            }
        }

        console.log('\n❌ Hiçbir model çalışmadı!');

    } catch (error) {
        console.error('❌ HATA:', error.message);
        console.error('❌ Detay:', error.stack);
    }
}

testGeminiAPI();
