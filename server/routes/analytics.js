const express = require('express');
const router = express.Router();
const pylonService = require('../services/pylonService');
const { cache } = require('../middleware/cache');

// Get daily flow data (created vs closed for last 14 days)
router.get('/daily-flow', async (req, res) => {
  try {
    const cacheKey = 'analytics:daily-flow';
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const dailyFlowData = await pylonService.getDailyFlowData();
    
    const result = {
      dailyFlow: {
        data: dailyFlowData,
        period: '14 days'
      },
      generatedAt: new Date().toISOString()
    };

    // Try to cache, but don't fail if Redis is not available
    try {
      await cache.set(cacheKey, result, 60); // Cache for 60 seconds
    } catch (cacheError) {
      console.log('Cache not available, skipping cache set');
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching daily flow data:', error);
    res.status(500).json({ error: 'Failed to fetch daily flow data' });
  }
});



// Get hourly heatmap data
router.get('/hourly-heatmap', async (req, res) => {
  try {
    const cacheKey = 'analytics:hourly-heatmap';
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const hourlyResponse = await pylonService.getHourlyTicketCreationData();
    const hourlyHeatmapData = hourlyResponse.data || [];
    
    const result = {
      hourlyHeatmap: {
        data: hourlyHeatmapData,
        period: '30 days (averages)'
      },
      generatedAt: new Date().toISOString()
    };

    // Try to cache, but don't fail if Redis is not available
    try {
      await cache.set(cacheKey, result, 3600); // Cache for 60 minutes
    } catch (cacheError) {
      console.log('Cache not available, skipping cache set');
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching hourly heatmap data:', error);
    res.status(500).json({ error: 'Failed to fetch hourly heatmap data' });
  }
});


module.exports = router;
