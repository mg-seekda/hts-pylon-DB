const axios = require('axios');

async function testPylon() {
  console.log('🔍 Testing Pylon API connection...\n');
  
  try {
    // Test the health endpoint first
    const healthResponse = await axios.get('http://localhost:3001/api/health');
    console.log('✅ Server health check:', healthResponse.data.status);
    
    // Test a simple Pylon API call through our server
    console.log('\n🔍 Testing Pylon API through our server...');
    
    // Try to get some basic data
    const response = await axios.get('http://localhost:3001/api/tickets/kpis', {
      timeout: 10000
    });
    
    console.log('✅ Pylon API is working!');
    console.log('📊 KPIs data received:', Object.keys(response.data));
    
  } catch (error) {
    console.error('❌ Error testing Pylon API:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testPylon();


