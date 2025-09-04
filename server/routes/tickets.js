const express = require('express');
const router = express.Router();
const pylonService = require('../services/pylonService');
const { cache } = require('../middleware/cache');
const dayjs = require('dayjs');

// Get global KPIs
router.get('/kpis', async (req, res) => {
  try {
    const cacheKey = 'tickets:kpis';
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    let openTickets, ticketsCreatedToday, onHoldTickets, openOver24h, closedTodayTickets, closedTicketsLast30Days, newTickets, allOpenTickets, externalIssuesTickets;
    
    try {
      [
        openTickets,
        ticketsCreatedToday,
        onHoldTickets,
        openOver24h,
        closedTodayTickets,
        closedTicketsLast30Days,
        newTickets,
        allOpenTickets
      ] = await Promise.all([
        pylonService.getIssues(pylonService.buildOpenTicketsFilter()),
        pylonService.getIssues(pylonService.buildTicketsCreatedTodayFilter()),
        pylonService.getIssues(pylonService.buildOnHoldTicketsFilter()),
        pylonService.getIssues(pylonService.buildOpenOver24hFilter()), // Tickets with status 'new' or 'on_you', not on_hold/closed/cancelled, older than 24h
        pylonService.getIssues(pylonService.buildClosedTodayFilter()),
        pylonService.getIssues(pylonService.buildClosedTicketsLast30DaysFilter()),
        pylonService.getIssues(pylonService.buildNewTicketsFilter()),
        pylonService.getIssues(pylonService.buildExternalIssuesTicketsFilter())
      ]);
      
      // Filter external issues tickets in application code
      externalIssuesTickets = {
        data: allOpenTickets.data?.filter(ticket => 
          ticket.external_issues && 
          Array.isArray(ticket.external_issues) && 
          ticket.external_issues.length > 0
        ) || [],
        total: 0
      };
      
    } catch (error) {
      console.error('Error fetching KPI data:', error);
      // Return empty data structure to prevent dashboard crash
      openTickets = { data: [], total: 0 };
      ticketsCreatedToday = { data: [], total: 0 };
      onHoldTickets = { data: [], total: 0 };
      openOver24h = { data: [], total: 0 };
      closedTodayTickets = { data: [], total: 0 };
      closedTicketsLast30Days = { data: [], total: 0 };
      newTickets = { data: [], total: 0 };
      externalIssuesTickets = { data: [], total: 0 };
    }

    // Calculate average resolution time for closed tickets in last 30 days
    let avgResolutionTime = 0;
    if (closedTicketsLast30Days.data && closedTicketsLast30Days.data.length > 0) {
      // Processing closed tickets for resolution time calculation
      
      const resolutionTimes = closedTicketsLast30Days.data
        .filter(ticket => {
          const hasCreatedAt = ticket.created_at;
          const hasClosedAt = ticket.custom_fields?.closed_at?.value || ticket.closed_at;
          // Validating ticket data for resolution time calculation
          return hasCreatedAt && hasClosedAt;
        })
        .map(ticket => {
          const created = new Date(ticket.created_at);
          const closed = new Date(ticket.custom_fields?.closed_at?.value || ticket.closed_at);
          const hours = (closed - created) / (1000 * 60 * 60);
          // Calculating resolution time in hours
          return hours;
        })
        .filter(time => time > 0 && time < 8760); // Filter out invalid times (0 or >1 year)
      
      if (resolutionTimes.length > 0) {
        avgResolutionTime = resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length;
      }
    }

    const kpis = {
      totalOpen: openTickets.data?.length || 0,
      createdToday: ticketsCreatedToday.data?.length || 0,
      onHold: onHoldTickets.data?.length || 0,
      openOver24h: openOver24h.data?.length || 0,
      closedToday: closedTodayTickets.data?.length || 0,
      avgResolutionTime: Math.round(avgResolutionTime * 10) / 10, // Round to 1 decimal place
      newTickets: newTickets.data?.length || 0,
      externalIssues: externalIssuesTickets.data?.length || 0
    };


    // Try to cache, but don't fail if Redis is not available
    try {
      await cache.set(cacheKey, kpis, 60); // Cache for 60 seconds
    } catch (cacheError) {
      // Cache not available, skipping cache set
    }
    res.json(kpis);
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// Get ticket assignment table data
router.get('/assignment-table', async (req, res) => {
  try {
    const cacheKey = 'tickets:assignment-table';
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    // Get all users and open tickets
    const [usersResponse, openTicketsResponse] = await Promise.all([
      pylonService.getUsers(),
      pylonService.getIssues(pylonService.buildOpenTicketsFilter())
    ]);

    const allUsers = usersResponse.data || [];
    const openTickets = openTicketsResponse.data || [];
    

    
    // Filter out test users and bots
    const users = allUsers.filter(user => 
      !user.name.toLowerCase().includes('test') && 
      !user.name.toLowerCase().includes('bot') &&
      !user.email?.toLowerCase().includes('test')
    );

    // Define the required statuses in order
    const requiredStatuses = ['new', 'waiting_on_you', 'on_hold', 'waiting_on_customer'];
    
    // Get all unique statuses from open tickets and ensure we have all required ones
    const ticketStatuses = [...new Set(openTickets.map(ticket => ticket.state))];
    const statuses = requiredStatuses.filter(status => ticketStatuses.includes(status));
    
    // Get closed today tickets for all users
    const closedTodayResponse = await pylonService.getIssues(pylonService.buildClosedTodayFilter());
    const closedTodayTickets = closedTodayResponse.data || [];

    // Build assignment table
    const allUserData = users.map(user => {
      const userTickets = openTickets.filter(ticket => 
        ticket.assignee?.id === user.id
      );
      const userClosedToday = closedTodayTickets.filter(ticket => 
        ticket.assignee?.id === user.id
      );

      const statusCounts = {};
      statuses.forEach(status => {
        statusCounts[status] = userTickets.filter(ticket => ticket.state === status).length;
      });

      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url || user.avatarUrl || null,
        statusCounts,
        closedToday: userClosedToday.length,
        totalOpen: userTickets.length
      };
      

      
      return userData;
    });

    // Filter out users with all zeros (no activity)
    const activeUsers = allUserData.filter(user => {
      const hasStatusTickets = statuses.some(status => (user.statusCounts[status] || 0) > 0);
      const hasClosedToday = (user.closedToday || 0) > 0;
      return hasStatusTickets || hasClosedToday;
    });

    const assignmentTable = {
      users: activeUsers,
      
      // Add unassigned row
      unassigned: {
        id: 'unassigned',
        name: 'Unassigned',
        email: null,
        statusCounts: statuses.reduce((acc, status) => {
          acc[status] = openTickets.filter(ticket => 
            !ticket.assignee && ticket.state === status
          ).length;
          return acc;
        }, {}),
        closedToday: closedTodayTickets.filter(ticket => !ticket.assignee).length,
        totalOpen: openTickets.filter(ticket => !ticket.assignee).length
      },
      
      statuses,
      totalTickets: activeUsers.reduce((sum, user) => sum + user.totalOpen, 0) + 
                   openTickets.filter(ticket => !ticket.assignee).length
    };

    // Try to cache, but don't fail if Redis is not available
    try {
      await cache.set(cacheKey, assignmentTable, 60); // Cache for 60 seconds
    } catch (cacheError) {
      // Cache not available, skipping cache set
    }
    res.json(assignmentTable);
  } catch (error) {
    console.error('Error fetching assignment table:', error);
    res.status(500).json({ error: 'Failed to fetch assignment table' });
  }
});

// Get tickets by assignee and status
router.get('/by-assignee/:assigneeId/:status', async (req, res) => {
  try {
    const { assigneeId, status } = req.params;
    const cacheKey = `tickets:by-assignee:${assigneeId}:${status}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    let filter;
    if (status === 'closed_today') {
      // Use search endpoint for closed today with custom field
      filter = {
        search: true,
        limit: 200,
        filter: {
          operator: 'and',
          subfilters: [
            {
              field: 'assignee_id',
              operator: 'equals',
              value: assigneeId
            },
            {
              field: 'state',
              operator: 'equals',
              value: 'closed'
            },
            {
              field: 'closed_at',
              operator: 'time_range',
              values: [
                dayjs().startOf('day').toISOString(),
                dayjs().endOf('day').toISOString()
              ]
            }
          ]
        }
      };
    } else {
      // Use search endpoint for other statuses
      filter = {
        search: true,
        limit: 200,
        filter: {
          operator: 'and',
          subfilters: [
            {
              field: 'assignee_id',
              operator: 'equals',
              value: assigneeId
            },
            {
              field: 'state',
              operator: 'equals',
              value: status
            }
          ]
        }
      };
    }
    
    const response = await pylonService.getIssues(filter);
    
    const result = {
      tickets: response.data || [],
      count: response.data?.length || 0,
      assigneeId,
      status
    };

    // Try to cache, but don't fail if Redis is not available
    try {
      await cache.set(cacheKey, result, 60); // Cache for 60 seconds
    } catch (cacheError) {
      // Cache not available, skipping cache set
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching tickets by assignee:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get oldest open tickets
router.get('/oldest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const cacheKey = `tickets:oldest:${limit}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const oldestTickets = await pylonService.getOldestOpenTickets(limit);
    
    const result = {
      tickets: oldestTickets,
      count: oldestTickets.length
    };

    // Try to cache, but don't fail if Redis is not available
    try {
      await cache.set(cacheKey, result, 60); // Cache for 60 seconds
    } catch (cacheError) {
      // Cache not available, skipping cache set
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching oldest tickets:', error);
    res.status(500).json({ error: 'Failed to fetch oldest tickets' });
  }
});

// Get top accounts with open tickets
router.get('/top-accounts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const cacheKey = `tickets:top-accounts:${limit}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const topAccounts = await pylonService.getTopAccountsWithOpenTickets(limit);
    
    const result = {
      accounts: topAccounts,
      count: topAccounts.length
    };

    // Try to cache, but don't fail if Redis is not available
    try {
      await cache.set(cacheKey, result, 60); // Cache for 60 seconds
    } catch (cacheError) {
      // Cache not available, skipping cache set
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching top accounts:', error);
    res.status(500).json({ error: 'Failed to fetch top accounts' });
  }
});

module.exports = router;
