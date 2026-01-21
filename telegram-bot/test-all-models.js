const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

async function testAllModels() {
    console.log('🔍 TÜM MODELLERİ TEST EDİYORUM...\n');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Try all possible model names
    const models = [
        'gemini-pro',
        'gemini-1.0-pro',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-2.0-flash-exp',
        'models/gemini-pro',
        'models/gemini-1.5-flash'
    ];

    for (const modelName of models) {
        try {
            console.log(`\n🧪 Test: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'Merhaba' }] }]
            });

            const text = result.response.text();
            console.log(`✅✅✅ ÇALIŞTI! Model: ${modelName}`);
            console.log(`Cevap: ${text.substring(0, 50)}...`);

            // If successful, test with trading prompt
            console.log(`\n🎯 Trading prompt test...`);
            const tradeResult = await model.generateContent('Bitcoin fiyatı yükselir mi? Tek kelime cevap ver.');
            console.log(`Trading response: ${tradeResult.response.text()}`);

            return modelName; // Return the working model

        } catch (e) {
            console.log(`❌ Başarısız: ${e.message.substring(0, 60)}...`);
        }
    }

    console.log('\n❌ HİÇBİR MODEL ÇALIŞMADI!');
    console.log('\n💡 ÖNERİ: API key yeniden oluşturun veya 24 saat bekleyin.');
}

testAllModels();
