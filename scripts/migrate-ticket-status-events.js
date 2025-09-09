const database = require('../server/services/database');
const pylonService = require('../server/services/pylonService');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(timezone);

async function migrateTicketStatusEvents() {
  try {
    console.log('🔄 Starting migration of ticket_status_events...\n');
    
    // Initialize database connection
    console.log('🔌 Connecting to database...');
    await database.init();
    if (!database.isConnected) {
      throw new Error('Failed to connect to database');
    }
    console.log('✅ Database connected successfully\n');

    // Step 1: Add new columns to existing table (if they don't exist)
    console.log('1. Adding new columns to ticket_status_events table...');
    await database.query(`
      ALTER TABLE ticket_status_events 
      ADD COLUMN IF NOT EXISTS assignee_id text,
      ADD COLUMN IF NOT EXISTS assignee_name text,
      ADD COLUMN IF NOT EXISTS closed_at_utc timestamptz
    `);
    console.log('   ✅ Columns added successfully');

    // Step 2: Create indexes for new columns
    console.log('\n2. Creating indexes for new columns...');
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_tse_assignee_id ON ticket_status_events (assignee_id)
    `);
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_tse_status_assignee ON ticket_status_events (status, assignee_id)
    `);
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_tse_closed_at ON ticket_status_events (closed_at_utc)
    `);
    console.log('   ✅ Indexes created successfully');

    // Step 3: Get all events that need assignee information
    console.log('\n3. Fetching events without assignee information...');
    const eventsWithoutAssignee = await database.query(`
      SELECT id, ticket_id, status, raw, occurred_at_utc
      FROM ticket_status_events 
      WHERE assignee_id IS NULL
      ORDER BY occurred_at_utc DESC
    `);

    console.log(`   Found ${eventsWithoutAssignee.rows.length} events to update`);

    if (eventsWithoutAssignee.rows.length === 0) {
      console.log('   ✅ No events need updating');
      return;
    }

    // Step 4: Fetch assignee information from Pylon API
    console.log('\n4. Fetching assignee information from Pylon API...');
    const usersResponse = await pylonService.getUsers();
    const users = usersResponse.data || [];
    
    // Create assignee mapping
    const assigneeMap = {};
    users.forEach(user => {
      if (user.id && user.first_name && user.last_name) {
        assigneeMap[user.id] = `${user.first_name} ${user.last_name}`;
      }
    });
    
    console.log(`   Found ${Object.keys(assigneeMap).length} users for assignee mapping`);

    // Step 5: Process each event
    console.log('\n5. Processing events...');
    let processedCount = 0;
    let errorCount = 0;

    for (const event of eventsWithoutAssignee.rows) {
      try {
        // Get ticket details from Pylon API
        const ticketResponse = await pylonService.getIssue(event.ticket_id);
        const ticket = ticketResponse.data;

        if (!ticket) {
          console.log(`   ⚠️  Ticket ${event.ticket_id} not found, skipping...`);
          errorCount++;
          continue;
        }

        // Extract assignee information
        const assigneeId = ticket.assignee?.id || null;
        const assigneeName = assigneeId ? assigneeMap[assigneeId] || 'Unknown' : null;

        // Extract closed_at information
        let closedAtUtc = null;
        if (event.status === 'closed' || event.status === 'cancelled') {
          // For closed/cancelled tickets, use closed_at from custom_fields
          const closedAtValue = ticket.custom_fields?.closed_at?.value;
          if (closedAtValue) {
            closedAtUtc = dayjs(closedAtValue).utc().toISOString();
          } else {
            // Fallback to occurred_at_utc if no closed_at
            closedAtUtc = event.occurred_at_utc;
          }
        }

        // Update the event record
        await database.query(`
          UPDATE ticket_status_events 
          SET 
            assignee_id = $1,
            assignee_name = $2,
            closed_at_utc = $3
          WHERE id = $4
        `, [assigneeId, assigneeName, closedAtUtc, event.id]);

        processedCount++;
        
        if (processedCount % 10 === 0) {
          console.log(`   Processed ${processedCount}/${eventsWithoutAssignee.rows.length} events...`);
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`   ❌ Error processing event ${event.id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✅ Migration completed:`);
    console.log(`   - Processed: ${processedCount} events`);
    console.log(`   - Errors: ${errorCount} events`);
    console.log(`   - Total: ${eventsWithoutAssignee.rows.length} events`);

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

migrateTicketStatusEvents();
