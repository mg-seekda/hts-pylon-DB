#!/usr/bin/env node

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const TicketLifecycleAggregationService = require('../server/services/ticketLifecycleAggregation');

async function triggerAggregation() {
  const aggregationService = new TicketLifecycleAggregationService();
  
  try {
    console.log('🚀 Triggering manual ticket lifecycle aggregation...\n');
    
    // Get today's date in Vienna timezone
    const today = dayjs().tz('Europe/Vienna');
    const todayStr = today.format('YYYY-MM-DD');
    
    console.log(`📅 Running daily aggregation for ${todayStr}...`);
    await aggregationService.runDailyAggregation(today.toDate());
    console.log('✅ Daily aggregation completed');
    
    // Get current week
    const year = today.isoYear();
    const week = today.isoWeek();
    
    console.log(`📅 Running weekly aggregation for ${year}-W${week.toString().padStart(2, '0')}...`);
    await aggregationService.runWeeklyAggregation(year, week);
    console.log('✅ Weekly aggregation completed');
    
    console.log('\n🎉 All aggregations completed successfully!');
    
  } catch (error) {
    console.error('❌ Aggregation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  triggerAggregation();
}

module.exports = triggerAggregation;
