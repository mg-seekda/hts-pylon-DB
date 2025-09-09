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
    this.todaySyncInterval = null;
    this.historicalSyncInterval = null;
  }

  /**
   * Start the periodic sync service
   * - Today: every 5 minutes
   * - Historical (last 30 days): every 1 hour
   */
  startPeriodicSync() {
    if (this.todaySyncInterval || this.historicalSyncInterval) {
      console.log('Assignee sync service already running');
      return;
    }

    console.log('🔄 Starting assignee sync service');
    console.log('   📅 Today sync: every 5 minutes');
    console.log('   📚 Historical sync: every 1 hour');
    
    // Run immediately on start
    this.syncToday().catch(error => {
      console.error('Initial today sync failed:', error);
    });
    this.syncHistorical().catch(error => {
      console.error('Initial historical sync failed:', error);
    });

    // Today sync every 5 minutes
    this.todaySyncInterval = setInterval(() => {
      this.syncToday().catch(error => {
        console.error('Today sync failed:', error);
      });
    }, 5 * 60 * 1000); // 5 minutes

    // Historical sync every 1 hour
    this.historicalSyncInterval = setInterval(() => {
      this.syncHistorical().catch(error => {
        console.error('Historical sync failed:', error);
      });
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Stop the periodic sync service
   */
  stopPeriodicSync() {
    if (this.todaySyncInterval) {
      clearInterval(this.todaySyncInterval);
      this.todaySyncInterval = null;
    }
    if (this.historicalSyncInterval) {
      clearInterval(this.historicalSyncInterval);
      this.historicalSyncInterval = null;
    }
    console.log('🛑 Stopped assignee sync service');
  }

  /**
   * Sync today's data only
   */
  async syncToday() {
    if (this.isRunning) {
      console.log('⏳ Today sync already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Syncing today\'s data...');

    try {
      const today = TimezoneUtils.toVienna();
      await this.syncDateRange(today, today);
      console.log('✅ Today sync completed successfully');
    } catch (error) {
      console.error('❌ Today sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync historical data (last 30 days)
   */
  async syncHistorical() {
    if (this.isRunning) {
      console.log('⏳ Historical sync already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Syncing historical data (last 30 days)...');

    try {
      const today = TimezoneUtils.toVienna();
      const thirtyDaysAgo = today.subtract(30, 'day');
      await this.syncDateRange(thirtyDaysAgo, today.subtract(1, 'day'));
      
      this.lastSync = new Date();
      console.log('✅ Historical sync completed successfully');
    } catch (error) {
      console.error('❌ Historical sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync closed by assignee data from Pylon API (legacy method for manual calls)
   */
  async syncClosedByAssignee() {
    await this.syncToday();
    await this.syncHistorical();
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

    // Process in 5-day batches to avoid hitting the 1000 limit
    const batchSize = 5;
    let currentBatchStart = fromDate;
    
    while (currentBatchStart.isSame(toDate, 'day') || currentBatchStart.isBefore(toDate, 'day')) {
      const potentialEnd = currentBatchStart.add(batchSize - 1, 'day');
      const currentBatchEnd = potentialEnd.isAfter(toDate) ? toDate : potentialEnd;
      
      console.log(`   📦 Processing batch: ${currentBatchStart.format('YYYY-MM-DD')} to ${currentBatchEnd.format('YYYY-MM-DD')}`);
      
      await this.syncBatch(currentBatchStart, currentBatchEnd, assigneeMap);
      
      currentBatchStart = currentBatchEnd.add(1, 'day');
    }
  }

  /**
   * Sync a single batch of days (max 5 days)
   */
  async syncBatch(fromDate, toDate, assigneeMap) {
    const dayStart = TimezoneUtils.getStartOfDayUTC(fromDate);
    const dayEnd = TimezoneUtils.getEndOfDayUTC(toDate);

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
      console.log(`     📅 No closed tickets found in batch`);
      return;
    }

    console.log(`     📊 Found ${tickets.length} closed tickets in batch`);

    // Group tickets by date and assignee
    const ticketsByDate = {};
    tickets.forEach(ticket => {
      if (ticket.custom_fields?.closed_at?.value) {
        const closedAt = dayjs(ticket.custom_fields.closed_at.value).tz('Europe/Vienna');
        const dateStr = closedAt.format('YYYY-MM-DD');
        
        if (!ticketsByDate[dateStr]) {
          ticketsByDate[dateStr] = {};
        }

        const assigneeId = ticket.assignee?.id || 'unassigned';
        const assigneeName = assigneeId === 'unassigned' ? 'Unassigned' : assigneeMap[assigneeId] || 'Unknown';
        
        ticketsByDate[dateStr][assigneeId] = (ticketsByDate[dateStr][assigneeId] || 0) + 1;
      }
    });

    // Process each day that has tickets
    let currentDate = fromDate;
    while (currentDate.isSame(toDate, 'day') || currentDate.isBefore(toDate, 'day')) {
      const dateStr = currentDate.format('YYYY-MM-DD');
      const dayTickets = ticketsByDate[dateStr] || {};
      
      if (Object.keys(dayTickets).length > 0) {
        await this.updateDayData(currentDate, dayTickets, assigneeMap);
      } else {
        console.log(`     📅 ${dateStr}: No closed tickets found`);
      }
      
      currentDate = currentDate.add(1, 'day');
    }
  }

  /**
   * Update day data in the database
   */
  async updateDayData(date, assigneeCounts, assigneeMap) {
    const dayStart = TimezoneUtils.getStartOfDayUTC(date);
    const dateStr = date.format('YYYY-MM-DD');

    try {
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
        console.log(`   ✅ ${dateStr}: No changes needed`);
      } else {
        console.log(`   ✅ ${dateStr}: Updated`);
      }

    } catch (error) {
      console.error(`❌ Error updating ${dateStr}:`, error);
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
      todaySyncActive: !!this.todaySyncInterval,
      historicalSyncActive: !!this.historicalSyncInterval,
      todayInterval: '5 minutes',
      historicalInterval: '1 hour'
    };
  }
}

module.exports = new AssigneeSyncService();
