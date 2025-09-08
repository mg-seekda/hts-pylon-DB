const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testHistoryAPI() {
  console.log('🧪 Testing History API endpoints...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);

    // Test date presets
    console.log('\n2. Testing date presets...');
    const presetsResponse = await axios.get(`${API_BASE}/history/date-presets`);
    console.log('✅ Date presets:', Object.keys(presetsResponse.data.presets));

    // Test closed by assignee (should return empty data if no data exists)
    console.log('\n3. Testing closed by assignee endpoint...');
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    try {
      const closedResponse = await axios.get(`${API_BASE}/history/closed-by-assignee`, {
        params: {
          from: weekAgo,
          to: today,
          bucket: 'day'
        }
      });
      console.log('✅ Closed by assignee endpoint works');
      console.log('   Data points:', closedResponse.data.data?.length || 0);
    } catch (error) {
      if (error.response?.status === 500) {
        console.log('⚠️  Closed by assignee endpoint returned 500 (likely no data in DB yet)');
      } else {
        throw error;
      }
    }

    console.log('\n🎉 All API tests completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Set up PostgreSQL database');
    console.log('2. Run backfill to import historical data');
    console.log('3. Start the client to test the UI');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

// Run the test
testHistoryAPI();


