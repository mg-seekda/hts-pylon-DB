const redis = require('redis');

let redisClient = null;

// Initialize Redis client if enabled
if (process.env.REDIS_ENABLED === 'true') {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    // Redis connected successfully
  });

  redisClient.connect();
}

// Cache middleware
const cacheMiddleware = (req, res, next) => {
  if (!redisClient || process.env.REDIS_ENABLED !== 'true') {
    return next();
  }

  const key = `cache:${req.method}:${req.originalUrl}`;
  const ttl = 60; // 60 seconds default TTL

  // Try to get from cache
  redisClient.get(key)
    .then(cachedData => {
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }
      
      // Store original res.json
      const originalJson = res.json;
      res.json = function(data) {
        // Cache the response
        redisClient.setEx(key, ttl, JSON.stringify(data))
          .catch(err => console.error('Cache set error:', err));
        
        // Call original json method
        originalJson.call(this, data);
      };
      
      next();
    })
    .catch(err => {
      console.error('Cache get error:', err);
      next();
    });
};

// Cache helper functions
const cache = {
  async get(key) {
    if (!redisClient) return null;
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Cache get error:', err);
      return null;
    }
  },

  async set(key, value, ttl = 60) {
    if (!redisClient) return false;
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('Cache set error:', err);
      return false;
    }
  },

  // Stale-while-revalidate cache with metadata
  async getWithMetadata(key) {
    if (!redisClient) return null;
    try {
      const data = await redisClient.get(key);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      const now = Date.now();
      
      return {
        data: parsed.data,
        metadata: {
          cachedAt: parsed.metadata?.cachedAt || now,
          ttl: parsed.metadata?.ttl || 60,
          staleTime: parsed.metadata?.staleTime || 60,
          isStale: now - (parsed.metadata?.cachedAt || now) > (parsed.metadata?.staleTime || 60) * 1000,
          isExpired: now - (parsed.metadata?.cachedAt || now) > (parsed.metadata?.ttl || 60) * 1000
        }
      };
    } catch (err) {
      console.error('Cache get error:', err);
      return null;
    }
  },

  async setWithMetadata(key, data, ttl = 60, staleTime = 60) {
    if (!redisClient) return false;
    try {
      const cacheData = {
        data,
        metadata: {
          cachedAt: Date.now(),
          ttl,
          staleTime
        }
      };
      await redisClient.setEx(key, ttl, JSON.stringify(cacheData));
      return true;
    } catch (err) {
      console.error('Cache set error:', err);
      return false;
    }
  },

  async del(key) {
    if (!redisClient) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch (err) {
      console.error('Cache delete error:', err);
      return false;
    }
  },

  async clear(pattern = 'cache:*') {
    if (!redisClient) return false;
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (err) {
      console.error('Cache clear error:', err);
      return false;
    }
  }
};

module.exports = cacheMiddleware;
module.exports.cache = cache;
