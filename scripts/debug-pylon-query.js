const axios = require('axios');

async function debugPylonQuery() {
  console.log('🔍 Debugging Pylon query for closed tickets...\n');
  
  // Test with yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dayStart = new Date(yesterday);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(yesterday);
  dayEnd.setHours(23, 59, 59, 999);
  
  console.log(`📅 Testing date: ${yesterday.toISOString().split('T')[0]}`);
  console.log(`🕐 Day start: ${dayStart.toISOString()}`);
  console.log(`🕐 Day end: ${dayEnd.toISOString()}\n`);
  
  try {
    // Test the Pylon API directly through our server
    const response = await axios.get('http://localhost:3001/api/tickets/kpis');
    console.log('📊 Current KPIs from dashboard:');
    console.log(`   Closed today: ${response.data.closedToday}`);
    console.log(`   Total open: ${response.data.totalOpen}`);
    console.log(`   Created today: ${response.data.createdToday}\n`);
    
    // Now test what our backfill query would return
    console.log('🔍 Testing backfill query...');
    
    // This simulates what the backfill does
    const filter = {
      search: true,
      limit: 1000,
      include: ['custom_fields'],
      filter: {
        operator: 'and',
        subfilters: [
          {
            field: 'state',
            operator: 'equals',
            value: 'closed'
          },
          {
            field: 'closed_at',
            operator: 'time_range',
            values: [dayStart.toISOString(), dayEnd.toISOString()]
          }
        ]
      }
    };
    
    console.log('📋 Filter being used:', JSON.stringify(filter, null, 2));
    
    // We can't directly call the Pylon API from here, but we can check
    // what the dashboard's "closed today" logic uses
    console.log('\n💡 The dashboard shows different numbers, which suggests:');
    console.log('   1. Different date filtering logic');
    console.log('   2. Different timezone handling');
    console.log('   3. Different field mapping (closed_at vs other fields)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugPylonQuery();


