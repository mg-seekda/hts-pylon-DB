const database = require('../server/services/database');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(timezone);

async function backupAndMigrateAssigneeData() {
  try {
    console.log('🔄 Starting backup and migration of assignee data...\n');
    
    // Initialize database connection
    console.log('🔌 Connecting to database...');
    await database.init();
    if (!database.isConnected) {
      throw new Error('Failed to connect to database');
    }
    console.log('✅ Database connected successfully\n');

    // Step 1: Backup existing closed_by_assignee data
    console.log('1. Backing up existing closed_by_assignee data...');
    const backupResult = await database.query(`
      CREATE TABLE IF NOT EXISTS closed_by_assignee_backup AS 
      SELECT *, now() as backup_created_at 
      FROM closed_by_assignee
    `);
    console.log('   ✅ Backup table created: closed_by_assignee_backup');

    // Step 2: Get current data count
    const currentData = await database.query('SELECT COUNT(*) as count FROM closed_by_assignee');
    console.log(`   📊 Current closed_by_assignee records: ${currentData.rows[0].count}`);

    // Step 3: Clear existing data (we'll rebuild from webhook events)
    console.log('\n2. Clearing existing closed_by_assignee data...');
    await database.query('DELETE FROM closed_by_assignee');
    console.log('   ✅ Existing data cleared');

    // Step 4: Rebuild data from ticket_status_events
    console.log('\n3. Rebuilding data from ticket_status_events...');
    
    // Get all closed/cancelled events with assignee information
    const events = await database.query(`
      SELECT 
        ticket_id,
        status,
        assignee_id,
        assignee_name,
        closed_at_utc,
        occurred_at_utc
      FROM ticket_status_events 
      WHERE status IN ('closed', 'cancelled')
        AND assignee_id IS NOT NULL
        AND assignee_name IS NOT NULL
      ORDER BY occurred_at_utc ASC
    `);

    console.log(`   Found ${events.rows.length} closed/cancelled events with assignee info`);

    if (events.rows.length === 0) {
      console.log('   ⚠️  No events found with assignee information');
      console.log('   💡 Run the migration script first to populate assignee data');
      return;
    }

    // Group events by ticket to handle status changes
    const ticketEvents = {};
    events.rows.forEach(event => {
      if (!ticketEvents[event.ticket_id]) {
        ticketEvents[event.ticket_id] = [];
      }
      ticketEvents[event.ticket_id].push(event);
    });

    console.log(`   Processing ${Object.keys(ticketEvents).length} unique tickets`);

    // Process each ticket's events chronologically
    let processedTickets = 0;
    let totalRecords = 0;

    for (const [ticketId, ticketEventList] of Object.entries(ticketEvents)) {
      // Sort events by occurred_at_utc
      ticketEventList.sort((a, b) => new Date(a.occurred_at_utc) - new Date(b.occurred_at_utc));

      // Track the current state
      let currentStatus = null;
      let currentAssigneeId = null;
      let currentAssigneeName = null;
      let currentClosedAt = null;

      for (const event of ticketEventList) {
        // If this is a closed/cancelled event, update our state
        if (['closed', 'cancelled'].includes(event.status)) {
          currentStatus = event.status;
          currentAssigneeId = event.assignee_id;
          currentAssigneeName = event.assignee_name;
          currentClosedAt = event.closed_at_utc || event.occurred_at_utc;
        }
      }

      // Only create a record if the ticket is currently closed/cancelled
      if (currentStatus) {
        // Handle unassigned tickets
        const finalAssigneeId = currentAssigneeId || 'unassigned';
        const finalAssigneeName = currentAssigneeName || 'Unassigned';
        
        const aggregationDate = currentClosedAt || new Date();
        const bucketDate = dayjs(aggregationDate).tz('Europe/Vienna').format('YYYY-MM-DD');
        const bucketStart = dayjs(bucketDate).startOf('day').utc().toISOString();

        // Insert or update the record
        await database.query(`
          INSERT INTO closed_by_assignee (bucket_start, bucket, assignee_id, assignee_name, count)
          VALUES ($1, $2, $3, $4, 1)
          ON CONFLICT (bucket_start, bucket, assignee_id)
          DO UPDATE SET 
            assignee_name = EXCLUDED.assignee_name,
            count = closed_by_assignee.count + 1
        `, [bucketStart, 'day', finalAssigneeId, finalAssigneeName]);

        // Update assignees table
        await database.query(`
          INSERT INTO assignees (assignee_id, assignee_name, updated_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (assignee_id)
          DO UPDATE SET 
            assignee_name = EXCLUDED.assignee_name,
            updated_at = EXCLUDED.updated_at
        `, [finalAssigneeId, finalAssigneeName, new Date().toISOString()]);

        totalRecords++;
      }

      processedTickets++;
      if (processedTickets % 100 === 0) {
        console.log(`   Processed ${processedTickets}/${Object.keys(ticketEvents).length} tickets...`);
      }
    }

    // Step 5: Verify the migration
    console.log('\n4. Verifying migration...');
    const newData = await database.query('SELECT COUNT(*) as count FROM closed_by_assignee');
    const backupData = await database.query('SELECT COUNT(*) as count FROM closed_by_assignee_backup');
    
    console.log(`   📊 Original records: ${backupData.rows[0].count}`);
    console.log(`   📊 New records: ${newData.rows[0].count}`);
    console.log(`   📊 Processed tickets: ${processedTickets}`);
    console.log(`   📊 Total records created: ${totalRecords}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('   - Original data backed up to closed_by_assignee_backup');
    console.log('   - New data rebuilt from ticket_status_events');
    console.log('   - Webhook-based updates are now active');

  } catch (error) {
    console.error('❌ Migration failed:', error);
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

backupAndMigrateAssigneeData();
