/**
 * Binance Crypto Monitor - Main Application
 * Integrated with Scalper Terminal
 */

// Global instances
let tableComponent;
let btcStatus;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Application initializing...');

    // 1. Initialize Components
    tableComponent = new CoinTableComponent('coinsContainer');
    btcStatus = new BTCStatusComponent('btcStatusSection');

    // 2. Initial Data Load
    await initializeApp();

    // 3. Set up Event Listeners
    setupEventListeners();

    // 4. Auto Refresh (every 60 seconds)
    setInterval(async () => {
        await tableComponent.loadCoins();
        await btcStatus.render();
        updateLastUpdateTime();
    }, 60000);
});

/**
 * Initialize app data and UI
 */
async function initializeApp() {
    try {
        // Show loading state
        document.getElementById('loadingContainer').style.display = 'flex';
        document.getElementById('errorContainer').classList.add('hidden');

        // Load BTC Status
        await btcStatus.render();

        // Load Coins
        await tableComponent.loadCoins();

        // Hide loading
        document.getElementById('loadingContainer').style.display = 'none';
        updateLastUpdateTime();

    } catch (error) {
        console.error('Initialization error:', error);
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('errorContainer').classList.remove('hidden');
        document.getElementById('errorMessage').textContent = 'Uygulama başlatılırken bir hata oluştu. Lütfen sayfayı yenileyin.';
    }
}

/**
 * Update the last update timestamp in footer
 */
function updateLastUpdateTime() {
    const el = document.getElementById('lastUpdate');
    if (el) {
        el.textContent = new Date().toLocaleTimeString();
    }
}

/**
 * Global function to show coin details (called from table/grid)
 */
