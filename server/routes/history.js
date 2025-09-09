const express = require('express');
const router = express.Router();
const database = require('../services/database');
const pylonService = require('../services/pylonService');
const TimezoneUtils = require('../utils/timezone');
const cacheMiddleware = require('../middleware/cache');
const { cache } = require('../middleware/cache');
const dayjs = require('dayjs');
const assigneeSyncService = require('../services/assigneeSyncService');

// GET /api/history/closed-by-assignee
router.get('/closed-by-assignee', async (req, res) => {
  try {
    const { from, to, bucket = 'day' } = req.query;

    if (!from || !to) {
      return res.status(400).json({ 
        error: 'Missing required parameters: from and to dates' 
      });
    }

    // Validate bucket
    if (!['day', 'week'].includes(bucket)) {
      return res.status(400).json({ 
        error: 'Invalid bucket. Must be "day" or "week"' 
      });
    }

    // Validate dates but allow future dates for historical data
    const { from: validFrom, to: validTo } = TimezoneUtils.validateDateRange(from, to, true);

    // Convert to UTC for database query
    const fromUTC = TimezoneUtils.getStartOfDayUTC(validFrom);
    const toUTC = TimezoneUtils.getEndOfDayUTC(validTo);

    // Create cache key
    const cacheKey = `closed-by-assignee:${from}:${to}:${bucket}`;
    const cached = await cache.getWithMetadata(cacheKey);
    
    // Always return cached data immediately if available (stale-while-revalidate)
    if (cached) {
      const response = {
        ...cached.data,
        cacheMetadata: {
          cachedAt: new Date(cached.metadata.cachedAt).toISOString(),
          isStale: cached.metadata.isStale,
          servingCached: cached.metadata.isStale // Only show "refreshing" when actually stale
        }
      };
      
      // Trigger background refresh if stale
      if (cached.metadata.isStale) {
        // Background refresh would go here if needed
      }
      
      return res.json(response);
    }

    // Query the database
    const query = `
      WITH base AS (
        SELECT bucket_start, assignee_id, assignee_name, count
        FROM closed_by_assignee
        WHERE bucket = 'day'
          AND bucket_start >= $1
          AND bucket_start < $2
      )
      SELECT
        CASE WHEN $3 = 'week'
             THEN date_trunc('week', bucket_start AT TIME ZONE 'Europe/Vienna') AT TIME ZONE 'Europe/Vienna'
             ELSE date_trunc('day', bucket_start AT TIME ZONE 'Europe/Vienna') AT TIME ZONE 'Europe/Vienna'
        END AS bucket_start,
        assignee_id,
        max(assignee_name) AS assignee_name,
        SUM(count) AS count
      FROM base
      GROUP BY 1,2
      ORDER BY 1 ASC;
    `;

    const result = await database.query(query, [fromUTC.toISOString(), toUTC.toISOString(), bucket]);
    
    // Format response
    const data = result.rows.map(row => ({
      bucket_start: TimezoneUtils.formatForDisplay(row.bucket_start, 'YYYY-MM-DD'),
      assignee_id: row.assignee_id,
      assignee_name: row.assignee_name,
      count: parseInt(row.count)
    }));

    const response = { data };
    
    // Cache the result (5 minutes TTL, 5 minutes stale)
    try {
      await cache.setWithMetadata(cacheKey, response, 300, 300);
    } catch (cacheError) {
      // Cache not available, skipping cache set
    }

    res.json({
      ...response,
      cacheMetadata: {
        cachedAt: new Date().toISOString(),
        isStale: false,
        servingCached: false
      }
    });
  } catch (error) {
    console.error('Error fetching closed by assignee data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch closed by assignee data',
      message: error.message 
    });
  }
});

