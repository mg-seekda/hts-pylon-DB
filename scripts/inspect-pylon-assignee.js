const axios = require('axios');

async function inspectPylonAssignee() {
  console.log('🔍 Inspecting Pylon API assignee data structure...\n');
  
  try {
    // Test with a known date that has data
    const testDate = '2025-09-02';
    const dayStart = new Date(testDate + 'T00:00:00.000Z');
    const dayEnd = new Date(testDate + 'T23:59:59.999Z');
    
    console.log(`📅 Testing date: ${testDate}`);
    console.log(`🕐 Day start: ${dayStart.toISOString()}`);
    console.log(`🕐 Day end: ${dayEnd.toISOString()}\n`);
    
    // Call the Pylon API directly through our server
    const filter = {
      search: true,
      limit: 10, // Just get a few tickets to inspect
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
    
    // Call our server's Pylon service
    const response = await axios.post('http://localhost:3001/api/tickets/search', filter);
    const tickets = response.data.data || [];
    
    console.log(`\n📊 Found ${tickets.length} tickets`);
    
    if (tickets.length > 0) {
      console.log('\n🔍 Inspecting first few tickets:');
      tickets.slice(0, 3).forEach((ticket, index) => {
        console.log(`\n--- Ticket ${index + 1} ---`);
        console.log(`ID: ${ticket.id}`);
        console.log(`Title: ${ticket.title}`);
        console.log(`State: ${ticket.state}`);
        console.log(`Assignee:`, JSON.stringify(ticket.assignee, null, 2));
        
        // Check if there are other fields that might contain assignee info
        console.log(`Available fields:`, Object.keys(ticket));
        
        // Check custom fields for assignee info
        if (ticket.custom_fields) {
          console.log(`Custom fields:`, Object.keys(ticket.custom_fields));
          const assigneeFields = Object.entries(ticket.custom_fields).filter(([key, value]) => 
            key.toLowerCase().includes('assignee') || 
            key.toLowerCase().includes('user') ||
            key.toLowerCase().includes('owner')
          );
          if (assigneeFields.length > 0) {
            console.log(`Potential assignee fields:`, assigneeFields);
          }
        }
      });
      
      // Check if there are any other fields that might contain assignee names
      console.log('\n🔍 Checking for assignee name patterns...');
      const allFields = new Set();
      tickets.forEach(ticket => {
        Object.keys(ticket).forEach(key => allFields.add(key));
        if (ticket.custom_fields) {
          Object.keys(ticket.custom_fields).forEach(key => allFields.add(`custom_fields.${key}`));
        }
      });
      
      console.log('All available fields:', Array.from(allFields).sort());
      
      // Look for fields that might contain user/assignee names
      const userFields = Array.from(allFields).filter(field => 
        field.toLowerCase().includes('user') ||
        field.toLowerCase().includes('assignee') ||
        field.toLowerCase().includes('owner') ||
        field.toLowerCase().includes('name')
      );
      
      if (userFields.length > 0) {
        console.log('\n🎯 Potential user/assignee fields:', userFields);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

inspectPylonAssignee();


