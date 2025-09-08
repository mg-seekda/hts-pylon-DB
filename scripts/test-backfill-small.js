const axios = require('axios');

async function testBackfillSmall() {
  console.log('🔄 Testing backfill with last 3 days...\n');
  
  const today = new Date();
  const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  const fromDate = threeDaysAgo.toISOString().split('T')[0];
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
      timeout: 60000 // 1 minute timeout
    });
    
    console.log('✅ Backfill completed!');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Backfill failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testBackfillSmall();


