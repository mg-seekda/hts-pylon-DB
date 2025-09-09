const { Pool } = require('pg');

async function debugApiQuery() {
  console.log('🔍 Debugging API query logic...\n');
  
  const pool = new Pool({
    user: 'HTS-DB-User',
    password: 'DEV1234',
    host: 'localhost',
    port: 5432,
    database: 'HTS-DB'
  });

  try {
    const client = await pool.connect();
    
    // Test the exact query that the API uses
    const from = '2025-09-01';
    const to = '2025-09-05';
    const bucket = 'day';
    
    console.log(`📅 Testing API query for: ${from} to ${to}, bucket: ${bucket}`);
    
    // Convert to UTC like the API does
    const dayjs = require('dayjs');
    const utc = require('dayjs/plugin/utc');
    const timezone = require('dayjs/plugin/timezone');
    
    dayjs.extend(utc);
    dayjs.extend(timezone);
    
    const fromDate = dayjs.tz(from, 'Europe/Vienna').startOf('day').utc();
    const toDate = dayjs.tz(to, 'Europe/Vienna').endOf('day').utc();
    
    console.log(`🕐 From UTC: ${fromDate.toISOString()}`);
    console.log(`🕐 To UTC: ${toDate.toISOString()}`);
    
    // Test the exact query from the API
    const query = `
      WITH base AS (
        SELECT bucket_start, assignee_id, assignee_name, count
        FROM closed_by_assignee
        WHERE bucket = 'day'
          AND bucket_start >= $1
          AND bucket_start < $2
      )
      SELECT
        CASE WHEN $3 = 'week'
             THEN date_trunc('week', bucket_start AT TIME ZONE 'Europe/Vienna') AT TIME ZONE 'Europe/Vienna'
             ELSE date_trunc('day', bucket_start AT TIME ZONE 'Europe/Vienna') AT TIME ZONE 'Europe/Vienna'
        END AS bucket_start,
        assignee_id,
        max(assignee_name) AS assignee_name,
        SUM(count) AS count
      FROM base
      GROUP BY 1,2
      ORDER BY 1 ASC;
    `;
    
    const result = await client.query(query, [fromDate.toISOString(), toDate.toISOString(), bucket]);
    
    console.log(`\n📊 Query result: ${result.rows.length} rows`);
    if (result.rows.length > 0) {
      console.log('Sample data:');
      result.rows.slice(0, 3).forEach(row => {
        console.log(`  ${row.bucket_start} - ${row.assignee_name}: ${row.count}`);
      });
    } else {
      console.log('❌ No data returned by query');
      
      // Let's check what's actually in the database
      console.log('\n🔍 Checking raw database data...');
      const rawResult = await client.query(`
        SELECT bucket_start, assignee_name, count 
        FROM closed_by_assignee 
        WHERE bucket = 'day' 
        ORDER BY bucket_start 
        LIMIT 5
      `);
      
      console.log(`Raw data (${rawResult.rows.length} rows):`);
      rawResult.rows.forEach(row => {
        console.log(`  ${row.bucket_start} - ${row.assignee_name}: ${row.count}`);
      });
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugApiQuery();


