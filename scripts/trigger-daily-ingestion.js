const database = require('../server/services/database');
const pylonService = require('../server/services/pylonService');
const TimezoneUtils = require('../server/utils/timezone');
const TicketLifecycleAggregationService = require('../server/services/ticketLifecycleAggregation');

// Get the target date from command line argument or use 09.09.2025
const targetDate = process.argv[2] || '2025-09-09';
console.log(`🚀 Triggering daily ingestion for date: ${targetDate}`);

async function runDailyIngestionForDate(targetDate) {
  try {
    // Initialize database connection
    await database.init();
    console.log('📅 Database connected');

    // Parse the target date
    const targetDay = new Date(targetDate + 'T00:00:00.000Z');
    const dayStart = TimezoneUtils.getStartOfDayUTC(targetDay);
    const dayEnd = TimezoneUtils.getEndOfDayUTC(targetDay);

    console.log(`📅 Processing date: ${targetDate}`);
    console.log(`📅 Day start (UTC): ${dayStart.toISOString()}`);
    console.log(`📅 Day end (UTC): ${dayEnd.toISOString()}`);

    // Fetch all users to get assignee names
    console.log('👥 Fetching users...');
    const usersResponse = await pylonService.getUsers();
    const users = usersResponse.data || [];
    
    // Create a mapping of assignee ID to name
    const assigneeMap = {};
    users.forEach(user => {
      if (user.id && user.name) {
        assigneeMap[user.id] = user.name;
      }
    });
    console.log(`👥 Found ${Object.keys(assigneeMap).length} users`);

    // Query Pylon for closed tickets on target date
    console.log('🎫 Fetching closed tickets...');
    const filter = {
      status: 'closed',
      closed_at: {
        gte: dayStart.toISOString(),
        lte: dayEnd.toISOString()
      }
    };

    const ticketsResponse = await pylonService.getTickets(filter);
    const tickets = ticketsResponse.data || [];
    console.log(`🎫 Found ${tickets.length} closed tickets`);

    if (tickets.length === 0) {
      console.log('⚠️  No closed tickets found for this date');
      return;
    }

    // Process tickets and create lifecycle data
    console.log('🔄 Processing ticket lifecycle data...');
    const aggregationService = new TicketLifecycleAggregationService();
    
    const lifecycleData = [];
    for (const ticket of tickets) {
      try {
        const lifecycle = await aggregationService.processTicketLifecycle(ticket, assigneeMap);
        if (lifecycle) {
          lifecycleData.push(lifecycle);
        }
      } catch (error) {
        console.error(`❌ Error processing ticket ${ticket.id}:`, error.message);
      }
    }

    console.log(`✅ Processed ${lifecycleData.length} ticket lifecycles`);

    // Save to database
    console.log('💾 Saving to database...');
    await aggregationService.saveLifecycleData(lifecycleData, targetDate);

    // Update last run date
    console.log('📅 Updating last run date...');
    await ensureTableExists();
    const query = `INSERT INTO ingestion_metadata (service_name, last_run, created_at) VALUES ('daily_ingestion', $1, NOW())`;
    await database.query(query, [new Date().toISOString()]);

    console.log('✅ Daily ingestion completed successfully!');
    console.log(`📊 Processed ${lifecycleData.length} tickets for ${targetDate}`);

  } catch (error) {
    console.error('❌ Error during daily ingestion:', error);
    throw error;
  } finally {
    // Close database connection
    await database.close();
  }
}

async function ensureTableExists() {
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
  }
}

// Run the ingestion
runDailyIngestionForDate(targetDate)
  .then(() => {
    console.log('🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
