const database = require('../server/services/database');
const pylonService = require('../server/services/pylonService');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(timezone);

async function migrateClosedAtTimestamps() {
  try {
    console.log('🔄 Starting migration of closed_at_utc timestamps...\n');
    
    // Initialize database connection
    console.log('🔌 Connecting to database...');
    await database.init();
    if (!database.isConnected) {
      throw new Error('Failed to connect to database');
    }
    console.log('✅ Database connected successfully\n');

    // Step 1: Get all closed/cancelled events without closed_at_utc
    console.log('1. Fetching closed/cancelled events without closed_at_utc...');
    const eventsWithoutClosedAt = await database.query(`
      SELECT id, ticket_id, status, occurred_at_utc
      FROM ticket_status_events 
      WHERE (status = 'closed' OR status = 'cancelled') 
        AND closed_at_utc IS NULL
      ORDER BY occurred_at_utc DESC
    `);

    console.log(`   Found ${eventsWithoutClosedAt.rows.length} events to update`);

    if (eventsWithoutClosedAt.rows.length === 0) {
      console.log('   ✅ No events need updating');
      return;
    }

    // Step 2: Process each event
    console.log(`\n2. Processing ${eventsWithoutClosedAt.rows.length} events...`);
    let processedCount = 0;
    let errorCount = 0;

    for (const event of eventsWithoutClosedAt.rows) {
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

        // Extract closed_at information
        let closedAtUtc = null;
        const closedAtValue = ticket.custom_fields?.closed_at?.value;
        
        if (closedAtValue) {
          closedAtUtc = dayjs(closedAtValue).utc().toISOString();
        } else {
          // Fallback to occurred_at_utc if no closed_at
          closedAtUtc = event.occurred_at_utc;
        }
        
        // Debug logging for first few tickets
        if (processedCount < 3) {
          console.log(`   Debug ticket ${event.ticket_id}:`);
          console.log(`     - status: ${event.status}`);
          console.log(`     - ticket.custom_fields:`, ticket.custom_fields);
          console.log(`     - closed_at value:`, closedAtValue);
          console.log(`     - closedAtUtc: ${closedAtUtc}`);
        }
        
        // Progress indicator
        if (processedCount % 10 === 0 && processedCount > 0) {
          console.log(`   📊 Progress: ${processedCount}/${eventsWithoutClosedAt.rows.length} events processed`);
        }

        // Update the event record with closed_at_utc
        await database.query(`
          UPDATE ticket_status_events 
          SET closed_at_utc = $1
          WHERE id = $2
        `, [closedAtUtc, event.id]);

        processedCount++;
        
        if (processedCount % 10 === 0) {
          console.log(`   ✅ Updated ${processedCount} events so far...`);
        }

      } catch (error) {
        console.error(`   ❌ Error processing ticket ${event.ticket_id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✅ Migration completed:`);
    console.log(`   - Processed: ${processedCount} events`);
    console.log(`   - Errors: ${errorCount} events`);
    console.log(`   - Total: ${eventsWithoutClosedAt.rows.length} events`);

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

migrateClosedAtTimestamps();
