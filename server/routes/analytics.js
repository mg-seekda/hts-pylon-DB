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
      data: dailyFlowData,
      period: '14 days',
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



// Get comprehensive analytics dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    // Analytics dashboard endpoint called
    const cacheKey = 'analytics:dashboard';
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      // Returning cached analytics data
      return res.json(cached);
    }

    // Fetching fresh analytics data
    
    // Only fetch daily flow data since we removed other components
    let dailyFlowData;
    
    try {
      dailyFlowData = await pylonService.getDailyFlowData();
    } catch (error) {
      console.error('Error fetching daily flow data:', error);
      dailyFlowData = [];
    }

    const result = {
      dailyFlow: {
        data: dailyFlowData,
        period: '14 days'
      },
      generatedAt: new Date().toISOString()
    };

    // Analytics data prepared, attempting to cache

    // Try to cache, but don't fail if Redis is not available
    try {
      await cache.set(cacheKey, result, 60); // Cache for 60 seconds
    } catch (cacheError) {
      // Cache not available, skipping cache set
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
});

// Get hourly heatmap data
router.get('/hourly-heatmap', async (req, res) => {
  try {
    // Hourly heatmap endpoint called
    const cacheKey = 'analytics:hourly-heatmap';
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      // Returning cached hourly heatmap data
      return res.json(cached);
    }

    // Fetching fresh hourly heatmap data
    const hourlyData = await pylonService.getHourlyTicketCreationData(90);
    
    const result = {
      data: hourlyData.data,
      period: '90 days',
      generatedAt: new Date().toISOString()
    };

    // Try to cache, but don't fail if Redis is not available
    try {
      await cache.set(cacheKey, result, 60); // Cache for 60 seconds
    } catch (cacheError) {
      // Cache not available, skipping cache set
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching hourly heatmap data:', error);
    res.status(500).json({ error: 'Failed to fetch hourly heatmap data' });
  }
});

module.exports = router;
