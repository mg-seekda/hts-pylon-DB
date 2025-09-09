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

    // Step 1: Get all events that need assignee information
    console.log('1. Fetching events without assignee information or with "Unknown" assignees...');
    const eventsWithoutAssignee = await database.query(`
      SELECT id, ticket_id, status, raw, occurred_at_utc, assignee_id, assignee_name
      FROM ticket_status_events 
      WHERE assignee_id IS NULL OR assignee_name = 'Unknown'
      ORDER BY occurred_at_utc DESC
    `);

    console.log(`   Found ${eventsWithoutAssignee.rows.length} events to update`);

    if (eventsWithoutAssignee.rows.length === 0) {
      console.log('   ✅ No events need updating');
      return;
    }

    // Step 2: Fetch assignee information from Pylon API
    console.log('\n2. Fetching assignee information from Pylon API...');
    const usersResponse = await pylonService.getUsers();
    const users = usersResponse.data || [];
    
    // Create assignee mapping
    const assigneeMap = {};
    users.forEach(user => {
      if (user.id && user.name) {
        assigneeMap[user.id] = user.name;
      }
    });
    
    console.log(`   Found ${Object.keys(assigneeMap).length} users for assignee mapping`);
    console.log('   Sample users:', users.slice(0, 3).map(u => ({ id: u.id, name: u.name })));
    console.log('   Sample assignee mapping:', Object.entries(assigneeMap).slice(0, 3));

    // Step 3: Process each event
    console.log(`\n3. Processing ${eventsWithoutAssignee.rows.length} events...`);
    let processedCount = 0;
    let errorCount = 0;

    for (const event of eventsWithoutAssignee.rows) {
      try {
        // Add delay to avoid rate limiting (1 second between calls)
        if (processedCount > 0) {
          console.log(`   ⏳ Waiting 1 second to avoid rate limiting...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
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
        
        // Debug logging for first few tickets
        if (processedCount < 3) {
          console.log(`   Debug ticket ${event.ticket_id}:`);
          console.log(`     - ticket.assignee:`, ticket.assignee);
          console.log(`     - assigneeId: ${assigneeId}`);
          console.log(`     - assigneeName: ${assigneeName}`);
          console.log(`     - assignee in map: ${assigneeId ? (assigneeId in assigneeMap) : 'N/A'}`);
          console.log(`     - ticket.custom_fields:`, ticket.custom_fields);
          console.log(`     - closed_at value:`, ticket.custom_fields?.closed_at?.value);
          console.log(`     - closedAtUtc: ${closedAtUtc}`);
        }
        
        // Progress indicator
        if (processedCount % 10 === 0 && processedCount > 0) {
          console.log(`   📊 Progress: ${processedCount}/${eventsWithoutAssignee.rows.length} events processed`);
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
