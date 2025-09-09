const database = require('../server/services/database');
const TicketLifecycleAggregationService = require('../server/services/ticketLifecycleAggregation');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(timezone);

async function updateExistingAggregations() {
  try {
    console.log('🔄 Updating existing aggregations with new formatting...\n');

    const aggregationService = new TicketLifecycleAggregationService();

    // Get all existing daily aggregations
    const result = await database.query(`
      SELECT DISTINCT bucket_date 
      FROM ticket_status_agg_daily 
      ORDER BY bucket_date DESC
    `);

    console.log(`Found ${result.rows.length} dates with existing aggregations:`);
    result.rows.forEach(row => {
      console.log(`  - ${row.bucket_date}`);
    });

    // Re-run aggregation for each date to update formatting
    for (const row of result.rows) {
      const date = dayjs(row.bucket_date).tz('Europe/Vienna');
      console.log(`\n🔄 Re-aggregating ${date.format('YYYY-MM-DD')}...`);
      
      try {
        await aggregationService.runDailyAggregation(date.toDate());
        console.log(`✅ Updated aggregation for ${date.format('YYYY-MM-DD')}`);
      } catch (error) {
        console.error(`❌ Failed to update ${date.format('YYYY-MM-DD')}:`, error.message);
      }
    }

    console.log('\n✅ All existing aggregations updated!');

  } catch (error) {
    console.error('❌ Error updating aggregations:', error);
  } finally {
    process.exit(0);
  }
}

updateExistingAggregations();
