const axios = require('axios');

async function testApiDebug() {
  console.log('🔍 Testing API with debug logging...\n');
  
  try {
    const response = await axios.get('http://localhost:3001/api/history/closed-by-assignee?from=2025-09-01&to=2025-09-05&bucket=day');
    
    console.log('📊 Full API Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log(`\n📈 Data array length: ${response.data.data ? response.data.data.length : 'undefined'}`);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log('\n📋 Sample data:');
      response.data.data.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.bucket_start} - ${item.assignee_name}: ${item.count}`);
      });
    } else {
      console.log('❌ No data in response');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testApiDebug();


