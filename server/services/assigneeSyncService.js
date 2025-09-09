const pylonService = require('./pylonService');
const database = require('./database');
const TimezoneUtils = require('../utils/timezone');
const dayjs = require('dayjs');

/**
 * AssigneeSyncService - SINGLE SOURCE OF TRUTH for closed_by_assignee table
 * 
 * This is the ONLY service that should write to the closed_by_assignee table.
 * All other services (webhooks, daily ingestion, backfill) are disabled for this table.
 * 
 * This ensures data consistency by using periodic Pylon API calls as the source of truth.
 */
class AssigneeSyncService {
  constructor() {
    this.isRunning = false;
    this.lastSync = null;
    this.syncInterval = null;
  }

  /**
   * Start the periodic sync service (every 5 minutes)
   */
  startPeriodicSync() {
    if (this.syncInterval) {
      console.log('Assignee sync service already running');
      return;
    }

    console.log('🔄 Starting assignee sync service (every 5 minutes)');
    
    // Run immediately on start
    this.syncClosedByAssignee().catch(error => {
      console.error('Initial assignee sync failed:', error);
    });

    // Then run every 5 minutes
    this.syncInterval = setInterval(() => {
      this.syncClosedByAssignee().catch(error => {
        console.error('Periodic assignee sync failed:', error);
      });
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop the periodic sync service
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('🛑 Stopped assignee sync service');
    }
  }

  /**
   * Sync closed by assignee data from Pylon API
   */
  async syncClosedByAssignee() {
    if (this.isRunning) {
      console.log('⏳ Assignee sync already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting assignee sync from Pylon API...');

    try {
      // Sync today's data
      const today = TimezoneUtils.toVienna();
      await this.syncDateRange(today, today);

      // Sync last 30 days to catch any missed updates
      const thirtyDaysAgo = today.subtract(30, 'day');
      await this.syncDateRange(thirtyDaysAgo, today.subtract(1, 'day'));

      this.lastSync = new Date();
      console.log('✅ Assignee sync completed successfully');

    } catch (error) {
      console.error('❌ Assignee sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync closed by assignee data for a specific date range
   */
  async syncDateRange(fromDate, toDate) {
    console.log(`🔄 Syncing assignee data from ${fromDate.format('YYYY-MM-DD')} to ${toDate.format('YYYY-MM-DD')}`);

    // Fetch all users for assignee mapping
    const usersResponse = await pylonService.getUsers();
    const users = usersResponse.data || [];
    
    const assigneeMap = {};
    users.forEach(user => {
      if (user.id && user.name) {
        assigneeMap[user.id] = user.name;
      }
    });

    console.log(`📋 Found ${Object.keys(assigneeMap).length} users for assignee mapping`);

    // Process each day in the range
    let currentDate = fromDate;
    while (currentDate.isSame(toDate, 'day') || currentDate.isBefore(toDate, 'day')) {
      await this.syncSingleDay(currentDate, assigneeMap);
      currentDate = currentDate.add(1, 'day');
    }
  }

  /**
   * Sync closed by assignee data for a single day
   */
  async syncSingleDay(date, assigneeMap) {
    const dayStart = TimezoneUtils.getStartOfDayUTC(date);
    const dayEnd = TimezoneUtils.getEndOfDayUTC(date);
    const dateStr = date.format('YYYY-MM-DD');

    try {
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

      if (tickets.length === 0) {
        console.log(`   📅 ${dateStr}: No closed tickets found`);
        return;
      }

      // Group tickets by assignee
      const assigneeCounts = {};
      tickets.forEach(ticket => {
        if (ticket.assignee?.id) {
          const assigneeId = ticket.assignee.id;
          const assigneeName = assigneeMap[assigneeId] || 'Unknown';
          assigneeCounts[assigneeId] = (assigneeCounts[assigneeId] || 0) + 1;
        } else {
          // Handle unassigned tickets
          const assigneeId = 'unassigned';
          const assigneeName = 'Unassigned';
          assigneeCounts[assigneeId] = (assigneeCounts[assigneeId] || 0) + 1;
        }
      });

      // Get current database counts for this day
      const currentCounts = await this.getCurrentCountsForDay(date);

      // Compare and update only if different
      let hasChanges = false;
      for (const [assigneeId, newCount] of Object.entries(assigneeCounts)) {
        const assigneeName = assigneeId === 'unassigned' ? 'Unassigned' : assigneeMap[assigneeId] || 'Unknown';
        const currentCount = currentCounts[assigneeId] || 0;

        if (newCount !== currentCount) {
          console.log(`   🔄 ${dateStr} - ${assigneeName}: ${currentCount} → ${newCount}`);
          
          // Update the database
          await database.query(`
            INSERT INTO closed_by_assignee (bucket_start, bucket, assignee_id, assignee_name, count)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (bucket_start, bucket, assignee_id)
            DO UPDATE SET 
              assignee_name = EXCLUDED.assignee_name,
              count = EXCLUDED.count
          `, [dayStart.toISOString(), 'day', assigneeId, assigneeName, newCount]);

          // Update assignees table
          await database.query(`
            INSERT INTO assignees (assignee_id, assignee_name, updated_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (assignee_id)
            DO UPDATE SET 
              assignee_name = EXCLUDED.assignee_name,
              updated_at = EXCLUDED.updated_at
          `, [assigneeId, assigneeName, new Date().toISOString()]);

          hasChanges = true;
        }
      }

      // Remove assignees that are no longer in Pylon data
      for (const [assigneeId, currentCount] of Object.entries(currentCounts)) {
        if (!assigneeCounts[assigneeId] && currentCount > 0) {
          const assigneeName = assigneeId === 'unassigned' ? 'Unassigned' : assigneeMap[assigneeId] || 'Unknown';
          console.log(`   🗑️  ${dateStr} - ${assigneeName}: ${currentCount} → 0 (removed)`);
          
          await database.query(`
            UPDATE closed_by_assignee 
            SET count = 0
            WHERE bucket_start = $1::timestamptz 
              AND bucket = 'day' 
              AND assignee_id = $2
          `, [dayStart.toISOString(), assigneeId]);
          
          hasChanges = true;
        }
      }

      if (!hasChanges) {
        console.log(`   ✅ ${dateStr}: No changes needed (${tickets.length} tickets)`);
      } else {
        console.log(`   ✅ ${dateStr}: Updated (${tickets.length} tickets)`);
      }

    } catch (error) {
      console.error(`❌ Error syncing ${dateStr}:`, error);
    }
  }

  /**
   * Get current counts from database for a specific day
   */
  async getCurrentCountsForDay(date) {
    const dayStart = TimezoneUtils.getStartOfDayUTC(date);
    
    const result = await database.query(`
      SELECT assignee_id, count
      FROM closed_by_assignee
      WHERE bucket_start = $1::timestamptz 
        AND bucket = 'day'
    `, [dayStart.toISOString()]);

    const counts = {};
    result.rows.forEach(row => {
      counts[row.assignee_id] = parseInt(row.count);
    });

    return counts;
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      hasInterval: !!this.syncInterval
    };
  }
}

module.exports = new AssigneeSyncService();