window.showCoinDetails = async function (symbol) {
    console.log(`🔍 Opening analysis for ${symbol}`);

    // Show Modal
    const modal = document.getElementById('coinModal');
    modal.classList.remove('hidden');

    // Set Title
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="modal-header">
            <h2>${symbol} Teknik Analiz & Scalper Terminali</h2>
            <div class="chart-controls">
                <button class="timeframe-btn active" onclick="updateModalChart('${symbol}', '1m', this)">1m</button>
                <button class="timeframe-btn" onclick="updateModalChart('${symbol}', '5m', this)">5m</button>
                <button class="timeframe-btn" onclick="updateModalChart('${symbol}', '15m', this)">15m</button>
                <button class="timeframe-btn" onclick="updateModalChart('${symbol}', '1h', this)">1h</button>
                <button class="timeframe-btn" onclick="updateModalChart('${symbol}', '4h', this)">4h</button>
            </div>
        </div>
        <div id="candlestickChart" style="height: 400px; width: 100%;"></div>
        <div id="rsiChart" style="height: 120px; width: 100%; margin-top: 10px; border-top: 1px solid var(--glass-border);"></div>
        <div id="stochChart" style="height: 120px; width: 100%; border-top: 1px solid var(--glass-border);"></div>
        <div id="macdChart" style="height: 120px; width: 100%; border-top: 1px solid var(--glass-border); border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;"></div>
    `;

    // Render Scalper Charts
    setTimeout(() => renderScalperCharts(symbol, '1h'), 100);
}

/**
 * Global function to close modal
 */
window.closeModal = function () {
    const modal = document.getElementById('coinModal');
    modal.classList.add('hidden');

    // Cleanup
    if (window.chartWs) {
        window.chartWs.close();
        window.chartWs = null;
    }
    if (window.charts && window.charts.length > 0) {
        window.charts.forEach(c => c.remove());
        window.charts = [];
    }
}

/**
 * Update chart timeframe in modal
 */
window.updateModalChart = function (symbol, interval, btn) {
    // Update button active state
    document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    renderScalperCharts(symbol, interval);
}

/**
 * THE CORE: Scalper Chart Engine
 */
async function renderScalperCharts(symbol, interval) {
    const mainContainer = document.getElementById('candlestickChart');
    const rsiContainer = document.getElementById('rsiChart');
    const stochContainer = document.getElementById('stochChart');
    const macdContainer = document.getElementById('macdChart');

    if (!mainContainer || !rsiContainer || !stochContainer || !macdContainer) return;

    // Cleanup existing
    if (window.charts && window.charts.length > 0) {
        window.charts.forEach(c => c.remove());
        window.charts = [];
    }
    if (window.chartWs) {
        window.chartWs.close();
        window.chartWs = null;
    }

    try {
        // Fetch Data
        const data = await api.getKlineData(symbol, interval, 300);

        // Calculations
        const rsiData = calculateRSI(data, 14);
        const stochData = calculateStochRSI(data, 14, 14, 3, 3);
        const macdData = calculateMACD(data, 12, 26, 9);
        const ema9 = calculateEMA(data, 9);
        const ema21 = calculateEMA(data, 21);
        const bb = calculateBollingerBands(data, 20, 2);

        const isLight = document.body.classList.contains('light-mode');
        const themeColors = {
            bg: isLight ? '#ffffff' : '#141933',
            text: isLight ? '#333333' : '#d1d4dc',
            grid: isLight ? '#f0f0f0' : '#232946'
        };

        const commonOptions = {
            width: mainContainer.clientWidth,
            layout: { background: { color: themeColors.bg }, textColor: themeColors.text },
            grid: { vertLines: { color: themeColors.grid }, horzLines: { color: themeColors.grid } },
            timeScale: { visible: true, timeVisible: true }
        };

        // 1. Candlestick + Overlays
        const mainChart = LightweightCharts.createChart(mainContainer, { ...commonOptions, height: 400 });
        const candleSeries = mainChart.addCandlestickSeries({ upColor: '#10b981', downColor: '#ef4444', borderVisible: false });
        candleSeries.setData(data);

        mainChart.addLineSeries({ color: '#60a5fa', lineWidth: 1, title: 'EMA 9' }).setData(ema9);
        mainChart.addLineSeries({ color: '#facc15', lineWidth: 1, title: 'EMA 21' }).setData(ema21);
        mainChart.addLineSeries({ color: 'rgba(255,255,255,0.1)', lineWidth: 1, lineStyle: 2 }).setData(bb.upper);
        mainChart.addLineSeries({ color: 'rgba(255,255,255,0.1)', lineWidth: 1, lineStyle: 2 }).setData(bb.lower);

        // 2. RSI
        const rsiChart = LightweightCharts.createChart(rsiContainer, { ...commonOptions, height: 120, timeScale: { visible: false } });
        rsiChart.addLineSeries({ color: '#f59e0b', lineWidth: 2 }).setData(rsiData);

        // 3. StochRSI
        const stochChart = LightweightCharts.createChart(stochContainer, { ...commonOptions, height: 120, timeScale: { visible: false } });
        stochChart.addLineSeries({ color: '#3b82f6', lineWidth: 2 }).setData(stochData.k);
        stochChart.addLineSeries({ color: '#ec4899', lineWidth: 2 }).setData(stochData.d);

        // 4. MACD
        const macdChart = LightweightCharts.createChart(macdContainer, { ...commonOptions, height: 120 });
        macdChart.addLineSeries({ color: '#2962FF', lineWidth: 1 }).setData(macdData.macd);
        macdChart.addLineSeries({ color: '#FF6D00', lineWidth: 1 }).setData(macdData.signal);
        macdChart.addHistogramSeries().setData(macdData.histogram);

        // Syncing
        window.charts = [mainChart, rsiChart, stochChart, macdChart];
        const sync = (src, targets) => {
            src.timeScale().subscribeVisibleLogicalRangeChange(r => targets.forEach(t => t.timeScale().setVisibleLogicalRange(r)));
        };
        sync(mainChart, [rsiChart, stochChart, macdChart]);
        sync(rsiChart, [mainChart, stochChart, macdChart]);
        sync(stochChart, [mainChart, rsiChart, macdChart]);
        sync(macdChart, [mainChart, rsiChart, stochChart]);

        mainChart.timeScale().fitContent();

        // WebSocket
        setupLiveUpdates(symbol, interval, candleSeries);

    } catch (e) {
        console.error('Render error:', e);
    }
}

function setupLiveUpdates(symbol, interval, series) {
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`;
    window.chartWs = new WebSocket(wsUrl);
    window.chartWs.onmessage = (e) => {
        const k = JSON.parse(e.data).k;
        series.update({
            time: k.t / 1000,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c)
        });
    };
}

