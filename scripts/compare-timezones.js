const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

console.log('🕐 Comparing timezone handling...\n');

// Dashboard approach (UTC)
const todayUTC = dayjs();
const startOfDayUTC = todayUTC.startOf('day').toISOString();
const endOfDayUTC = todayUTC.endOf('day').toISOString();

console.log('📊 Dashboard approach (UTC):');
console.log(`   Today: ${todayUTC.format('YYYY-MM-DD HH:mm:ss')} UTC`);
console.log(`   Start: ${startOfDayUTC}`);
console.log(`   End:   ${endOfDayUTC}\n`);

// Backfill approach (Vienna timezone)
const todayVienna = dayjs().tz('Europe/Vienna');
const startOfDayVienna = todayVienna.startOf('day').utc().toISOString();
const endOfDayVienna = todayVienna.endOf('day').utc().toISOString();

console.log('📊 Backfill approach (Vienna → UTC):');
console.log(`   Today: ${todayVienna.format('YYYY-MM-DD HH:mm:ss')} Vienna`);
console.log(`   Start: ${startOfDayVienna}`);
console.log(`   End:   ${endOfDayVienna}\n`);

// Check if they're different
const utcStart = new Date(startOfDayUTC);
const viennaStart = new Date(startOfDayVienna);
const utcEnd = new Date(endOfDayUTC);
const viennaEnd = new Date(endOfDayVienna);

console.log('🔍 Comparison:');
console.log(`   Start times different: ${utcStart.getTime() !== viennaStart.getTime()}`);
console.log(`   End times different: ${utcEnd.getTime() !== viennaEnd.getTime()}`);

if (utcStart.getTime() !== viennaStart.getTime()) {
  const diffHours = (viennaStart.getTime() - utcStart.getTime()) / (1000 * 60 * 60);
  console.log(`   Time difference: ${diffHours} hours`);
}


