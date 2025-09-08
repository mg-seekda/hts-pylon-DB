const axios = require('axios');

async function testAssigneeNames() {
  console.log('🔍 Testing assignee names in API response...\n');
  
  try {
    const response = await axios.get('http://localhost:3001/api/history/closed-by-assignee?from=2025-09-01&to=2025-09-05&bucket=day');
    
    console.log('📊 API Response:');
    console.log(`Total records: ${response.data.data.length}`);
    
    console.log('\n👥 Assignee breakdown:');
    const assigneeSummary = {};
    response.data.data.forEach(record => {
      if (!assigneeSummary[record.assignee_name]) {
        assigneeSummary[record.assignee_name] = 0;
      }
      assigneeSummary[record.assignee_name] += record.count;
    });
    
    Object.entries(assigneeSummary)
      .sort(([,a], [,b]) => b - a)
      .forEach(([name, total]) => {
        console.log(`   ${name}: ${total} tickets`);
      });
    
    console.log('\n📋 Sample records:');
    response.data.data.slice(0, 5).forEach(record => {
      console.log(`   ${record.bucket_start} - ${record.assignee_name}: ${record.count} tickets`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAssigneeNames();


