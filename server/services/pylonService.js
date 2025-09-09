const axios = require('axios');
const dayjs = require('dayjs');
const database = require('./database');

class PylonService {
  constructor() {
    this.baseURL = process.env.PYLON_API_URL;
    this.apiToken = process.env.PYLON_API_TOKEN;
    this.isConfigured = !!(this.baseURL && this.apiToken);
    
    if (!this.isConfigured) {
      console.error('❌ Pylon API configuration missing! Please check your .env file.');
      console.error('Required: PYLON_API_URL and PYLON_API_TOKEN');
      // Create a dummy client that will throw errors
      this.client = null;
      return;
    }
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  // Generic API call method
  async apiCall(endpoint, method = 'GET', data = null, params = null) {
    if (!this.isConfigured) {
      throw new Error('Pylon API not configured. Please check your environment variables.');
    }
    
    try {
      const response = await this.client({
        method,
        url: endpoint,
        data,
        params
      });
      return response.data;
    } catch (error) {
      console.error(`Pylon API Error (${endpoint}):`, error.response?.data || error.message);
      throw error;
    }
  }

  // Get all issues with optional filtering
  async getIssues(filters = {}) {
    const endpoint = filters.search ? '/issues/search' : '/issues';
    return await this.apiCall(endpoint, filters.search ? 'POST' : 'GET', filters);
  }

  // Get all users
  async getUsers() {
    return await this.apiCall('/users');
  }

  // Get a single issue by ID
  async getIssue(issueId) {
    return await this.apiCall(`/issues/${issueId}`);
  }



  // Build filter for open tickets (all statuses except closed and cancelled)
  buildOpenTicketsFilter() {
    return {
      search: true,
      limit: 1000,
      filter: {
        field: 'state',
        operator: 'not_in',
        values: ['closed', 'cancelled']
      }
    };
  }

  // Build filter for tickets created today
  buildTicketsCreatedTodayFilter() {
    const today = dayjs();
    const startOfDay = today.startOf('day').toISOString();
    const endOfDay = today.endOf('day').toISOString();
    
    return {
      limit: 200,
      start_time: startOfDay,
      end_time: endOfDay
    };
  }

  // Build filter for on hold tickets
  buildOnHoldTicketsFilter() {
    return {
      search: true,
      limit: 200,
      filter: {
        field: 'state',
        operator: 'equals',
        value: 'on_hold'
      }
    };
  }

  // Build filter for tickets open > 24h (new or on_you status, not on_hold/closed/cancelled)
  buildOpenOver24hFilter() {
    const twentyFourHoursAgo = dayjs().subtract(24, 'hour').toISOString();
    
    const filter = {
      search: true,
      limit: 1000,
      filter: {
        operator: 'and',
        subfilters: [
          {
            field: 'state',
            operator: 'in',
            values: ['new', 'on_you']
          },
          {
            field: 'state',
            operator: 'not_in',
            values: ['on_hold', 'closed', 'cancelled']
          },
          {
            field: 'created_at',
            operator: 'time_is_before',
            value: twentyFourHoursAgo
          }
        ]
      }
    };
    
    return filter;
  }

  // Build filter for closed tickets today
  buildClosedTodayFilter() {
    const today = dayjs();
    const startOfDay = today.startOf('day').toISOString();
    const endOfDay = today.endOf('day').toISOString();
    
    return {
      search: true,
      limit: 200,
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
            values: [startOfDay, endOfDay]
          }
        ]
      }
    };
  }

  // Build filter for closed tickets in last 30 days
  buildClosedTicketsLast30DaysFilter() {
    const today = dayjs();
    const thirtyDaysAgo = today.subtract(30, 'day').startOf('day').toISOString();
    const endOfToday = today.endOf('day').toISOString();
    
    return {
      search: true,
      limit: 500,
      include: ['custom_fields'], // Include custom fields to get closed_at
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
            values: [thirtyDaysAgo, endOfToday]
          }
        ]
      }
    };
  }

  // Build filter for new tickets (status = new, no matter when created)
  buildNewTicketsFilter() {
    return {
      search: true,
      limit: 1000,
      filter: {
        field: 'state',
        operator: 'equals',
        value: 'new'
      }
    };
  }

  // Build filter for tickets with external issues (status not cancelled or closed, no matter when created)
  // Note: We can't filter by external_issues directly in Pylon API, so we fetch all open tickets
  // and filter them in the application code
  buildExternalIssuesTicketsFilter() {
    return {
      search: true,
      limit: 1000,
      filter: {
        field: 'state',
        operator: 'not_in',
        values: ['closed', 'cancelled']
      }
    };
  }

  // Get daily flow data (created vs closed vs cancelled for last 14 days)
  // Now uses webhook data from ticket_status_events for consistency
  async getDailyFlowData() {
    const dailyData = [];
    const startDate = dayjs().subtract(13, 'day');
    const endDate = dayjs();
    
    try {
      // Get created tickets from Pylon API (like before)
      const createdFilter = {
        limit: 2000,
        start_time: startDate.startOf('day').toISOString(),
        end_time: endDate.endOf('day').toISOString()
      };
      
      const createdResponse = await this.apiCall('/issues', 'GET', null, createdFilter);
      const createdTickets = createdResponse.data || [];

      // Get closed/cancelled events from database (last occurrence per ticket)
      const events = await database.query(`
        SELECT 
          ticket_id,
          status,
          occurred_at_utc,
          closed_at_utc,
          ROW_NUMBER() OVER (PARTITION BY ticket_id, status ORDER BY occurred_at_utc DESC) as rn
        FROM ticket_status_events 
        WHERE occurred_at_utc >= $1 
          AND occurred_at_utc <= $2
          AND (status = 'closed' OR status = 'cancelled')
        ORDER BY ticket_id, status, occurred_at_utc DESC
      `, [startDate.startOf('day').utc().toISOString(), endDate.endOf('day').utc().toISOString()]);

      // Get only the latest event per ticket per status
      const latestEvents = events.rows.filter(event => event.rn === 1);
      
      // Group closed/cancelled events by ticket
      const ticketStates = {};
      latestEvents.forEach(event => {
        if (!ticketStates[event.ticket_id]) {
          ticketStates[event.ticket_id] = {
            closed: null,
            cancelled: null
          };
        }
        
        if (event.status === 'closed') {
          ticketStates[event.ticket_id].closed = event.closed_at_utc || event.occurred_at_utc;
        } else if (event.status === 'cancelled') {
          ticketStates[event.ticket_id].cancelled = event.closed_at_utc || event.occurred_at_utc;
        }
      });

      // Group tickets by date
      for (let i = 13; i >= 0; i--) {
        const date = dayjs().subtract(i, 'day');
        const dateStr = date.format('YYYY-MM-DD');
        
        let createdCount = 0;
        let closedCount = 0;
        let cancelledCount = 0;

        // Count created tickets from Pylon API
        createdTickets.forEach(ticket => {
          if (ticket.created_at && dayjs(ticket.created_at).format('YYYY-MM-DD') === dateStr) {
            createdCount++;
          }
        });

        // Count closed/cancelled tickets from database
        Object.values(ticketStates).forEach(ticket => {
          // Count closed tickets
          if (ticket.closed && dayjs(ticket.closed).format('YYYY-MM-DD') === dateStr) {
            closedCount++;
          }
          
          // Count cancelled tickets
          if (ticket.cancelled && dayjs(ticket.cancelled).format('YYYY-MM-DD') === dateStr) {
            cancelledCount++;
          }
        });
        
        dailyData.push({
          date: dateStr,
          created: createdCount,
          closed: closedCount,
          cancelled: cancelledCount
        });
      }
    } catch (error) {
      console.error('Error fetching daily flow data:', error);
      // Return empty data for all days if query fails
      for (let i = 13; i >= 0; i--) {
        const date = dayjs().subtract(i, 'day');
        dailyData.push({
          date: date.format('YYYY-MM-DD'),
          created: 0,
          closed: 0,
          cancelled: 0
        });
      }
    }

    return dailyData;
  }

  // Get oldest open tickets
  async getOldestOpenTickets(limit = 10) {
    const filter = this.buildOpenTicketsFilter();
    filter.limit = limit;
    
    const response = await this.getIssues(filter);
    const tickets = response.data || [];
    
    // Sort by created_at ascending (oldest first)
    return tickets.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  // Get top accounts with open tickets
  async getTopAccountsWithOpenTickets(limit = 5) {
    const filter = this.buildOpenTicketsFilter();
    const response = await this.getIssues(filter);
    const tickets = response.data || [];
    
    // Group by account and count
    const accountCounts = {};
    tickets.forEach(ticket => {
      if (ticket.account?.id) {
        accountCounts[ticket.account.id] = (accountCounts[ticket.account.id] || 0) + 1;
      }
    });
    
    // Sort by count and return top accounts
    return Object.entries(accountCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([accountId, count]) => ({ accountId, count }));
  }



  // Get oldest open tickets
  async getOldestOpenTickets(limit = 10) {
    const filter = {
      search: true,
      limit: limit + 5, // Get a few more to ensure we have enough after filtering
      filter: {
        field: 'state',
        operator: 'not_in',
        values: ['closed', 'cancelled']
      }
    };

    try {
      const response = await this.getIssues(filter);
      const openTickets = response.data || [];
      
      // Sort by created_at and take the oldest ones
      const oldestTickets = openTickets
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .slice(0, limit)
        .map(ticket => ({
          id: ticket.id,
          title: ticket.title,
          state: ticket.state,
          assignee: ticket.assignee,
          account: ticket.account,
          created_at: ticket.created_at,
          link: ticket.link
        }));

      return oldestTickets;
    } catch (error) {
      console.error('Error fetching oldest open tickets:', error);
      return [];
    }
  }

  // Get top accounts with open tickets
  async getTopAccountsWithOpenTickets(limit = 5) {
    const filter = {
      search: true,
      limit: 500, // Reduced from 1000 to make it faster
      filter: {
        field: 'state',
        operator: 'not_in',
        values: ['closed', 'cancelled']
      }
    };

    try {
      const response = await this.getIssues(filter);
      const openTickets = response.data || [];
      
      // Count tickets per account
      const accountCounts = {};
      openTickets.forEach(ticket => {
        if (ticket.account?.id) {
          const accountId = ticket.account.id;
          if (!accountCounts[accountId]) {
            accountCounts[accountId] = {
              id: accountId,
              count: 0,
              tickets: []
            };
          }
          accountCounts[accountId].count++;
          accountCounts[accountId].tickets.push(ticket);
        }
      });

      // Sort by count and take top accounts
      const topAccounts = Object.values(accountCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map(account => ({
          id: account.id,
          openTicketsCount: account.count,
          tickets: account.tickets.slice(0, 3) // Show first 3 tickets as examples
        }));

      return topAccounts;
    } catch (error) {
      console.error('Error fetching top accounts with open tickets:', error);
      return [];
    }
  }

  async getHourlyTicketCreationData(days = 30) {
    try {
      const endTime = dayjs();
      const startTime = endTime.subtract(days, 'day');
      
      // Use the same format as daily flow data - direct time parameters
      const filter = {
        limit: 2000, // Increased limit for better statistical significance
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString()
      };

      const response = await this.apiCall('/issues', 'GET', null, filter);
      
      if (!response.data) {
        return { data: [] };
      }

      // Process the data to group by day of week and hour
      const hourlyData = {};
      
      response.data.forEach(ticket => {
        const createdAt = dayjs(ticket.created_at);
        const dayOfWeek = createdAt.day(); // 0 = Sunday, 1 = Monday, etc.
        const hour = createdAt.hour();
        
        const key = `${dayOfWeek}-${hour}`;
        hourlyData[key] = (hourlyData[key] || 0) + 1;
      });

      // Calculate how many times each day of week appears in the 30-day period
      // For 30 days, each day of the week appears exactly 4-5 times
      const startDate = dayjs().subtract(days, 'day');
      const endDate = dayjs();
      
      // Count actual occurrences of each day of week in the period
      const dayOccurrences = {};
      for (let day = 0; day < 7; day++) {
        dayOccurrences[day] = 0;
      }
      
      // Count each day of week in the period
      let currentDate = startDate;
      while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
        const dayOfWeek = currentDate.day();
        dayOccurrences[dayOfWeek]++;
        currentDate = currentDate.add(1, 'day');
      }

      // Convert to array format with averages
      const result = [];
      console.log('Day occurrences in period:', dayOccurrences);
      console.log('Total tickets processed:', response.data.length);
      
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const key = `${day}-${hour}`;
          const totalCount = hourlyData[key] || 0;
          const occurrences = dayOccurrences[day];
          const averageCount = occurrences > 0 ? totalCount / occurrences : 0;
          
          result.push({
            day,
            hour,
            count: Math.round(averageCount * 100) / 100 // Round to 2 decimal places
          });
        }
      }
      
      // Heatmap data generated
      console.log('Sample data points:', result.slice(0, 5));

      return { data: result };
    } catch (error) {
      console.error('Error fetching hourly ticket creation data:', error);
      throw error;
    }
  }

}

module.exports = new PylonService();
