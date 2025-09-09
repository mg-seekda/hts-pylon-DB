const database = require('./database');
const pylonService = require('./pylonService');
const TimezoneUtils = require('../utils/timezone');
const TicketLifecycleAggregationService = require('./ticketLifecycleAggregation');
// const logger = require('../utils/logger'); // Temporarily disabled

class DailyIngestionService {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.aggregationService = new TicketLifecycleAggregationService();
    this.initialized = false;
  }

  // Initialize last run date from database on startup
  async initializeLastRun() {
    try {
      await this.loadLastRunFromDatabase();
      if (this.lastRun) {
        console.log(`📅 Daily ingestion service initialized. Last run: ${this.lastRun.toISOString()}`);
      } else {
        console.log('📅 Daily ingestion service initialized. No previous runs found.');
      }
    } catch (error) {
      console.error('Error initializing daily ingestion service:', error);
      // Don't throw - allow service to continue without last run date
      this.lastRun = null;
    }
  }

  // Load last run date from database
  async loadLastRunFromDatabase() {
    try {
      const query = `
        SELECT last_run 
        FROM ingestion_metadata 
        WHERE service_name = 'daily_ingestion' 
        ORDER BY last_run DESC 
        LIMIT 1
      `;
      const result = await database.query(query);
      
      if (result.rows.length > 0) {
        this.lastRun = new Date(result.rows[0].last_run);
      }
    } catch (error) {
      // Table might not exist yet, this is expected on first run
      if (error.message && error.message.includes('relation "ingestion_metadata" does not exist')) {
        console.log('📅 ingestion_metadata table does not exist yet, will be created on first run');
      } else {
        console.error('Error loading last run from database:', error.message || error);
      }
      // Continue without last run date if database query fails
      this.lastRun = null;
    }
  }

  // Save last run date to database
  async saveLastRunToDatabase() {
    try {
      // Create table if it doesn't exist
      await this.ensureTableExists();
      
      const query = `
        INSERT INTO ingestion_metadata (service_name, last_run, created_at)
        VALUES ('daily_ingestion', $1, NOW())
      `;
      await database.query(query, [this.lastRun.toISOString()]);
      console.log(`📅 Last run date saved to database: ${this.lastRun.toISOString()}`);
    } catch (error) {
      console.error('Error saving last run to database:', error.message || error);
      // Continue even if database save fails
    }
  }

  // Ensure the ingestion_metadata table exists
  async ensureTableExists() {
    try {
      const query = `
        CREATE TABLE IF NOT EXISTS ingestion_metadata (
          id SERIAL PRIMARY KEY,
          service_name VARCHAR(100) NOT NULL,
          last_run TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_ingestion_metadata_service_name 
        ON ingestion_metadata(service_name);
        
        CREATE INDEX IF NOT EXISTS idx_ingestion_metadata_last_run 
        ON ingestion_metadata(last_run DESC);
      `;
      await database.query(query);
      console.log('📅 ingestion_metadata table ensured');
    } catch (error) {
      console.error('Error creating ingestion_metadata table:', error.message || error);
      // Don't throw - allow service to continue without persistence
    }
  }

  async runDailyIngestion() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      // Get yesterday in Vienna timezone
      const yesterday = TimezoneUtils.getYesterday();
      const dayStart = TimezoneUtils.getStartOfDayUTC(yesterday);
      const dayEnd = TimezoneUtils.getEndOfDayUTC(yesterday);


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


      // DISABLED: Assignee counting now handled by periodic Pylon API sync for data consistency
      // This ensures only one source of truth for closed_by_assignee data
      // Process tickets and group by assignee
      // const assigneeCounts = {};
      // const assignees = {};

      // tickets.forEach(ticket => {
      //   if (ticket.assignee?.id) {
      //     const assigneeId = ticket.assignee.id;
      //     // Use the assignee mapping we fetched earlier, fallback to 'Unknown' if not found
      //     const assigneeName = assigneeMap[assigneeId] || 'Unknown';
          
      //     assigneeCounts[assigneeId] = (assigneeCounts[assigneeId] || 0) + 1;
      //     assignees[assigneeId] = assigneeName;
      //   }
      // });

      // // Upsert data into database
      // for (const [assigneeId, count] of Object.entries(assigneeCounts)) {
      //   const assigneeName = assignees[assigneeId];
        
      //   // Upsert closed_by_assignee
      //   await database.query(`
      //     INSERT INTO closed_by_assignee (bucket_start, bucket, assignee_id, assignee_name, count)
      //     VALUES ($1, $2, $3, $4, $5)
      //     ON CONFLICT (bucket_start, bucket, assignee_id)
      //     DO UPDATE SET 
      //       assignee_name = EXCLUDED.assignee_name,
      //       count = EXCLUDED.count
      //   `, [dayStart.toISOString(), 'day', assigneeId, assigneeName, count]);

      //   // Upsert assignees table
      //   await database.query(`
      //     INSERT INTO assignees (assignee_id, assignee_name, updated_at)
      //     VALUES ($1, $2, $3)
      //     ON CONFLICT (assignee_id)
      //     DO UPDATE SET 
      //       assignee_name = EXCLUDED.assignee_name,
      //       updated_at = EXCLUDED.updated_at
      //   `, [assigneeId, assigneeName, new Date().toISOString()]);
      // }


      // Run ticket lifecycle aggregations
      
      try {
        // Daily aggregation for yesterday
        await this.aggregationService.runDailyAggregation(yesterday.toDate());
      } catch (error) {
        console.error('❌ Daily lifecycle aggregation failed:', error);
        // Don't throw here, continue with the rest of the process
      }
      
      try {
        // Weekly aggregation for the previous week (run daily to catch any missed weeks)
        const previousWeek = yesterday.subtract(1, 'week');
        const year = previousWeek.isoYear();
        const week = previousWeek.isoWeek();
        await this.aggregationService.runWeeklyAggregation(year, week);
      } catch (error) {
        // Get year and week for error message, with fallback if calculation fails
        let yearStr = 'unknown';
        let weekStr = 'unknown';
        try {
          const previousWeek = yesterday.subtract(1, 'week');
          yearStr = previousWeek.isoYear().toString();
          weekStr = previousWeek.isoWeek().toString().padStart(2, '0');
        } catch (e) {
          // If we can't calculate year/week, use fallback
        }
        console.error(`❌ Weekly lifecycle aggregation failed for ${yearStr}-W${weekStr}:`, error);
        // Don't throw here, continue with the rest of the process
      }

      this.lastRun = new Date();
      
      // Save last run date to database
      await this.saveLastRunToDatabase();

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


    setTimeout(() => {
      this.runDailyIngestion();
      // Schedule next run (24 hours later)
      this.scheduleDailyIngestion();
    }, delay);
  }

  // Get ingestion status
  async getStatus() {
    // Initialize if not done yet
    if (!this.initialized) {
      await this.initializeLastRun();
      this.initialized = true;
    }
    
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextScheduledRun: this.lastRun ? new Date(this.lastRun.getTime() + 24 * 60 * 60 * 1000) : null
    };
  }
}

module.exports = new DailyIngestionService();
