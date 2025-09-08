const database = require('./database');
const pylonService = require('./pylonService');
const TimezoneUtils = require('../utils/timezone');

class DailyIngestionService {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
  }

  async runDailyIngestion() {
    if (this.isRunning) {
      console.log('⏳ Daily ingestion already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting daily ingestion...');

    try {
      // Get yesterday in Vienna timezone
      const yesterday = TimezoneUtils.getYesterday();
      const dayStart = TimezoneUtils.getStartOfDayUTC(yesterday);
      const dayEnd = TimezoneUtils.getEndOfDayUTC(yesterday);

      console.log(`Processing tickets closed on ${yesterday.format('YYYY-MM-DD')}...`);

      // Fetch all users to get assignee names
      console.log('Fetching users from Pylon API...');
      const usersResponse = await pylonService.getUsers();
      const users = usersResponse.data || [];
      
      // Create a mapping of assignee ID to name
      const assigneeMap = {};
      users.forEach(user => {
        if (user.id && user.name) {
          assigneeMap[user.id] = user.name;
        }
      });
      
      console.log(`Found ${Object.keys(assigneeMap).length} users for assignee mapping`);

      // Query Pylon for closed tickets on yesterday
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

      console.log(`Found ${tickets.length} closed tickets for ${yesterday.format('YYYY-MM-DD')}`);

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
        
        // Upsert closed_by_assignee
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

      this.lastRun = new Date();
      console.log(`✅ Daily ingestion completed: ${tickets.length} tickets processed, ${Object.keys(assigneeCounts).length} assignees`);

    } catch (error) {
      console.error('❌ Daily ingestion failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Schedule daily ingestion at 1 AM Vienna time
  scheduleDailyIngestion() {
    const now = TimezoneUtils.toVienna();
    const nextRun = now.add(1, 'day').startOf('day').add(1, 'hour'); // 1 AM tomorrow
    const delay = nextRun.diff(now);

    console.log(`📅 Daily ingestion scheduled for ${nextRun.format('YYYY-MM-DD HH:mm:ss')} Vienna time`);

    setTimeout(() => {
      this.runDailyIngestion();
      // Schedule next run (24 hours later)
      this.scheduleDailyIngestion();
    }, delay);
  }

  // Get ingestion status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextScheduledRun: this.lastRun ? new Date(this.lastRun.getTime() + 24 * 60 * 60 * 1000) : null
    };
  }
}

module.exports = new DailyIngestionService();
