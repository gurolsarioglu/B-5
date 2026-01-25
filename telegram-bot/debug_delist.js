const axios = require('axios');

async function debugDelist() {
    try {
        console.log('Fetching exchangeInfo...');
        const res = await axios.get('https://fapi.binance.com/fapi/v1/exchangeInfo');
        const now = Date.now();
        const symbols = res.data.symbols;

        console.log(`Total symbols: ${symbols.length}`);

        // Check for ANY symbol with delivery date < 2090 (approx 3800000000000)
        // Standard perpetual is ~4133404800000 (Year 2100)

        const oddDeliveryDates = symbols.filter(s => {
            return s.contractType === 'PERPETUAL' && s.deliveryDate < 4000000000000;
        });

        console.log(`\nSymbols with 'early' delivery dates (< year 2096): ${oddDeliveryDates.length}`);
        oddDeliveryDates.forEach(s => {
            console.log(`- ${s.symbol}: Status=${s.status}, Delivery=${new Date(s.deliveryDate).toISOString()}, Now=${new Date(now).toISOString()}`);
        });

        // specific check for logic in hunter-1h.js
        const hunterLogic = symbols.filter(s => {
            return s.contractType === 'PERPETUAL' &&
                // s.status === 'TRADING' && // REMOVED FILTER
                // s.deliveryDate > now && // COMMENTED OUT FOR DEBUG VERIFICATION
                s.deliveryDate < 4000000000000;
        });

        console.log(`\nHunter Logic Matches: ${hunterLogic.length}`);
        hunterLogic.forEach(s => {
            console.log(`MATCH: ${s.symbol}`);
        });

    } catch (e) {
        console.error(e);
    }
}

debugDelist();
