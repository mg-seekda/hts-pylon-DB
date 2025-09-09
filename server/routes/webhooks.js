const express = require('express');
const crypto = require('crypto');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const router = express.Router();
const databaseService = require('../services/database');
const BusinessHoursCalculator = require('../utils/businessHours');

dayjs.extend(timezone);

// We need to capture the raw body before Express parses it
// This requires setting up the route differently in the main server file

// Initialize business hours calculator
const businessHours = new BusinessHoursCalculator();

// Webhook signature verification middleware
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-pylon-signature'];
  const timestamp = req.headers['x-pylon-timestamp'];
  const webhookSecret = process.env.PYLON_WEBHOOK_SECRET;

  // Webhook authentication logging removed for production

  if (!signature || !webhookSecret) {
    console.log('❌ Missing webhook authentication');
    return res.status(401).json({ error: 'Missing webhook authentication' });
  }

  // If timestamp is provided, check for replay attacks (5 minute window)
  if (timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp);
    
    if (Math.abs(now - webhookTime) > 300) { // 5 minutes
      console.log('❌ Request timestamp too old:', { now, webhookTime, diff: Math.abs(now - webhookTime) });
      return res.status(401).json({ error: 'Request timestamp too old' });
    }
  }

  // Get the raw body from our custom middleware
  const rawBody = req.rawBody || req.body.toString('utf8');
  
  // Verify signature using Pylon's format: HMAC-SHA256 of raw payload bytes
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    console.log('❌ Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  next();
};

