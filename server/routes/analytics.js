const express = require('express');
const router = express.Router();
const pylonService = require('../services/pylonService');
const { cache } = require('../middleware/cache');

// Background refresh functions for stale-while-revalidate
async function refreshDailyFlowInBackground(cacheKey) {
  try {
    const dailyFlowData = await pylonService.getDailyFlowData();
    
    const result = {
      dailyFlow: {
        data: dailyFlowData,
        period: '14 days'
      },
      generatedAt: new Date().toISOString()
    };

    await cache.setWithMetadata(cacheKey, result, 60, 60);
  } catch (error) {
    console.error('Background refresh failed: Daily flow data', error);
  }
}

async function refreshHourlyHeatmapInBackground(cacheKey) {
  try {
    // Background refresh: Hourly heatmap data
    const hourlyResponse = await pylonService.getHourlyTicketCreationData();
    const hourlyHeatmapData = hourlyResponse.data || [];
    
    const result = {
      hourlyHeatmap: {
        data: hourlyHeatmapData,
        period: '30 days (averages)'
      },
      generatedAt: new Date().toISOString()
    };

    await cache.setWithMetadata(cacheKey, result, 3600, 3600);
    // Background refresh completed: Hourly heatmap data
  } catch (error) {
    console.error('Background refresh failed: Hourly heatmap data', error);
  }
}

// Get daily flow data (created vs closed for last 14 days)
router.get('/daily-flow', async (req, res) => {
  try {
    const cacheKey = 'analytics:daily-flow';
    const cached = await cache.getWithMetadata(cacheKey);
    
    // Always return cached data immediately if available
    if (cached && !cached.metadata.isExpired) {
      const response = {
        ...cached.data,
        cacheMetadata: {
          cachedAt: new Date(cached.metadata.cachedAt).toISOString(),
          isStale: cached.metadata.isStale,
          servingCached: cached.metadata.isStale
        }
      };
      
      // Trigger background refresh if stale
      if (cached.metadata.isStale) {
        refreshDailyFlowInBackground(cacheKey);
      }
      
      return res.json(response);
    }

    // No cache or expired - fetch fresh data
    const dailyFlowData = await pylonService.getDailyFlowData();
    
    const result = {
      dailyFlow: {
        data: dailyFlowData,
        period: '14 days'
      },
      generatedAt: new Date().toISOString()
    };

    // Cache with metadata (60s TTL, 60s stale time)
    try {
      await cache.setWithMetadata(cacheKey, result, 60, 60);
    } catch (cacheError) {
    }
    
    res.json({
      ...result,
      cacheMetadata: {
        cachedAt: new Date().toISOString(),
        isStale: false,
        servingCached: false
      }
    });
  } catch (error) {
    console.error('Error fetching daily flow data:', error);
    
    // Try to serve stale cache if available
    const cached = await cache.getWithMetadata('analytics:daily-flow');
    if (cached) {
      return res.json({
        ...cached.data,
        cacheMetadata: {
          cachedAt: new Date(cached.metadata.cachedAt).toISOString(),
          isStale: true,
          servingCached: true,
          warning: 'Serving cached data due to API error'
        }
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch daily flow data' });
  }
});



// Get hourly heatmap data
router.get('/hourly-heatmap', async (req, res) => {
  try {
    const cacheKey = 'analytics:hourly-heatmap';
    const cached = await cache.getWithMetadata(cacheKey);
    
    // Always return cached data immediately if available
    if (cached && !cached.metadata.isExpired) {
      const response = {
        ...cached.data,
        cacheMetadata: {
          cachedAt: new Date(cached.metadata.cachedAt).toISOString(),
          isStale: cached.metadata.isStale,
          servingCached: cached.metadata.isStale
        }
      };
      
      // Trigger background refresh if stale
      if (cached.metadata.isStale) {
        refreshHourlyHeatmapInBackground(cacheKey);
      }
      
      return res.json(response);
    }

    // No cache or expired - fetch fresh data
    const hourlyResponse = await pylonService.getHourlyTicketCreationData();
    const hourlyHeatmapData = hourlyResponse.data || [];
    
    const result = {
      hourlyHeatmap: {
        data: hourlyHeatmapData,
        period: '30 days (averages)'
      },
      generatedAt: new Date().toISOString()
    };

    // Cache with metadata (60min TTL, 60min stale time)
    try {
      await cache.setWithMetadata(cacheKey, result, 3600, 3600);
    } catch (cacheError) {
    }
    
    res.json({
      ...result,
      cacheMetadata: {
        cachedAt: new Date().toISOString(),
        isStale: false,
        servingCached: false
      }
    });
  } catch (error) {
    console.error('Error fetching hourly heatmap data:', error);
    
    // Try to serve stale cache if available
    const cached = await cache.getWithMetadata('analytics:hourly-heatmap');
    if (cached) {
      return res.json({
        ...cached.data,
        cacheMetadata: {
          cachedAt: new Date(cached.metadata.cachedAt).toISOString(),
          isStale: true,
          servingCached: true,
          warning: 'Serving cached data due to API error'
        }
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch hourly heatmap data' });
  }
});


module.exports = router;
