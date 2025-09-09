const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

async function setupTicketLifecycle() {
  console.log('🗄️  Setting up Ticket Lifecycle database tables...\n');

  const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: String(process.env.POSTGRES_PASSWORD),
    database: process.env.POSTGRES_DB,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT) || 5432,
  });

  try {
    // Test connection
    console.log('1. Testing database connection...');
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection successful');

    // Create ticket_status_events table
    console.log('\n2. Creating ticket_status_events table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_status_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id text UNIQUE NOT NULL,
        ticket_id text NOT NULL,
        status text NOT NULL,
        occurred_at_utc timestamptz NOT NULL,
        received_at_utc timestamptz NOT NULL DEFAULT now(),
        raw jsonb NOT NULL
      );
    `);
    console.log('✅ Created ticket_status_events table');

    // Create ticket_status_segments table
    console.log('\n3. Creating ticket_status_segments table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_status_segments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id text NOT NULL,
        status text NOT NULL,
        entered_at_utc timestamptz NOT NULL,
        left_at_utc timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    console.log('✅ Created ticket_status_segments table');

    // Create ticket_status_agg_daily table
    console.log('\n4. Creating ticket_status_agg_daily table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_status_agg_daily (
        bucket_date date NOT NULL,
        status text NOT NULL,
        avg_duration_wall_seconds bigint NOT NULL,
        avg_duration_business_seconds bigint NOT NULL,
        count_segments integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (bucket_date, status)
      );
    `);
    console.log('✅ Created ticket_status_agg_daily table');

    // Create ticket_status_agg_weekly table
    console.log('\n5. Creating ticket_status_agg_weekly table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_status_agg_weekly (
        bucket_iso_year integer NOT NULL,
        bucket_iso_week integer NOT NULL,
        status text NOT NULL,
        avg_duration_wall_seconds bigint NOT NULL,
        avg_duration_business_seconds bigint NOT NULL,
        count_segments integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (bucket_iso_year, bucket_iso_week, status)
      );
    `);
    console.log('✅ Created ticket_status_agg_weekly table');

    // Create indexes
    console.log('\n6. Creating indexes...');
    
    // Event indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tse_ticket_id ON ticket_status_events (ticket_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tse_occurred_at ON ticket_status_events (occurred_at_utc);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tse_status_occurred ON ticket_status_events (status, occurred_at_utc);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tse_event_id ON ticket_status_events (event_id);
    `);

    // Segment indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tss_ticket_entered ON ticket_status_segments (ticket_id, entered_at_utc);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tss_status_entered ON ticket_status_segments (status, entered_at_utc);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tss_left_at ON ticket_status_segments (left_at_utc) WHERE left_at_utc IS NOT NULL;
    `);

    // Daily aggregation indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tsad_bucket_date ON ticket_status_agg_daily (bucket_date);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tsad_status ON ticket_status_agg_daily (status);
    `);

    // Weekly aggregation indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tsaw_year_week ON ticket_status_agg_weekly (bucket_iso_year, bucket_iso_week);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tsaw_status ON ticket_status_agg_weekly (status);
    `);

    console.log('✅ Created all indexes');

    // Test data insertion
    console.log('\n7. Testing data insertion...');
    const testEvent = {
      event_id: 'test-event-' + Date.now(),
      ticket_id: 'test-ticket-123',
      status: 'open',
      occurred_at_utc: new Date().toISOString(),
      raw: { test: true }
    };

    await pool.query(`
      INSERT INTO ticket_status_events (event_id, ticket_id, status, occurred_at_utc, raw)
      VALUES ($1, $2, $3, $4, $5)
    `, [testEvent.event_id, testEvent.ticket_id, testEvent.status, testEvent.occurred_at_utc, JSON.stringify(testEvent.raw)]);

    console.log('✅ Test event inserted successfully');

    // Clean up test data
    await pool.query(`
      DELETE FROM ticket_status_events WHERE event_id = $1
    `, [testEvent.event_id]);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 Ticket Lifecycle database setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Configure PYLON_WEBHOOK_SECRET in your environment');
    console.log('2. Register webhook endpoint with Pylon: /webhooks/pylon/tickets');
    console.log('3. Start the server: npm run dev (in server directory)');
    console.log('4. Test the webhook endpoint');
    console.log('5. Run aggregation jobs to populate data');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. PostgreSQL is running');
    console.error('2. Database exists');
    console.error('3. Environment variables are set correctly');
  } finally {
    await pool.end();
  }
}

// Run the setup
setupTicketLifecycle();
