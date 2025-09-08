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

  console.log('🔐 Webhook authentication attempt:', {
    hasSignature: !!signature,
    hasTimestamp: !!timestamp,
    hasSecret: !!webhookSecret,
    timestamp: timestamp,
    signature: signature ? `${signature.substring(0, 8)}...` : 'none'
  });

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

  // Debug: Let's see what Pylon is actually sending
  const payload = JSON.stringify(req.body);
  console.log('🔍 Debug signature verification:', {
    payload: payload,
    payloadLength: payload.length,
    webhookSecret: webhookSecret,
    receivedSignature: signature
  });

  // Try different signature formats that Pylon might use
  const formats = [
    { name: 'payload-only', data: payload },
    { name: 'payload-raw', data: req.body },
    { name: 'payload-stringified-raw', data: JSON.stringify(req.body, null, 0) },
    { name: 'payload-with-timestamp', data: `${Date.now()}${payload}` },
    { name: 'payload-with-content-type', data: `application/json${payload}` }
  ];

  let validSignature = null;
  for (const format of formats) {
    const testSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(format.data)
      .digest('hex');
    
    console.log(`🧪 Testing ${format.name}:`, {
      data: format.data.substring(0, 100) + '...',
      signature: `${testSignature.substring(0, 8)}...`,
      matches: testSignature === signature
    });
    
    if (testSignature === signature) {
      validSignature = format.name;
      break;
    }
  }

  if (!validSignature) {
    console.log('❌ No matching signature format found');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  console.log(`✅ Signature verified using format: ${validSignature}`);

  console.log('✅ Webhook authenticated successfully');
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
    console.log('📥 Webhook received:', {
      type: req.body.type,
      ticket_id: req.body.ticket_id,
      status: req.body.status,
      timestamp: new Date().toISOString()
    });

    const { type, ticket_id, status } = req.body;

    // Validate required fields
    if (!type || !ticket_id || !status) {
      console.log('❌ Missing required fields:', { type, ticket_id, status });
      return res.status(400).json({ 
        error: 'Missing required fields: type, ticket_id, status' 
      });
    }

    console.log('✅ Webhook validation passed');

    // Only process status change and creation events
    if (!['ticket.status_changed', 'ticket.created'].includes(type)) {
      console.log('ℹ️ Event type not relevant for lifecycle tracking:', type);
      return res.status(200).json({ message: 'Event type not relevant for lifecycle tracking' });
    }

    // Generate event_id on our side
    const eventId = `${ticket_id}-${status}-${Date.now()}`;
    
    // Use current server time as occurred_at
    const occurredAt = new Date();

    console.log('🆔 Generated event details:', { eventId, occurredAt: occurredAt.toISOString() });

    // Check for duplicate events (using our generated event_id)
    const existingEvent = await databaseService.query(
      'SELECT id FROM ticket_status_events WHERE event_id = $1',
      [eventId]
    );

    if (existingEvent.rows.length > 0) {
      console.log('⚠️ Event already processed:', eventId);
      return res.status(200).json({ message: 'Event already processed' });
    }

    // Store the event
    await databaseService.query(`
      INSERT INTO ticket_status_events (event_id, ticket_id, status, occurred_at_utc, raw)
      VALUES ($1, $2, $3, $4, $5)
    `, [eventId, ticket_id, status, occurredAt.toISOString(), JSON.stringify(req.body)]);

    console.log('💾 Event stored in database:', eventId);

    // Enqueue segment processing (async)
    processTicketSegments(ticket_id).catch(error => {
      console.error(`Error processing segments for ticket ${ticket_id}:`, error);
    });

    console.log('✅ Webhook processed successfully');
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

    console.log(`✅ Processed segments for ticket ${ticketId}`);

  } catch (error) {
    console.error(`Error processing segments for ticket ${ticketId}:`, error);
    throw error;
  }
}

// Health check endpoint
router.get('/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
