const database = require('../server/services/database');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

async function createTestData() {
  try {
    console.log('🧪 Creating test lifecycle data...\n');

    const now = dayjs().utc();
    const yesterday = now.subtract(1, 'day');
    const twoDaysAgo = now.subtract(2, 'day');

    // Create some test ticket status events
    console.log('Creating test events...');
    await database.query(`
      INSERT INTO ticket_status_events (event_id, ticket_id, status, occurred_at_utc, received_at_utc, raw)
      VALUES 
        ($1, $2, $3, $4, $5, $6),
        ($7, $8, $9, $10, $11, $12),
        ($13, $14, $15, $16, $17, $18),
        ($19, $20, $21, $22, $23, $24)
      ON CONFLICT (event_id) DO NOTHING
    `, [
      // Event 1: Ticket created
      'test-event-1', 'test-ticket-1', 'new', twoDaysAgo.toISOString(), now.toISOString(), 
      JSON.stringify({ type: 'ticket.created', ticket_id: 'test-ticket-1', status: 'new' }),
      
      // Event 2: Status change to in_progress
      'test-event-2', 'test-ticket-1', 'in_progress', twoDaysAgo.add(1, 'hour').toISOString(), now.toISOString(),
      JSON.stringify({ type: 'ticket.status_changed', ticket_id: 'test-ticket-1', status: 'in_progress' }),
      
      // Event 3: Status change to waiting_customer
      'test-event-3', 'test-ticket-1', 'waiting_customer', yesterday.toISOString(), now.toISOString(),
      JSON.stringify({ type: 'ticket.status_changed', ticket_id: 'test-ticket-1', status: 'waiting_customer' }),
      
      // Event 4: Status change to closed
      'test-event-4', 'test-ticket-1', 'closed', yesterday.add(2, 'hour').toISOString(), now.toISOString(),
      JSON.stringify({ type: 'ticket.status_changed', ticket_id: 'test-ticket-1', status: 'closed' })
    ]);

    // Create corresponding segments
    console.log('Creating test segments...');
    await database.query(`
      INSERT INTO ticket_status_segments (ticket_id, status, entered_at_utc, left_at_utc)
      VALUES 
        ($1, $2, $3, $4),
        ($5, $6, $7, $8),
        ($9, $10, $11, $12)
      ON CONFLICT (ticket_id, status, entered_at_utc) DO NOTHING
    `, [
      // Segment 1: new -> in_progress (1 hour)
      'test-ticket-1', 'new', twoDaysAgo.toISOString(), twoDaysAgo.add(1, 'hour').toISOString(),
      
      // Segment 2: in_progress -> waiting_customer (23 hours)
      'test-ticket-1', 'in_progress', twoDaysAgo.add(1, 'hour').toISOString(), yesterday.toISOString(),
      
      // Segment 3: waiting_customer -> closed (2 hours)
      'test-ticket-1', 'waiting_customer', yesterday.toISOString(), yesterday.add(2, 'hour').toISOString()
    ]);

    console.log('✅ Test data created successfully');
    console.log('   - 4 events created');
    console.log('   - 3 segments created');
    console.log('   - Ticket lifecycle: new -> in_progress -> waiting_customer -> closed');

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    process.exit(0);
  }
}

createTestData();
