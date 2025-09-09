const axios = require('axios');

async function debugAssigneeData() {
  console.log('🔍 Debugging assignee data from Pylon API...\n');
  
  try {
    // Test with a known date that has data
    const testDate = '2025-09-02';
    const dayStart = new Date(testDate + 'T00:00:00.000Z');
    const dayEnd = new Date(testDate + 'T23:59:59.999Z');
    
    console.log(`📅 Testing date: ${testDate}`);
    console.log(`🕐 Day start: ${dayStart.toISOString()}`);
    console.log(`🕐 Day end: ${dayEnd.toISOString()}\n`);
    
    // Call our backfill endpoint to see what it processes
    console.log('🔄 Running backfill for single day...');
    const backfillResponse = await axios.post('http://localhost:3001/api/history/backfill', {
      from: testDate,
      to: testDate
    });
    
    console.log('📊 Backfill response:', backfillResponse.data);
    
    // Now check what's in the database
    console.log('\n🗄️ Checking database content...');
    const dbResponse = await axios.get(`http://localhost:3001/api/history/closed-by-assignee?from=${testDate}&to=${testDate}&bucket=day`);
    
    console.log('📋 Database data:');
    console.log(JSON.stringify(dbResponse.data, null, 2));
    
    // Check assignees table
    console.log('\n👥 Checking assignees table...');
    const { Pool } = require('pg');
    const pool = new Pool({
      user: 'HTS-DB-User',
      password: 'DEV1234',
      host: 'localhost',
      port: 5432,
      database: 'HTS-DB'
    });
    
    const client = await pool.connect();
    const assigneesResult = await client.query('SELECT * FROM assignees ORDER BY updated_at DESC LIMIT 10');
    console.log('👥 Assignees in database:');
    console.log(assigneesResult.rows);
    
    const closedByAssigneeResult = await client.query('SELECT * FROM closed_by_assignee WHERE bucket_start >= $1 AND bucket_start < $2 ORDER BY bucket_start DESC LIMIT 10', 
      [dayStart, new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)]);
    console.log('\n📊 Closed by assignee data:');
    console.log(closedByAssigneeResult.rows);
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

debugAssigneeData();


