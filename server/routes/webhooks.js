const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const databaseService = require('../services/database');
const BusinessHoursCalculator = require('../utils/businessHours');

// Initialize business hours calculator
const businessHours = new BusinessHoursCalculator();

// Webhook signature verification middleware
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-pylon-signature'];
  const timestamp = req.headers['x-pylon-timestamp'];
  const webhookSecret = process.env.PYLON_WEBHOOK_SECRET;

  if (!signature || !timestamp || !webhookSecret) {
    return res.status(401).json({ error: 'Missing webhook authentication' });
  }

  // Check timestamp to prevent replay attacks (5 minute window)
  const now = Math.floor(Date.now() / 1000);
  const webhookTime = parseInt(timestamp);
  
  if (Math.abs(now - webhookTime) > 300) { // 5 minutes
    return res.status(401).json({ error: 'Request timestamp too old' });
  }

  // Verify signature
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(timestamp + payload)
    .digest('hex');

  if (signature !== expectedSignature) {
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
    const { type, ticket_id, status } = req.body;

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

    // Store the event
    await databaseService.query(`
      INSERT INTO ticket_status_events (event_id, ticket_id, status, occurred_at_utc, raw)
      VALUES ($1, $2, $3, $4, $5)
    `, [eventId, ticket_id, status, occurredAt.toISOString(), JSON.stringify(req.body)]);

    // Enqueue segment processing (async)
    processTicketSegments(ticket_id).catch(error => {
      console.error(`Error processing segments for ticket ${ticket_id}:`, error);
    });

    res.status(200).json({ message: 'Event processed successfully' });

  } catch (error) {
    console.error('Webhook processing error:', error);
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

    console.log(`✅ Processed segments for ticket ${ticketId}`);

  } catch (error) {
    console.error(`Error processing segments for ticket ${ticketId}:`, error);
    throw error;
  }
}

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
