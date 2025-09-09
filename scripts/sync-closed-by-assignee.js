const database = require('../server/services/database');
const pylonService = require('../server/services/pylonService');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

dayjs.extend(timezone);
dayjs.extend(utc);

async function syncClosedByAssignee() {
  try {
    console.log('🔄 Starting one-time sync of closed_by_assignee table...\n');

    // Initialize database connection
    console.log('🔌 Connecting to database...');
    await database.init();
    if (!database.isConnected) {
      throw new Error('Failed to connect to database');
    }
    console.log('✅ Database connected successfully\n');

    // Clear existing data
    console.log('1. Clearing existing closed_by_assignee data...');
    await database.query('DELETE FROM closed_by_assignee');
    console.log('   ✅ Cleared existing data\n');

    // Get date range for sync (last 30 days)
    const endDate = dayjs();
    const startDate = endDate.subtract(30, 'day');
    
    console.log(`2. Syncing data from ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}...`);

    // Get all users for assignee mapping
    console.log('   Fetching users from Pylon API...');
    const usersResponse = await pylonService.getUsers();
    const users = usersResponse.data || [];
    
    const assigneeMap = {};
    users.forEach(user => {
      if (user.id && user.name) {
        assigneeMap[user.id] = user.name;
      }
    });
    console.log(`   ✅ Found ${Object.keys(assigneeMap).length} users`);

    // Process each day
    let totalProcessed = 0;
    let totalErrors = 0;

    for (let i = 0; i < 30; i++) {
      const currentDate = endDate.subtract(i, 'day');
      const dateStr = currentDate.format('YYYY-MM-DD');
      
      console.log(`   📅 Processing ${dateStr}...`);

      try {
        // Get closed tickets for this day
        const dayStart = currentDate.startOf('day');
        const dayEnd = currentDate.endOf('day');
        
        const filter = {
          limit: 1000,
          start_time: dayStart.toISOString(),
          end_time: dayEnd.toISOString(),
          include: ['custom_fields'],
          filter: {
            field: 'closed_at',
            operator: 'is_not_null'
          }
        };

        const response = await pylonService.apiCall('/issues', 'GET', null, filter);
        const tickets = response.data || [];

        // Group by assignee
        const assigneeCounts = {};
        
        tickets.forEach(ticket => {
          if (ticket.state === 'closed' && ticket.custom_fields?.closed_at?.value) {
            const closedAt = dayjs(ticket.custom_fields.closed_at.value);
            if (closedAt.format('YYYY-MM-DD') === dateStr) {
              const assigneeId = ticket.assignee?.id || 'unassigned';
              const assigneeName = ticket.assignee?.name || assigneeMap[assigneeId] || 'Unassigned';
              
              if (!assigneeCounts[assigneeId]) {
                assigneeCounts[assigneeId] = {
                  id: assigneeId,
                  name: assigneeName,
                  count: 0
                };
              }
              assigneeCounts[assigneeId].count++;
            }
          }
        });

        // Insert data for this day
        for (const [assigneeId, data] of Object.entries(assigneeCounts)) {
          await database.query(`
            INSERT INTO closed_by_assignee (bucket_start, bucket, assignee_id, assignee_name, count)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (bucket_start, bucket, assignee_id)
            DO UPDATE SET 
              assignee_name = EXCLUDED.assignee_name,
              count = EXCLUDED.count
          `, [
            dayStart.utc().toISOString(),
            'day',
            assigneeId,
            data.name,
            data.count
          ]);

          // Update assignees table
          await database.query(`
            INSERT INTO assignees (assignee_id, assignee_name, updated_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (assignee_id)
            DO UPDATE SET 
              assignee_name = EXCLUDED.assignee_name,
              updated_at = EXCLUDED.updated_at
          `, [assigneeId, data.name, new Date().toISOString()]);
        }

        const dayCount = Object.values(assigneeCounts).reduce((sum, data) => sum + data.count, 0);
        console.log(`     ✅ ${dayCount} closed tickets processed for ${dateStr}`);
        totalProcessed += dayCount;

        // Add delay to avoid rate limiting
        if (i < 29) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`     ❌ Error processing ${dateStr}:`, error.message);
        totalErrors++;
      }
    }

    console.log(`\n✅ Sync completed:`);
    console.log(`   - Total closed tickets processed: ${totalProcessed}`);
    console.log(`   - Days with errors: ${totalErrors}`);
    console.log(`   - Date range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);

  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    if (database.isConnected) {
      await database.close();
      console.log('🔌 Database connection closed');
    }
    process.exit(0);
  }
}

syncClosedByAssignee();
