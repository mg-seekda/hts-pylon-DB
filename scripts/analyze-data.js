const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

async function analyzeData() {
  console.log('🔍 Analyzing database data...\n');

  const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
  });

  try {
    // Get all data grouped by date
    const result = await pool.query(`
      SELECT 
        DATE(bucket_start AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Vienna') as date,
        COUNT(*) as records,
        SUM(count) as total_tickets,
        COUNT(DISTINCT assignee_id) as unique_assignees
      FROM closed_by_assignee 
      GROUP BY DATE(bucket_start AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Vienna')
      ORDER BY date DESC
    `);
    
    console.log('📊 Data by date:');
    result.rows.forEach(row => {
      console.log(`   ${row.date}: ${row.total_tickets} tickets, ${row.records} records, ${row.unique_assignees} assignees`);
    });
    
    // Check for duplicate records
    const duplicates = await pool.query(`
      SELECT bucket_start, assignee_id, COUNT(*) as count
      FROM closed_by_assignee 
      GROUP BY bucket_start, assignee_id
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.rows.length > 0) {
      console.log('\n⚠️  Duplicate records found:');
      duplicates.rows.forEach(row => {
        console.log(`   ${row.bucket_start} - ${row.assignee_id}: ${row.count} duplicates`);
      });
    } else {
      console.log('\n✅ No duplicate records found');
    }
    
    // Check assignee names
    const assignees = await pool.query(`
      SELECT assignee_id, assignee_name, COUNT(*) as records
      FROM closed_by_assignee 
      GROUP BY assignee_id, assignee_name
      ORDER BY records DESC
    `);
    
    console.log('\n👥 Assignees:');
    assignees.rows.forEach(row => {
      console.log(`   ${row.assignee_name} (${row.assignee_id}): ${row.records} records`);
    });

  } catch (error) {
    console.error('❌ Error analyzing data:', error.message);
  } finally {
    await pool.end();
  }
}

analyzeData();