/**
 * Setup UI Event Listeners
 */
function setupEventListeners() {
    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => tableComponent.search(e.target.value));
    }

    // Sort
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => tableComponent.setSort(e.target.value));
    }

    // Filter
    const filterSelect = document.getElementById('filterSelect');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => tableComponent.setFilter(e.target.value));
    }

    // View Toggle
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tableComponent.setViewMode(btn.dataset.view);
        });
    });

    // Theme Toggle
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            themeBtn.querySelector('.icon').textContent = document.body.classList.contains('light-mode') ? '☀️' : '🌙';
        });
    }

    // Refresh Btn
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('spinning');
            await initializeApp();
            refreshBtn.classList.remove('spinning');
        });
    }
}

// --- MATH HELPERS ---
function calculateEMA(d, p) {
    let ema = [];
    let k = 2 / (p + 1);
    let val = d[0].close;
    d.forEach(x => {
        val = (x.close - val) * k + val;
        ema.push({ time: x.time, value: val });
    });
    return ema;
}

function calculateBollingerBands(d, p, s) {
    let u = [], l = [], m = [];
    for (let i = p - 1; i < d.length; i++) {
        let sli = d.slice(i - p + 1, i + 1);
        let avg = sli.reduce((a, b) => a + b.close, 0) / p;
        let v = sli.reduce((a, b) => a + Math.pow(b.close - avg, 2), 0) / p;
        let sd = Math.sqrt(v);
        m.push({ time: d[i].time, value: avg });
        u.push({ time: d[i].time, value: avg + sd * s });
        l.push({ time: d[i].time, value: avg - sd * s });
    }
    return { upper: u, lower: l, middle: m };
}

function calculateRSI(d, p) {
    let rsi = [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= p; i++) {
        let diff = d[i].close - d[i - 1].close;
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    let avgG = gains / p, avgL = losses / p;
    for (let i = p; i < d.length; i++) {
        let diff = d[i].close - d[i - 1].close;
        if (i > p) {
            avgG = (avgG * (p - 1) + (diff > 0 ? diff : 0)) / p;
            avgL = (avgL * (p - 1) + (diff < 0 ? -diff : 0)) / p;
        }
        let rs = avgL === 0 ? 100 : avgG / avgL;
        rsi.push({ time: d[i].time, value: 100 - (100 / (1 + rs)) });
    }
    return rsi;
}

function calculateStochRSI(d, rP, sP, kP, dP) {
    try {
        const rsiObj = calculateRSI(d, rP);
        const r = rsiObj.map(x => x.value);
        let s = [];
        for (let i = sP; i <= r.length; i++) {
            let win = r.slice(i - sP, i);
            let low = Math.min(...win), high = Math.max(...win);
            s.push(high === low ? 100 : ((r[i - 1] - low) / (high - low)) * 100);
        }
        const kData = s.map((v, i, a) => ({ time: d[i + rP].time, value: a.slice(Math.max(0, i - kP + 1), i + 1).reduce((p, c) => p + c, 0) / kP }));
        const dData = kData.map((v, i, a) => ({ time: v.time, value: a.slice(Math.max(0, i - dP + 1), i + 1).reduce((p, c) => p + c.value, 0) / dP }));
        return { k: kData, d: dData };
    } catch (e) { return { k: [], d: [] }; }
}

function calculateMACD(d, f, s, sig) {
    try {
        const fEma = calculateEMA(d, f), sEma = calculateEMA(d, s);
        let mLine = [];
        sEma.forEach(sp => {
            const fp = fEma.find(x => x.time === sp.time);
            if (fp) mLine.push({ time: sp.time, value: fp.value - sp.value });
        });
        const sLine = calculateEMA(mLine.map(x => ({ time: x.time, close: x.value })), sig);
        let hist = [];
        sLine.forEach(slp => {
            const mlp = mLine.find(x => x.time === slp.time);
            if (mlp) {
                const v = mlp.value - slp.value;
                hist.push({ time: slp.time, value: v, color: v >= 0 ? '#10b981' : '#ef4444' });
            }
        });
        return { macd: mLine, signal: sLine, histogram: hist };
    } catch (e) { return { macd: [], signal: [], histogram: [] }; }
}
