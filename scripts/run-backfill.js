const axios = require('axios');

async function runBackfill() {
  console.log('🔄 Starting backfill for last 30 days...\n');
  
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
  const toDate = today.toISOString().split('T')[0];
  
  console.log(`📅 Date range: ${fromDate} to ${toDate}`);
  console.log('🚀 Calling backfill API...\n');
  
  try {
    const response = await axios.post('http://localhost:3001/api/history/backfill', {
      from: fromDate,
      to: toDate
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutes timeout
    });
    
    console.log('✅ Backfill completed successfully!');
    console.log('📊 Results:');
    console.log(`   - Days processed: ${response.data.processedDays}`);
    console.log(`   - Total tickets: ${response.data.totalTickets}`);
    console.log(`   - From: ${response.data.from}`);
    console.log(`   - To: ${response.data.to}`);
    
  } catch (error) {
    console.error('❌ Backfill failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

runBackfill();