// POST /api/history/backfill
router.post('/backfill', async (req, res) => {
  try {
    const { from, to } = req.body;

    if (!from || !to) {
      return res.status(400).json({ 
        error: 'Missing required parameters: from and to dates' 
      });
    }

    // Validate dates but allow future dates for historical data
    const { from: validFrom, to: validTo } = TimezoneUtils.validateDateRange(from, to, true);

    // Fetch all users to get assignee names
    const usersResponse = await pylonService.getUsers();
    const users = usersResponse.data || [];
    
    // Create a mapping of assignee ID to name
    const assigneeMap = {};
    users.forEach(user => {
      if (user.id && user.name) {
        assigneeMap[user.id] = user.name;
      }
    });
    

    // Process day by day
    const fromDate = TimezoneUtils.toVienna(validFrom);
    const toDate = TimezoneUtils.toVienna(validTo);
    let currentDate = fromDate;
    let processedDays = 0;
    let totalTickets = 0;

    while (currentDate.isSame(toDate, 'day') || currentDate.isBefore(toDate, 'day')) {
      try {
        const dayStart = TimezoneUtils.getStartOfDayUTC(currentDate);
        const dayEnd = TimezoneUtils.getEndOfDayUTC(currentDate);
        

        // Query Pylon for closed tickets on this day
        const filter = {
          search: true,
          limit: 1000,
          include: ['custom_fields'],
          filter: {
            operator: 'and',
            subfilters: [
              {
                field: 'state',
                operator: 'equals',
                value: 'closed'
              },
              {
                field: 'closed_at',
                operator: 'time_range',
                values: [dayStart.toISOString(), dayEnd.toISOString()]
              }
            ]
          }
        };

        const response = await pylonService.getIssues(filter);
        const tickets = response.data || [];

        // Debug: Log first ticket to see structure

        // Process tickets and group by assignee
        const assigneeCounts = {};
        const assignees = {};

        tickets.forEach(ticket => {
          if (ticket.assignee?.id) {
            const assigneeId = ticket.assignee.id;
            // Use the assignee mapping we fetched earlier, fallback to 'Unknown' if not found
            const assigneeName = assigneeMap[assigneeId] || 'Unknown';
            
            assigneeCounts[assigneeId] = (assigneeCounts[assigneeId] || 0) + 1;
            assignees[assigneeId] = assigneeName;
          }
        });

        // Upsert data into database
        for (const [assigneeId, count] of Object.entries(assigneeCounts)) {
          const assigneeName = assignees[assigneeId];
          
          // Check if this date is recent (within last 7 days) - if so, skip to avoid overwriting periodic sync data
          const daysDiff = dayjs().diff(currentDate, 'day');
          if (daysDiff <= 7) {
            continue;
          }
          
          // Upsert closed_by_assignee (only for historical data)
          await database.query(`
            INSERT INTO closed_by_assignee (bucket_start, bucket, assignee_id, assignee_name, count)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (bucket_start, bucket, assignee_id)
            DO UPDATE SET 
              assignee_name = EXCLUDED.assignee_name,
              count = EXCLUDED.count
          `, [dayStart.toISOString(), 'day', assigneeId, assigneeName, count]);

          // Upsert assignees table
          await database.query(`
            INSERT INTO assignees (assignee_id, assignee_name, updated_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (assignee_id)
            DO UPDATE SET 
              assignee_name = EXCLUDED.assignee_name,
              updated_at = EXCLUDED.updated_at
          `, [assigneeId, assigneeName, new Date().toISOString()]);
        }

        processedDays++;
        totalTickets += tickets.length;
        

        // Move to next day
        currentDate = currentDate.add(1, 'day');

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (dayError) {
        console.error(`Error processing ${currentDate.format('YYYY-MM-DD')}:`, dayError);
        // Continue with next day
        currentDate = currentDate.add(1, 'day');
      }
    }

    res.json({
      success: true,
      message: `Backfill completed: ${processedDays} days processed, ${totalTickets} tickets processed`,
      processedDays,
      totalTickets,
      from: validFrom,
      to: validTo
    });

  } catch (error) {
    console.error('Error during backfill:', error);
    res.status(500).json({ 
      error: 'Backfill failed',
      message: error.message 
    });
  }
});

// GET /api/history/date-presets
router.get('/date-presets', (req, res) => {
  try {
    const presets = TimezoneUtils.getDatePresets();
    res.json({ presets });
  } catch (error) {
    console.error('Error fetching date presets:', error);
    res.status(500).json({ 
      error: 'Failed to fetch date presets',
      message: error.message 
    });
  }
});

// POST /api/history/ingest-daily
router.post('/ingest-daily', async (req, res) => {
  try {
    const dailyIngestion = require('../services/dailyIngestion');
    await dailyIngestion.runDailyIngestion();
    
    res.json({
      success: true,
      message: 'Daily ingestion completed successfully'
    });
  } catch (error) {
    console.error('Error running daily ingestion:', error);
    res.status(500).json({ 
      error: 'Daily ingestion failed',
      message: error.message 
    });
  }
});

// POST /api/history/sync-assignees
router.post('/sync-assignees', async (req, res) => {
  try {
    await assigneeSyncService.syncClosedByAssignee();
    
    res.json({
      success: true,
      message: 'Assignee sync completed successfully'
    });
  } catch (error) {
    console.error('Error running assignee sync:', error);
    res.status(500).json({ 
      error: 'Assignee sync failed',
      message: error.message 
    });
  }
});

// POST /api/history/sync-assignees-range
router.post('/sync-assignees-range', async (req, res) => {
  try {
    const { from, to } = req.body;

    if (!from || !to) {
      return res.status(400).json({ 
        error: 'Missing required parameters: from and to dates' 
      });
    }

    // Validate dates
    const { from: validFrom, to: validTo } = TimezoneUtils.validateDateRange(from, to, true);
    
    const fromDate = TimezoneUtils.toVienna(validFrom);
    const toDate = TimezoneUtils.toVienna(validTo);
    
    await assigneeSyncService.syncDateRange(fromDate, toDate);
    
    res.json({
      success: true,
      message: `Assignee sync completed for ${fromDate.format('YYYY-MM-DD')} to ${toDate.format('YYYY-MM-DD')}`
    });
  } catch (error) {
    console.error('Error running assignee sync range:', error);
    res.status(500).json({ 
      error: 'Assignee sync range failed',
      message: error.message 
    });
  }
});

// GET /api/history/sync-status
router.get('/sync-status', async (req, res) => {
  try {
    const status = assigneeSyncService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ 
      error: 'Failed to get sync status',
      message: error.message 
    });
  }
});

module.exports = router;
