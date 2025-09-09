const TicketLifecycleAggregationService = require('../server/services/ticketLifecycleAggregation');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(timezone);

async function testDailyAggregation() {
  try {
    console.log('🧪 Testing daily aggregation...\n');

    const aggregationService = new TicketLifecycleAggregationService();
    
    // Test with yesterday
    const yesterday = dayjs().subtract(1, 'day').tz('Europe/Vienna');
    console.log(`Testing aggregation for: ${yesterday.format('YYYY-MM-DD')}`);
    
    await aggregationService.runDailyAggregation(yesterday.toDate());
    
    console.log('\n✅ Test completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testDailyAggregation();
