const database = require('../server/services/database');

async function debugLifecycleData() {
  try {
    console.log('🔍 Checking ticket lifecycle data...\n');
    
    // Initialize database connection
    console.log('🔌 Connecting to database...');
    await database.init();
    if (!database.isConnected) {
      throw new Error('Failed to connect to database');
    }
    console.log('✅ Database connected successfully\n');

    // Check if tables exist
    console.log('1. Checking if tables exist:');
    const tables = await database.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'ticket_status%'
      ORDER BY table_name
    `);
    console.log('   Tables:', tables.rows.map(r => r.table_name));

    // Check ticket_status_events
    console.log('\n2. Checking ticket_status_events:');
    const events = await database.query('SELECT COUNT(*) as count FROM ticket_status_events');
    console.log('   Total events:', events.rows[0].count);

    if (parseInt(events.rows[0].count) > 0) {
      const sampleEvents = await database.query(`
        SELECT ticket_id, status, occurred_at_utc, received_at_utc 
        FROM ticket_status_events 
        ORDER BY occurred_at_utc DESC 
        LIMIT 5
      `);
      console.log('   Sample events:', sampleEvents.rows);
    }

    // Check ticket_status_segments
    console.log('\n3. Checking ticket_status_segments:');
    const segments = await database.query('SELECT COUNT(*) as count FROM ticket_status_segments');
    console.log('   Total segments:', segments.rows[0].count);

    const openSegments = await database.query('SELECT COUNT(*) as count FROM ticket_status_segments WHERE left_at_utc IS NULL');
    console.log('   Open segments:', openSegments.rows[0].count);

    const closedSegments = await database.query('SELECT COUNT(*) as count FROM ticket_status_segments WHERE left_at_utc IS NOT NULL');
    console.log('   Closed segments:', closedSegments.rows[0].count);

    if (parseInt(segments.rows[0].count) > 0) {
      const sampleSegments = await database.query(`
        SELECT ticket_id, status, entered_at_utc, left_at_utc 
        FROM ticket_status_segments 
        ORDER BY entered_at_utc DESC 
        LIMIT 5
      `);
      console.log('   Sample segments:', sampleSegments.rows);
    }

    // Check daily aggregations
    console.log('\n4. Checking ticket_status_agg_daily:');
    const dailyAgg = await database.query('SELECT COUNT(*) as count FROM ticket_status_agg_daily');
    console.log('   Total daily aggregations:', dailyAgg.rows[0].count);

    if (parseInt(dailyAgg.rows[0].count) > 0) {
      const sampleDaily = await database.query(`
        SELECT bucket_date, status, count_segments, avg_duration_wall_seconds, avg_duration_business_seconds
        FROM ticket_status_agg_daily 
        ORDER BY bucket_date DESC 
        LIMIT 5
      `);
      console.log('   Sample daily aggregations:', sampleDaily.rows);
    }

    // Check weekly aggregations
    console.log('\n5. Checking ticket_status_agg_weekly:');
    const weeklyAgg = await database.query('SELECT COUNT(*) as count FROM ticket_status_agg_weekly');
    console.log('   Total weekly aggregations:', weeklyAgg.rows[0].count);

    if (parseInt(weeklyAgg.rows[0].count) > 0) {
      const sampleWeekly = await database.query(`
        SELECT bucket_iso_year, bucket_iso_week, status, count_segments, avg_duration_wall_seconds, avg_duration_business_seconds
        FROM ticket_status_agg_weekly 
        ORDER BY bucket_iso_year DESC, bucket_iso_week DESC 
        LIMIT 5
      `);
      console.log('   Sample weekly aggregations:', sampleWeekly.rows);
    }

    // Check date range for daily aggregations
    console.log('\n6. Checking date range for daily aggregations:');
    const dateRange = await database.query(`
      SELECT 
        MIN(bucket_date) as earliest_date,
        MAX(bucket_date) as latest_date,
        COUNT(DISTINCT bucket_date) as unique_dates
      FROM ticket_status_agg_daily 
      WHERE count_segments > 0
    `);
    console.log('   Date range:', dateRange.rows[0]);

  } catch (error) {
    console.error('❌ Error checking lifecycle data:', error);
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

debugLifecycleData();
