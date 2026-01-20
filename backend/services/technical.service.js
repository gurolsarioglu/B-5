const config = require('../config/binance.config');

class TechnicalService {
    /**
     * Calculate RSI (Relative Strength Index) using pure JavaScript
     * @param {Array} closePrices - Array of closing prices
     * @param {number} period - RSI period (default: 14)
     */
    calculateRSI(closePrices, period = config.RSI_PERIOD) {
        try {
            // Ensure we have enough data
            if (closePrices.length < period + 1) {
                console.warn(`Not enough data for RSI calculation. Need at least ${period + 1} candles, got ${closePrices.length}`);
                return null;
            }

            // Calculate price changes
            const changes = [];
            for (let i = 1; i < closePrices.length; i++) {
                changes.push(closePrices[i] - closePrices[i - 1]);
            }

            // Separate gains and losses
            const gains = changes.map(change => change > 0 ? change : 0);
            const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);

            // Calculate initial average gain and loss
            let avgGain = gains.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
            let avgLoss = losses.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

            // Calculate RSI using smoothed averages
            for (let i = period; i < gains.length; i++) {
                avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
                avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
            }

            // Calculate RS and RSI
            if (avgLoss === 0) {
                return 100;
            }

            const rs = avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));

            return rsi;
        } catch (error) {
            console.error('Error calculating RSI:', error.message);
            return null;
        }
    }

    /**
     * Calculate Stochastic RSI
     * @param {Array} closePrices - Array of closing prices
     * @param {number} period - Period for calculation
     */
    calculateStochasticRSI(closePrices, period = config.STOCH_RSI_PERIOD) {
        try {
            // Calculate RSI values
            const rsiValues = [];

            for (let i = period; i < closePrices.length; i++) {
                const slice = closePrices.slice(i - period - 1, i + 1);
                const rsi = this.calculateRSI(slice, period);
                if (rsi !== null) {
                    rsiValues.push(rsi);
                }
            }

            if (rsiValues.length < period) {
                console.warn('Not enough RSI values for Stochastic RSI');
                return null;
            }

            // Calculate Stochastic RSI using the last 'period' RSI values
            const recentRSI = rsiValues.slice(-period);
            const minRSI = Math.min(...recentRSI);
            const maxRSI = Math.max(...recentRSI);
            const currentRSI = recentRSI[recentRSI.length - 1];

            // Stochastic formula
            if (maxRSI === minRSI) {
                return 50; // Return neutral value if no variation
            }

            const stochRSI = ((currentRSI - minRSI) / (maxRSI - minRSI)) * 100;

            return stochRSI;
        } catch (error) {
            console.error('Error calculating Stochastic RSI:', error.message);
            return null;
        }
    }

    /**
     * Calculate Simple Moving Average
     * @param {Array} values - Array of values
     * @param {number} period - SMA period
     */
    calculateSMA(values, period) {
        try {
            if (values.length < period) {
                return null;
            }

            const slice = values.slice(-period);
            const sum = slice.reduce((acc, val) => acc + val, 0);
            return sum / period;
        } catch (error) {
            console.error('Error calculating SMA:', error.message);
            return null;
        }
    }

    /**
     * Calculate Exponential Moving Average
     * @param {Array} values - Array of values
     * @param {number} period - EMA period
     */
    calculateEMA(values, period) {
        try {
            if (values.length < period) {
                return null;
            }

            const multiplier = 2 / (period + 1);

            // Start with SMA
            let ema = this.calculateSMA(values.slice(0, period), period);

            // Calculate EMA for remaining values
            for (let i = period; i < values.length; i++) {
                ema = (values[i] - ema) * multiplier + ema;
            }

            return ema;
        } catch (error) {
            console.error('Error calculating EMA:', error.message);
            return null;
        }
    }

    /**
     * Get RSI interpretation
     */
    getRSIInterpretation(rsi) {
        if (rsi === null || rsi === undefined) return 'UNKNOWN';
        if (rsi >= 70) return 'OVERBOUGHT';
        if (rsi <= 30) return 'OVERSOLD';
        return 'NEUTRAL';
    }

    /**
     * Get Stochastic RSI interpretation
     */
    getStochRSIInterpretation(stochRSI) {
        if (stochRSI === null || stochRSI === undefined) return 'UNKNOWN';
        if (stochRSI >= 80) return 'OVERBOUGHT';
        if (stochRSI <= 20) return 'OVERSOLD';
        return 'NEUTRAL';
    }

    /**
     * Calculate multiple technical indicators for a symbol
     */
    async calculateAllIndicators(closePrices) {
        try {
            // Calculate all indicators
            const rsi = this.calculateRSI(closePrices);
            const stochRSI = this.calculateStochasticRSI(closePrices);
            const sma7 = this.calculateSMA(closePrices, 7);
            const sma25 = this.calculateSMA(closePrices, 25);
            const ema7 = this.calculateEMA(closePrices, 7);

            return {
                rsi: rsi !== null ? parseFloat(rsi.toFixed(2)) : null,
                rsiInterpretation: this.getRSIInterpretation(rsi),
                stochRSI: stochRSI !== null ? parseFloat(stochRSI.toFixed(2)) : null,
                stochRSIInterpretation: this.getStochRSIInterpretation(stochRSI),
                sma7: sma7 !== null ? parseFloat(sma7.toFixed(8)) : null,
                sma25: sma25 !== null ? parseFloat(sma25.toFixed(8)) : null,
                ema7: ema7 !== null ? parseFloat(ema7.toFixed(8)) : null
            };
        } catch (error) {
            console.error('Error calculating indicators:', error.message);
            return {
                rsi: null,
                rsiInterpretation: 'ERROR',
                stochRSI: null,
                stochRSIInterpretation: 'ERROR',
                sma7: null,
                sma25: null,
                ema7: null
            };
        }
    }
}

module.exports = new TechnicalService();
