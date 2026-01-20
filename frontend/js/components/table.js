// Coin Table/Grid Component
class CoinTableComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.coins = [];
        this.filteredCoins = [];
        this.viewMode = 'grid'; // 'grid' or 'table'
        this.sortBy = 'volume';
        this.filterBy = 'all';
    }

    /**
     * Load and render coins
     */
    async loadCoins() {
        try {
            // Fetch coins with indicators
            const response = await api.getCoinsWithIndicators(50);
            this.coins = response.data;
            this.filteredCoins = [...this.coins];

            this.render();
            this.updateCoinCount();
        } catch (error) {
            console.error('Error loading coins:', error);
            this.renderError(error.message);
        }
    }

    /**
     * Render coins based on view mode
     */
    render() {
        if (this.viewMode === 'grid') {
            this.renderGrid();
        } else {
            this.renderTable();
        }
    }

    /**
     * Render grid view
     */
    renderGrid() {
        this.container.classList.remove('table-view');
        this.container.innerHTML = this.filteredCoins
            .map(coin => this.createCoinCard(coin))
            .join('');
    }

    /**
     * Render table view
     */
    renderTable() {
        this.container.classList.add('table-view');

        const tableHTML = `
      <table class="coins-table">
        <thead>
          <tr>
            <th>Coin</th>
            <th>Fiyat</th>
            <th>24s Değişim</th>
            <th>Hacim</th>
            <th>RSI</th>
            <th>Stoch RSI</th>
          </tr>
        </thead>
        <tbody>
          ${this.filteredCoins.map(coin => this.createTableRow(coin)).join('')}
        </tbody>
      </table>
    `;

        this.container.innerHTML = tableHTML;
    }

    /**
     * Create coin card HTML (grid view)
     */
    createCoinCard(coin) {
        const changeClass = coin.priceChangePercent >= 0 ? 'positive' : 'negative';
        const changeIcon = coin.priceChangePercent >= 0 ? '↑' : '↓';
        const indicators = coin.technicalIndicators || {};

        return `
      <div class="coin-card" onclick="window.showCoinDetails('${coin.symbol}')">
        <div class="coin-header">
          <div class="coin-name">
            <div class="coin-icon">${coin.coinName.substring(0, 2)}</div>
            <div class="coin-info">
              <h3>${coin.coinName}</h3>
              <span class="coin-symbol">${coin.symbol}</span>
            </div>
          </div>
          <div class="coin-change ${changeClass}">
            ${changeIcon} ${Math.abs(coin.priceChangePercent).toFixed(2)}%
          </div>
        </div>

        <div class="coin-price">
          <div class="current-price">$${this.formatPrice(coin.currentPrice)}</div>
          <div class="previous-price">
            Önceki: $${this.formatPrice(coin.previousPrice)}
          </div>
        </div>

        <div class="coin-stats">
          <div class="stat-item">
            <div class="stat-label">Hacim (24s)</div>
            <div class="stat-value">${this.formatVolume(coin.quoteVolume)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">İşlem Sayısı</div>
            <div class="stat-value">${this.formatNumber(coin.trades)}</div>
          </div>
        </div>

        <div class="coin-indicators">
          <div class="indicator">
            <div class="indicator-label">RSI</div>
            <div class="indicator-value" style="color: ${this.getRSIColor(indicators.rsi)}">
              ${indicators.rsi ? indicators.rsi.toFixed(1) : 'N/A'}
            </div>
            ${this.createIndicatorStatus(indicators.rsiInterpretation)}
          </div>
          <div class="indicator">
            <div class="indicator-label">Stoch RSI</div>
            <div class="indicator-value" style="color: ${this.getStochRSIColor(indicators.stochRSI)}">
              ${indicators.stochRSI ? indicators.stochRSI.toFixed(1) : 'N/A'}
            </div>
            ${this.createIndicatorStatus(indicators.stochRSIInterpretation)}
          </div>
        </div>
      </div>
    `;
    }

    /**
     * Create table row HTML (table view)
     */
    createTableRow(coin) {
        const changeClass = coin.priceChangePercent >= 0 ? 'text-success' : 'text-danger';
        const changeIcon = coin.priceChangePercent >= 0 ? '↑' : '↓';
        const indicators = coin.technicalIndicators || {};

        return `
      <tr onclick="window.showCoinDetails('${coin.symbol}')">
        <td>
          <div class="table-coin-name">
            <div class="table-coin-icon">${coin.coinName.substring(0, 2)}</div>
            <div>
              <div class="table-coin-symbol">${coin.coinName}</div>
              <div class="table-coin-full">${coin.symbol}</div>
            </div>
          </div>
        </td>
        <td>$${this.formatPrice(coin.currentPrice)}</td>
        <td class="${changeClass}">
          ${changeIcon} ${Math.abs(coin.priceChangePercent).toFixed(2)}%
        </td>
        <td>${this.formatVolume(coin.quoteVolume)}</td>
        <td style="color: ${this.getRSIColor(indicators.rsi)}">
          ${indicators.rsi ? indicators.rsi.toFixed(1) : 'N/A'}
        </td>
        <td style="color: ${this.getStochRSIColor(indicators.stochRSI)}">
          ${indicators.stochRSI ? indicators.stochRSI.toFixed(1) : 'N/A'}
        </td>
      </tr>
    `;
    }

    /**
     * Create indicator status badge
     */
    createIndicatorStatus(interpretation) {
        if (!interpretation || interpretation === 'UNKNOWN' || interpretation === 'ERROR') {
            return '';
        }

        const statusMap = {
            'OVERBOUGHT': 'overbought',
            'OVERSOLD': 'oversold',
            'NEUTRAL': 'neutral'
        };

        const statusClass = statusMap[interpretation] || 'neutral';
        const statusText = interpretation.toLowerCase();

        return `<div class="indicator-status ${statusClass}">${statusText}</div>`;
    }

    /**
     * Render error state
     */
    renderError(message) {
        const errorContainer = document.getElementById('errorContainer');
        const errorMessage = document.getElementById('errorMessage');

        errorContainer.classList.remove('hidden');
        this.container.innerHTML = '';
        document.getElementById('loadingContainer').style.display = 'none';

        errorMessage.textContent = message || 'Veriler yüklenirken bir hata oluştu.';
    }

    /**
     * Apply filters
     */
    applyFilters() {
        let filtered = [...this.coins];

        // Apply filter
        switch (this.filterBy) {
            case 'gainers':
                filtered = filtered.filter(c => c.priceChangePercent > 0);
                break;
            case 'losers':
                filtered = filtered.filter(c => c.priceChangePercent < 0);
                break;
            case 'oversold':
                filtered = filtered.filter(c => c.technicalIndicators?.rsi && c.technicalIndicators.rsi < 30);
                break;
            case 'overbought':
                filtered = filtered.filter(c => c.technicalIndicators?.rsi && c.technicalIndicators.rsi > 70);
                break;
        }

        // Apply sort
        switch (this.sortBy) {
            case 'volume':
                filtered.sort((a, b) => b.quoteVolume - a.quoteVolume);
                break;
            case 'priceChange':
                filtered.sort((a, b) => b.priceChangePercent - a.priceChangePercent);
                break;
            case 'price':
                filtered.sort((a, b) => b.currentPrice - a.currentPrice);
                break;
            case 'rsi':
                filtered.sort((a, b) => {
                    const aRsi = a.technicalIndicators?.rsi || 0;
                    const bRsi = b.technicalIndicators?.rsi || 0;
                    return bRsi - aRsi;
                });
                break;
        }

        this.filteredCoins = filtered;
        this.render();
        this.updateCoinCount();
    }

    /**
     * Search coins
     */
    search(query) {
        if (!query) {
            this.filteredCoins = [...this.coins];
        } else {
            const searchTerm = query.toLowerCase();
            this.filteredCoins = this.coins.filter(coin =>
                coin.coinName.toLowerCase().includes(searchTerm) ||
                coin.symbol.toLowerCase().includes(searchTerm)
            );
        }
        this.render();
        this.updateCoinCount();
    }

    /**
     * Update coin count display
     */
    updateCoinCount() {
        const countElement = document.getElementById('coinCount');
        if (countElement) {
            countElement.textContent = `${this.filteredCoins.length} coin gösteriliyor`;
        }
    }

    /**
     * Set view mode
     */
    setViewMode(mode) {
        this.viewMode = mode;
        this.render();
    }

    /**
     * Set sort option
     */
    setSort(sortBy) {
        this.sortBy = sortBy;
        this.applyFilters();
    }

    /**
     * Set filter option
     */
    setFilter(filterBy) {
        this.filterBy = filterBy;
        this.applyFilters();
    }

    // Utility functions
    formatPrice(price) {
        if (!price) return 'N/A';
        const num = parseFloat(price);
        if (num >= 1) {
            return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return num.toFixed(8).replace(/\.?0+$/, '');
    }

    formatVolume(volume) {
        if (!volume) return 'N/A';
        const num = parseFloat(volume);
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toFixed(0);
    }

    formatNumber(num) {
        if (!num) return 'N/A';
        return parseFloat(num).toLocaleString('en-US');
    }

    getRSIColor(rsi) {
        if (!rsi) return 'var(--text-secondary)';
        if (rsi >= 70) return 'var(--color-danger)';
        if (rsi <= 30) return 'var(--color-success)';
        return 'var(--color-info)';
    }

    getStochRSIColor(stochRSI) {
        if (!stochRSI) return 'var(--text-secondary)';
        if (stochRSI >= 80) return 'var(--color-danger)';
        if (stochRSI <= 20) return 'var(--color-success)';
        return 'var(--color-info)';
    }
}
