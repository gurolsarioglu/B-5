// BTC Status Component
class BTCStatusComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    /**
     * Render BTC status card
     */
    async render() {
        try {
            // Show skeleton while loading
            this.container.innerHTML = '<div class="loading-skeleton btc-skeleton"></div>';

            // Fetch BTC status
            const response = await api.getBTCStatus();
            const btcData = response.data;

            this.container.innerHTML = this.createCard(btcData);
        } catch (error) {
            console.error('Error rendering BTC status:', error);
            this.container.innerHTML = this.createErrorCard();
        }
    }

    /**
     * Create BTC status card HTML
     */
    createCard(data) {
        const trendClass = this.getTrendClass(data.trend);
        const priceChangeColor = parseFloat(data.priceChange24h) >= 0 ? 'text-success' : 'text-danger';
        const priceChangeIcon = parseFloat(data.priceChange24h) >= 0 ? '📈' : '📉';

        return `
      <div class="btc-status-card">
        <div class="btc-header">
          <div class="btc-title">
            <div class="btc-icon">₿</div>
            <div class="btc-title-text">
              <h2>Bitcoin (BTC)</h2>
              <p>Piyasa Durumu ve Trend Analizi</p>
            </div>
          </div>
          <div class="btc-trend ${trendClass}">
            ${priceChangeIcon} ${data.trend}
          </div>
        </div>

        <div class="btc-metrics">
          <div class="btc-metric">
            <div class="btc-metric-label">Anlık Fiyat</div>
            <div class="btc-metric-value">$${this.formatPrice(data.currentPrice)}</div>
          </div>

          <div class="btc-metric">
            <div class="btc-metric-label">24s Değişim</div>
            <div class="btc-metric-value ${priceChangeColor}">
              ${data.priceChange24h > 0 ? '+' : ''}${data.priceChange24h}%
            </div>
          </div>

          <div class="btc-metric">
            <div class="btc-metric-label">24s Hacim</div>
            <div class="btc-metric-value">$${this.formatVolume(data.volume24h)}</div>
          </div>

          <div class="btc-metric">
            <div class="btc-metric-label">RSI (14)</div>
            <div class="btc-metric-value" style="color: ${this.getRSIColor(data.rsi)}">
              ${data.rsi ? data.rsi.toFixed(2) : 'N/A'}
            </div>
          </div>

          <div class="btc-metric">
            <div class="btc-metric-label">Stochastic RSI</div>
            <div class="btc-metric-value" style="color: ${this.getStochRSIColor(data.stochRSI)}">
              ${data.stochRSI ? data.stochRSI.toFixed(2) : 'N/A'}
            </div>
          </div>

          <div class="btc-metric">
            <div class="btc-metric-label">24s Yüksek</div>
            <div class="btc-metric-value">$${this.formatPrice(data.high24h)}</div>
          </div>
        </div>

        <div class="btc-commentary">
          <p><strong>📊 Analiz:</strong> ${data.commentary}</p>
        </div>
      </div>
    `;
    }

    /**
     * Create error card
     */
    createErrorCard() {
        return `
      <div class="btc-status-card">
        <div class="error-container">
          <div class="error-icon">⚠️</div>
          <h3>BTC Verileri Yüklenemedi</h3>
          <p>Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.</p>
        </div>
      </div>
    `;
    }

    /**
     * Get trend CSS class
     */
    getTrendClass(trend) {
        const classMap = {
            'GÜÇLÜ YÜKSELİŞ': 'strong-bullish',
            'YÜKSELİŞ': 'bullish',
            'NÖTR': 'neutral',
            'DÜŞÜŞ': 'bearish',
            'GÜÇLÜ DÜŞÜŞ': 'strong-bearish'
        };
        return classMap[trend] || 'neutral';
    }

    /**
     * Get RSI color
     */
    getRSIColor(rsi) {
        if (!rsi) return 'var(--text-secondary)';
        if (rsi >= 70) return 'var(--color-danger)';
        if (rsi <= 30) return 'var(--color-success)';
        return 'var(--color-info)';
    }

    /**
     * Get Stochastic RSI color
     */
    getStochRSIColor(stochRSI) {
        if (!stochRSI) return 'var(--text-secondary)';
        if (stochRSI >= 80) return 'var(--color-danger)';
        if (stochRSI <= 20) return 'var(--color-success)';
        return 'var(--color-info)';
    }

    /**
     * Format price with commas
     */
    formatPrice(price) {
        if (!price) return 'N/A';
        return parseFloat(price).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /**
     * Format volume in millions/billions
     */
    formatVolume(volume) {
        if (!volume) return 'N/A';
        const num = parseFloat(volume);
        if (num >= 1e9) {
            return (num / 1e9).toFixed(2) + 'B';
        }
        if (num >= 1e6) {
            return (num / 1e6).toFixed(2) + 'M';
        }
        return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
}
