const axios = require('axios');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

async function directPylonAnalysis() {
  console.log('🔍 Direct Pylon API Analysis - Closed Tickets by Day\n');
  
  // Get last 7 days
  const endDate = dayjs().tz('Europe/Vienna');
  const startDate = endDate.subtract(7, 'day');
  
  console.log(`📅 Analyzing period: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')} (Vienna time)\n`);
  
  try {
    // Call Pylon API directly through our server
    const response = await axios.get('http://localhost:3001/api/tickets/kpis');
    console.log('📊 Current Dashboard KPIs:');
    console.log(`   Closed today: ${response.data.closedToday}`);
    console.log(`   Total open: ${response.data.totalOpen}`);
    console.log(`   Created today: ${response.data.createdToday}\n`);
    
    // Now let's simulate what the backfill does but with more detailed logging
    console.log('🔍 Simulating backfill process...\n');
    
    const dailyData = {};
    let totalTickets = 0;
    
    // Process each day
    for (let i = 0; i < 7; i++) {
      const currentDate = startDate.add(i, 'day');
      const dayStart = currentDate.startOf('day').utc();
      const dayEnd = currentDate.endOf('day').utc();
      
      console.log(`📅 Processing ${currentDate.format('YYYY-MM-DD')}...`);
      console.log(`   UTC range: ${dayStart.toISOString()} to ${dayEnd.toISOString()}`);
      
      // This is the same filter the backfill uses
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
      
      try {
        // We can't call Pylon directly, but we can check what our server would return
        // by looking at the existing data in the database
        console.log(`   Filter: ${JSON.stringify(filter.filter, null, 2)}`);
        
        // For now, let's just show what we have in the database
        const { Pool } = require('pg');
        const path = require('path');
        require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
        
        const pool = new Pool({
          user: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          database: process.env.POSTGRES_DB,
          host: process.env.POSTGRES_HOST || 'localhost',
          port: process.env.POSTGRES_PORT || 5432,
        });
        
        const dbResult = await pool.query(`
          SELECT 
            DATE(bucket_start AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Vienna') as date,
            SUM(count) as total_tickets,
            COUNT(DISTINCT assignee_id) as unique_assignees
          FROM closed_by_assignee 
          WHERE DATE(bucket_start AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Vienna') = $1
          GROUP BY DATE(bucket_start AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Vienna')
        `, [currentDate.format('YYYY-MM-DD')]);
        
        if (dbResult.rows.length > 0) {
          const row = dbResult.rows[0];
          console.log(`   ✅ Found: ${row.total_tickets} tickets, ${row.unique_assignees} assignees`);
          dailyData[currentDate.format('YYYY-MM-DD')] = {
            tickets: parseInt(row.total_tickets),
            assignees: parseInt(row.unique_assignees)
          };
          totalTickets += parseInt(row.total_tickets);
        } else {
          console.log(`   ❌ No data found in database`);
          dailyData[currentDate.format('YYYY-MM-DD')] = {
            tickets: 0,
            assignees: 0
          };
        }
        
        await pool.end();
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        dailyData[currentDate.format('YYYY-MM-DD')] = {
          tickets: 0,
          assignees: 0
        };
      }
      
      console.log('');
    }
    
    // Summary
    console.log('📊 Summary:');
    console.log('Date       | Tickets | Assignees');
    console.log('-----------|---------|----------');
    Object.entries(dailyData).forEach(([date, data]) => {
      console.log(`${date} | ${data.tickets.toString().padStart(7)} | ${data.assignees.toString().padStart(9)}`);
    });
    console.log('-----------|---------|----------');
    console.log(`Total      | ${totalTickets.toString().padStart(7)} |`);
    
    console.log('\n💡 Analysis:');
    const ticketCounts = Object.values(dailyData).map(d => d.tickets);
    const uniqueCounts = [...new Set(ticketCounts)];
    
    if (uniqueCounts.length === 1) {
      console.log(`   ⚠️  All days have exactly ${uniqueCounts[0]} tickets - this seems suspicious`);
    } else {
      console.log(`   ✅ Ticket counts vary: ${ticketCounts.join(', ')}`);
    }
    
    console.log(`   📈 Total tickets processed: ${totalTickets}`);
    console.log(`   📅 Days with data: ${Object.values(dailyData).filter(d => d.tickets > 0).length}/7`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

directPylonAnalysis();


