const axios = require('axios');
const dayjs = require('dayjs');

class PylonService {
  constructor() {
    this.baseURL = process.env.PYLON_API_URL;
    this.apiToken = process.env.PYLON_API_TOKEN;
    
    if (!this.baseURL || !this.apiToken) {
      console.error('❌ Pylon API configuration missing! Please check your .env file.');
      console.error('Required: PYLON_API_URL and PYLON_API_TOKEN');
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

  // Generic API call method with rate limiting protection
  async apiCall(endpoint, method = 'GET', data = null, retryCount = 0) {
    const maxRetries = 1; // Reduce to only 1 retry to minimize API calls
    
    try {
      // Add longer delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response = await this.client({
        method,
        url: endpoint,
        data
      });
      return response.data;
    } catch (error) {
      console.error(`Pylon API Error (${endpoint}):`, error.response?.data || error.message);
      
      // If rate limited and we haven't exceeded max retries, wait and retry
      if (error.response?.status === 429 && retryCount < maxRetries) {
        const waitTime = 5000; // Wait 5 seconds before retry
        // Rate limited, waiting before retry
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.apiCall(endpoint, method, data, retryCount + 1);
      }
      
      // For other errors or max retries exceeded, don't retry
      if (error.response?.status === 429) {
        console.error(`Rate limit exceeded after ${maxRetries} retries. Skipping request.`);
      }
      
      throw new Error(`Pylon API call failed: ${error.response?.statusText || error.message}`);
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

  // Build filter for tickets open > 24h
  buildOpenOver24hFilter() {
    const twentyFourHoursAgo = dayjs().subtract(24, 'hour').toISOString();
    
    return {
      search: true,
      limit: 1000,
      filter: {
        operator: 'and',
        subfilters: [
          {
            field: 'state',
            operator: 'not_in',
            values: ['closed', 'cancelled']
          },
          {
            field: 'created_at',
            operator: 'time_is_before',
            value: twentyFourHoursAgo
          }
        ]
      }
    };
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

  // Get daily flow data (created vs closed vs cancelled for last 14 days)
  async getDailyFlowData() {
    const dailyData = [];
    const startDate = dayjs().subtract(13, 'day');
    const endDate = dayjs();
    
    // Use RFC3339 format as required by Pylon API
    const startTime = startDate.startOf('day').toISOString();
    const endTime = endDate.endOf('day').toISOString();
    
    // Make 3 API calls: created, closed, and cancelled tickets
    const createdFilter = {
      limit: 500, // Reduced from 1000 to make it faster
      start_time: startTime,
      end_time: endTime
    };
    
    const closedFilter = {
      search: true,
      limit: 500, // Reduced from 1000 to make it faster
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
            values: [startTime, endTime]
          }
        ]
      }
    };

    const cancelledFilter = {
      search: true,
      limit: 500,
      filter: {
        operator: 'and',
        subfilters: [
          {
            field: 'state',
            operator: 'equals',
            value: 'cancelled'
          },
          {
            field: 'created_at',
            operator: 'time_range',
            values: [startTime, endTime]
          }
        ]
      }
    };
    
    try {
      const [createdResponse, closedResponse, cancelledResponse] = await Promise.all([
        this.getIssues(createdFilter),
        this.getIssues(closedFilter),
        this.getIssues(cancelledFilter)
      ]);
      
      const createdTickets = createdResponse.data || [];
      const closedTickets = closedResponse.data || [];
      const cancelledTickets = cancelledResponse.data || [];
      
      // Group tickets by date
      for (let i = 13; i >= 0; i--) {
        const date = dayjs().subtract(i, 'day');
        const dateStr = date.format('YYYY-MM-DD');
        
        const createdCount = createdTickets.filter(ticket => 
          dayjs(ticket.created_at).format('YYYY-MM-DD') === dateStr
        ).length;
        
        const closedCount = closedTickets.filter(ticket => 
          ticket.custom_fields?.closed_at?.value && 
          dayjs(ticket.custom_fields.closed_at.value).format('YYYY-MM-DD') === dateStr
        ).length;

        const cancelledCount = cancelledTickets.filter(ticket => 
          dayjs(ticket.created_at).format('YYYY-MM-DD') === dateStr
        ).length;
        
        dailyData.push({
          date: dateStr,
          created: createdCount,
          closed: closedCount,
          cancelled: cancelledCount
        });
      }
    } catch (error) {
      console.error('Error fetching daily flow data:', error);
      // Return empty data for all days if API fails
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
      
      const filter = {
        search: true,
        limit: 1000,
        filter: {
          operator: 'and',
          subfilters: [
            {
              field: 'created_at',
              operator: 'time_is_after',
              value: startTime.toISOString()
            },
            {
              field: 'created_at',
              operator: 'time_is_before',
              value: endTime.toISOString()
            }
          ]
        }
      };

      const response = await this.apiCall('/issues/search', 'POST', filter);
      
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

      // Convert to array format
      const result = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const key = `${day}-${hour}`;
          result.push({
            day,
            hour,
            count: hourlyData[key] || 0
          });
        }
      }

      return { data: result };
    } catch (error) {
      console.error('Error fetching hourly ticket creation data:', error);
      throw error;
    }
  }

}

module.exports = new PylonService();
