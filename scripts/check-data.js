const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

async function checkData() {
  console.log('🔍 Checking database data...\n');

  const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
  });

  try {
    // Check closed_by_assignee table
    const result = await pool.query('SELECT COUNT(*) as count FROM closed_by_assignee');
    console.log(`📊 Total records in closed_by_assignee: ${result.rows[0].count}`);

    // Check assignees table
    const assigneesResult = await pool.query('SELECT COUNT(*) as count FROM assignees');
    console.log(`👥 Total assignees: ${assigneesResult.rows[0].count}`);

    // Show sample data
    const sampleResult = await pool.query(`
      SELECT bucket_start, assignee_name, count 
      FROM closed_by_assignee 
      ORDER BY bucket_start DESC 
      LIMIT 5
    `);
    
    if (sampleResult.rows.length > 0) {
      console.log('\n📋 Sample data:');
      sampleResult.rows.forEach(row => {
        const date = new Date(row.bucket_start).toISOString().split('T')[0];
        console.log(`   ${date} - ${row.assignee_name}: ${row.count} tickets`);
      });
    } else {
      console.log('\n❌ No data found in closed_by_assignee table');
    }

  } catch (error) {
    console.error('❌ Error checking data:', error.message);
  } finally {
    await pool.end();
  }
}

checkData();
