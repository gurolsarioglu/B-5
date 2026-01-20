const NodeCache = require('node-cache');
const config = require('../config/binance.config');

class CacheManager {
    constructor() {
        this.cache = new NodeCache({
            stdTTL: config.CACHE_TTL,
            checkperiod: config.CACHE_CHECK_PERIOD,
            useClones: false
        });

        // Log cache statistics
        this.cache.on('set', (key) => {
            console.log(`Cache SET: ${key}`);
        });

        this.cache.on('expired', (key) => {
            console.log(`Cache EXPIRED: ${key}`);
        });
    }

    /**
     * Get value from cache
     */
    get(key) {
        return this.cache.get(key);
    }

    /**
     * Set value in cache
     */
    set(key, value, ttl = null) {
        if (ttl) {
            return this.cache.set(key, value, ttl);
        }
        return this.cache.set(key, value);
    }

    /**
     * Delete specific key from cache
     */
    del(key) {
        return this.cache.del(key);
    }

    /**
     * Flush all cache
     */
    flush() {
        return this.cache.flushAll();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return this.cache.getStats();
    }

    /**
     * Get all keys
     */
    keys() {
        return this.cache.keys();
    }
}

module.exports = new CacheManager();
