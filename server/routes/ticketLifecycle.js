const express = require('express');
const router = express.Router();
const { cache } = require('../middleware/cache');
const databaseService = require('../services/database');
const TicketLifecycleAggregationService = require('../services/ticketLifecycleAggregation');
const DailyIngestionService = require('../services/dailyIngestion');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const aggregationService = new TicketLifecycleAggregationService();
const dailyIngestionService = new DailyIngestionService();

// GET /api/ticket-lifecycle/data
router.get('/data', async (req, res) => {
  try {
    const {
      from,
      to,
      grouping = 'day',
      hoursMode = 'business',
      status
    } = req.query;

    // Validate required parameters
    if (!from || !to) {
      return res.status(400).json({
        error: 'Missing required parameters: from, to'
      });
    }

    // Validate grouping parameter
    if (!['day', 'week'].includes(grouping)) {
      return res.status(400).json({
        error: 'Invalid grouping parameter. Must be "day" or "week"'
      });
    }

    // Validate hoursMode parameter
    if (!['wall', 'business'].includes(hoursMode)) {
      return res.status(400).json({
        error: 'Invalid hoursMode parameter. Must be "wall" or "business"'
      });
    }

    // Validate date format
    const fromDate = dayjs(from);
    const toDate = dayjs(to);
    
    if (!fromDate.isValid() || !toDate.isValid()) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    if (fromDate.isAfter(toDate)) {
      return res.status(400).json({
        error: 'from date must be before to date'
      });
    }

    // Create cache key
    const cacheKey = `ticket-lifecycle:${from}:${to}:${grouping}:${hoursMode}:${status || 'all'}`;
    
    // Try to get from cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      // Add fresh ingestion metadata to cached response
      const ingestionStatus = await dailyIngestionService.getStatus();
      const lastIngestionDate = ingestionStatus.lastRun;
      
      const response = {
        ...cached,
        ingestionMetadata: {
          lastIngestionDate: lastIngestionDate ? lastIngestionDate.toISOString() : null,
          nextScheduledRun: ingestionStatus.nextScheduledRun ? ingestionStatus.nextScheduledRun.toISOString() : null,
          isRunning: ingestionStatus.isRunning
        }
      };
      
      return res.json(response);
    }

    // Get data from aggregation service
    const data = await aggregationService.getAggregationData({
      from,
      to,
      grouping,
      hoursMode,
      status: status ? status.split(',') : null
    });

    // Get last ingestion date
    const ingestionStatus = await dailyIngestionService.getStatus();
    const lastIngestionDate = ingestionStatus.lastRun;

    // Add ingestion metadata to response
    const response = {
      ...data,
      ingestionMetadata: {
        lastIngestionDate: lastIngestionDate ? lastIngestionDate.toISOString() : null,
        nextScheduledRun: ingestionStatus.nextScheduledRun ? ingestionStatus.nextScheduledRun.toISOString() : null,
        isRunning: ingestionStatus.isRunning
      }
    };

    // Cache the result
    const ttl = getCacheTTL(from, to);
    await cache.set(cacheKey, response, ttl);

    res.json(response);

  } catch (error) {
    console.error('Error fetching ticket lifecycle data:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET /api/ticket-lifecycle/statuses
router.get('/statuses', async (req, res) => {
  try {
    const cacheKey = 'ticket-lifecycle:statuses';
    
    // Try to get from cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get unique statuses from segments
    const result = await databaseService.query(`
      SELECT DISTINCT status
      FROM ticket_status_segments
      ORDER BY status
    `);

    const statuses = result.rows.map(row => row.status);

    // Cache for 1 hour
    await cache.set(cacheKey, { statuses }, 3600);

    res.json({ statuses });

  } catch (error) {
    console.error('Error fetching ticket lifecycle statuses:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// POST /api/ticket-lifecycle/aggregate
router.post('/aggregate', async (req, res) => {
  try {
    const {
      from,
      to,
      grouping = 'day'
    } = req.body;

    // Validate required parameters
    if (!from || !to) {
      return res.status(400).json({
        error: 'Missing required parameters: from, to'
      });
    }

    // Validate grouping parameter
    if (!['day', 'week'].includes(grouping)) {
      return res.status(400).json({
        error: 'Invalid grouping parameter. Must be "day" or "week"'
      });
    }

    // Validate date format
    const fromDate = dayjs(from);
    const toDate = dayjs(to);
    
    if (!fromDate.isValid() || !toDate.isValid()) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    if (fromDate.isAfter(toDate)) {
      return res.status(400).json({
        error: 'from date must be before to date'
      });
    }

    // Run aggregation
    await aggregationService.runAggregationForRange(from, to, grouping);

    // Clear related cache entries
    await clearCacheForRange(from, to);

    res.json({
      message: 'Aggregation completed successfully',
      from,
      to,
      grouping
    });

  } catch (error) {
    console.error('Error running ticket lifecycle aggregation:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET /api/ticket-lifecycle/stats
router.get('/stats', async (req, res) => {
  try {
    const cacheKey = 'ticket-lifecycle:stats';
    
    // Try to get from cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get statistics
    const [
      totalEvents,
      totalSegments,
      openSegments,
      dailyAggregations,
      weeklyAggregations
    ] = await Promise.all([
      databaseService.query('SELECT COUNT(*) as count FROM ticket_status_events'),
      databaseService.query('SELECT COUNT(*) as count FROM ticket_status_segments'),
      databaseService.query('SELECT COUNT(*) as count FROM ticket_status_segments WHERE left_at_utc IS NULL'),
      databaseService.query('SELECT COUNT(*) as count FROM ticket_status_agg_daily'),
      databaseService.query('SELECT COUNT(*) as count FROM ticket_status_agg_weekly')
    ]);

    const stats = {
      totalEvents: parseInt(totalEvents.rows[0].count),
      totalSegments: parseInt(totalSegments.rows[0].count),
      openSegments: parseInt(openSegments.rows[0].count),
      dailyAggregations: parseInt(dailyAggregations.rows[0].count),
      weeklyAggregations: parseInt(weeklyAggregations.rows[0].count),
      lastUpdated: new Date().toISOString()
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, stats, 300);

    res.json(stats);

  } catch (error) {
    console.error('Error fetching ticket lifecycle stats:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET /api/ticket-lifecycle/date-range
router.get('/date-range', async (req, res) => {
  try {
    const cacheKey = 'ticket-lifecycle:date-range';
    
    // Try to get from cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get the actual date range where we have data
    const [earliestData, latestData] = await Promise.all([
      databaseService.query(`
        SELECT MIN(bucket_date) as earliest_date 
        FROM ticket_status_agg_daily 
        WHERE count_segments > 0
      `),
      databaseService.query(`
        SELECT MAX(bucket_date) as latest_date 
        FROM ticket_status_agg_daily 
        WHERE count_segments > 0
      `)
    ]);

    const earliestDate = earliestData.rows[0]?.earliest_date;
    const latestDate = latestData.rows[0]?.latest_date;

    if (!earliestDate || !latestDate) {
      return res.json({
        hasData: false,
        message: 'No ticket lifecycle data available yet'
      });
    }

    const dateRange = {
      hasData: true,
      from: dayjs(earliestDate).format('YYYY-MM-DD'),
      to: dayjs(latestDate).format('YYYY-MM-DD'),
      fromFormatted: dayjs(earliestDate).format('YYYY-MM-DD'),
      toFormatted: dayjs(latestDate).format('YYYY-MM-DD'),
      totalDays: dayjs(latestDate).diff(dayjs(earliestDate), 'day') + 1
    };

    // Cache for 10 minutes
    await cache.set(cacheKey, dateRange, 600);

    res.json(dateRange);

  } catch (error) {
    console.error('Error fetching ticket lifecycle date range:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Helper function to determine cache TTL based on date range
function getCacheTTL(from, to) {
  const fromDate = dayjs(from);
  const toDate = dayjs(to);
  const now = dayjs();
  
  // If the range includes recent dates, cache for shorter time
  if (toDate.isAfter(now.subtract(1, 'day'))) {
    return 60; // 1 minute for recent data
  }
  
  // For historical data, cache longer
  return 3600; // 1 hour
}

// Helper function to clear cache for a date range
async function clearCacheForRange(from, to) {
  const patterns = [
    `ticket-lifecycle:${from}:${to}:*`,
    'ticket-lifecycle:statuses',
    'ticket-lifecycle:stats'
  ];

  for (const pattern of patterns) {
    await cache.del(pattern);
  }
}

// POST /api/ticket-lifecycle/clear-cache
router.post('/clear-cache', async (req, res) => {
  try {
    const { from, to } = req.body;
    
    if (from && to) {
      // Clear cache for specific date range
      await clearCacheForRange(from, to);
      res.json({ 
        message: `Cache cleared for range ${from} to ${to}`,
        from,
        to
      });
    } else {
      // Clear all ticket lifecycle cache
      const patterns = [
        'ticket-lifecycle:*'
      ];
      
      for (const pattern of patterns) {
        await cache.del(pattern);
      }
      
      res.json({ 
        message: 'All ticket lifecycle cache cleared'
      });
    }

  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router;