// POST /webhooks/pylon/tickets
// Expected payload from Pylon:
// {
//   "type": "ticket.created" | "ticket.status_changed",
//   "ticket_id": "ticket-123",
//   "status": "open|pending|in_progress|closed|..."
// }
// Note: event_id and occurred_at are generated server-side
router.post('/pylon/tickets', verifyWebhookSignature, async (req, res) => {
  try {
    // Use the parsed body from our custom middleware
    const body = req.body;
    
    // Webhook received - processing event

    const { type, ticket_id, status, assignee_id, assignee_name, closed_at } = body;

    // Validate required fields
    if (!type || !ticket_id || !status) {
      return res.status(400).json({ 
        error: 'Missing required fields: type, ticket_id, status' 
      });
    }

    // Only process status change and creation events
    if (!['ticket.status_changed', 'ticket.created'].includes(type)) {
      return res.status(200).json({ message: 'Event type not relevant for lifecycle tracking' });
    }

    // Generate event_id on our side
    const eventId = `${ticket_id}-${status}-${Date.now()}`;
    
    // Use current server time as occurred_at
    const occurredAt = new Date();

    // Check for duplicate events (using our generated event_id)
    const existingEvent = await databaseService.query(
      'SELECT id FROM ticket_status_events WHERE event_id = $1',
      [eventId]
    );

    if (existingEvent.rows.length > 0) {
      return res.status(200).json({ message: 'Event already processed' });
    }

    // Process closed_at timestamp
    let closedAtUtc = null;
    if (closed_at && (status === 'closed' || status === 'cancelled')) {
      try {
        closedAtUtc = new Date(closed_at).toISOString();
      } catch (error) {
        console.warn(`Invalid closed_at timestamp for ticket ${ticket_id}: ${closed_at}`);
      }
    }

    // Store the event
    await databaseService.query(`
      INSERT INTO ticket_status_events (event_id, ticket_id, status, assignee_id, assignee_name, closed_at_utc, occurred_at_utc, raw)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [eventId, ticket_id, status, assignee_id || null, assignee_name || null, closedAtUtc, occurredAt.toISOString(), JSON.stringify(body)]);

    // Enqueue segment processing (async)
    processTicketSegments(ticket_id).catch(error => {
      console.error(`Error processing segments for ticket ${ticket_id}:`, error);
    });

    // Update assignee counts (async) - handles both assigned and unassigned tickets
    updateAssigneeCounts(ticket_id, status, assignee_id, assignee_name, closedAtUtc).catch(error => {
      console.error(`Error updating assignee counts for ticket ${ticket_id}:`, error);
    });

    res.status(200).json({ message: 'Event processed successfully' });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Process ticket segments asynchronously
async function processTicketSegments(ticketId) {
  try {
    // Get all events for this ticket, ordered by occurred_at
    const events = await databaseService.query(`
      SELECT ticket_id, status, occurred_at_utc
      FROM ticket_status_events
      WHERE ticket_id = $1
      ORDER BY occurred_at_utc ASC
    `, [ticketId]);

    if (events.rows.length === 0) {
      return;
    }

    // Get existing segments for this ticket
    const existingSegments = await databaseService.query(`
      SELECT id, status, entered_at_utc, left_at_utc
      FROM ticket_status_segments
      WHERE ticket_id = $1
      ORDER BY entered_at_utc ASC
    `, [ticketId]);

    // Close all existing open segments
    for (const segment of existingSegments.rows) {
      if (!segment.left_at_utc) {
        await databaseService.query(`
          UPDATE ticket_status_segments
          SET left_at_utc = $1, updated_at = now()
          WHERE id = $2
        `, [new Date().toISOString(), segment.id]);
      }
    }

    // Create new segments based on events
    for (let i = 0; i < events.rows.length; i++) {
      const currentEvent = events.rows[i];
      const nextEvent = events.rows[i + 1];

      // Check if this status segment already exists
      const existingSegment = existingSegments.rows.find(seg => 
        seg.status === currentEvent.status && 
        new Date(seg.entered_at_utc).getTime() === new Date(currentEvent.occurred_at_utc).getTime()
      );

      if (!existingSegment) {
        // Create new segment
        const leftAt = nextEvent ? nextEvent.occurred_at_utc : null;
        
        await databaseService.query(`
          INSERT INTO ticket_status_segments (ticket_id, status, entered_at_utc, left_at_utc)
          VALUES ($1, $2, $3, $4)
        `, [ticketId, currentEvent.status, currentEvent.occurred_at_utc, leftAt]);
      }
    }

    // Segments processed successfully

  } catch (error) {
    console.error(`Error processing segments for ticket ${ticketId}:`, error);
    throw error;
  }
}

// Update assignee counts when ticket status changes
async function updateAssigneeCounts(ticketId, newStatus, assigneeId, assigneeName, closedAtUtc) {
  try {
    // Only process closed tickets (cancelled tickets are handled separately in daily flow chart)
    if (newStatus !== 'closed') {
      return;
    }

    // Handle unassigned tickets
    const finalAssigneeId = assigneeId || 'unassigned';
    const finalAssigneeName = assigneeName || 'Unassigned';

    console.log(`Processing ticket ${ticketId}: ${finalAssigneeName} (${newStatus})`);

    // Get the previous status for this ticket
    const previousEvent = await databaseService.query(`
      SELECT status, assignee_id, assignee_name, closed_at_utc
      FROM ticket_status_events 
      WHERE ticket_id = $1 
        AND id != (SELECT id FROM ticket_status_events WHERE ticket_id = $1 ORDER BY occurred_at_utc DESC LIMIT 1)
      ORDER BY occurred_at_utc DESC 
      LIMIT 1
    `, [ticketId]);

    const previousStatus = previousEvent.rows[0]?.status;
    const previousAssigneeId = previousEvent.rows[0]?.assignee_id || 'unassigned';
    const previousAssigneeName = previousEvent.rows[0]?.assignee_name || 'Unassigned';
    const previousClosedAtUtc = previousEvent.rows[0]?.closed_at_utc;

    // Determine the date for aggregation (use closed_at_utc if available, otherwise occurred_at_utc)
    const aggregationDate = closedAtUtc || new Date();
    const bucketDate = dayjs(aggregationDate).tz('Europe/Vienna').format('YYYY-MM-DD');

    // If previous status was also closed, decrement the old count
    if (previousStatus === 'closed') {
      const previousBucketDate = previousClosedAtUtc ? 
        dayjs(previousClosedAtUtc).tz('Europe/Vienna').format('YYYY-MM-DD') :
        dayjs().tz('Europe/Vienna').format('YYYY-MM-DD');

      await databaseService.query(`
        UPDATE closed_by_assignee 
        SET count = GREATEST(0, count - 1)
        WHERE bucket_start = $1::timestamptz 
          AND bucket = 'day' 
          AND assignee_id = $2
      `, [
        dayjs(previousBucketDate).startOf('day').utc().toISOString(),
        previousAssigneeId
      ]);
    }

    // Increment the new count (only for closed tickets)
    if (newStatus === 'closed') {
      await databaseService.query(`
        INSERT INTO closed_by_assignee (bucket_start, bucket, assignee_id, assignee_name, count)
        VALUES ($1, $2, $3, $4, 1)
        ON CONFLICT (bucket_start, bucket, assignee_id)
        DO UPDATE SET 
          assignee_name = EXCLUDED.assignee_name,
          count = closed_by_assignee.count + 1
      `, [
        dayjs(bucketDate).startOf('day').utc().toISOString(),
        'day',
        finalAssigneeId,
        finalAssigneeName
      ]);
    }

    // Update assignees table
    await databaseService.query(`
      INSERT INTO assignees (assignee_id, assignee_name, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (assignee_id)
      DO UPDATE SET 
        assignee_name = EXCLUDED.assignee_name,
        updated_at = EXCLUDED.updated_at
    `, [finalAssigneeId, finalAssigneeName, new Date().toISOString()]);

    console.log(`✅ Updated assignee counts for ticket ${ticketId}: ${finalAssigneeName} (${newStatus})`);

  } catch (error) {
    console.error(`Error updating assignee counts for ticket ${ticketId}:`, error);
    // Don't throw - this shouldn't break the webhook processing
  }
}

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
