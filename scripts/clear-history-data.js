const { Pool } = require('pg');

async function clearHistoryData() {
  console.log('🗑️ Clearing history data...\n');
  
  const pool = new Pool({
    user: 'HTS-DB-User',
    password: 'DEV1234',
    host: 'localhost',
    port: 5432,
    database: 'HTS-DB'
  });

  try {
    const client = await pool.connect();
    
    // Clear both tables
    console.log('Clearing closed_by_assignee table...');
    await client.query('DELETE FROM closed_by_assignee');
    
    console.log('Clearing assignees table...');
    await client.query('DELETE FROM assignees');
    
    console.log('✅ History data cleared successfully');
    
    client.release();
  } catch (error) {
    console.error('❌ Error clearing data:', error.message);
  } finally {
    await pool.end();
  }
}

clearHistoryData();


