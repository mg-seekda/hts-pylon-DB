# Ticket Lifecycle Feature

## Overview

The Ticket Lifecycle feature provides historical analysis of ticket status transitions, showing the average time spent in each status. It supports both Wall Hours (24/7) and Business Hours (Monday-Friday 9-17 Europe/Vienna timezone) calculations.

## Features

### 🎯 Core Functionality
- **Status Transition Tracking**: Captures ticket status changes via Pylon webhooks
- **Dual Time Calculation**: Wall Hours vs Business Hours with DST support
- **Flexible Grouping**: Daily and weekly aggregations
- **Interactive Visualization**: Stacked bar chart with status filtering
- **Real-time Data**: Webhook-driven event processing
- **Caching**: Redis-based performance optimization

### 📊 Ticket Lifecycle Widget
- **Stacked Bar Chart**: Shows average duration by status over time
- **Time Mode Toggle**: Switch between Wall Hours and Business Hours
- **Status Filtering**: Show/hide specific statuses
- **Interactive Legend**: Click to toggle status visibility
- **Summary Stats**: Total samples, time period, grouping info
- **Loading States**: Proper loading, error, and empty states

## Technical Implementation

### Backend Architecture

#### Database Schema
```sql
-- Raw webhook events (append-only)
CREATE TABLE ticket_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  ticket_id text NOT NULL,
  status text NOT NULL,
  occurred_at_utc timestamptz NOT NULL,
  received_at_utc timestamptz NOT NULL DEFAULT now(),
  raw jsonb NOT NULL
);

-- Status segments (derived from events)
CREATE TABLE ticket_status_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL,
  status text NOT NULL,
  entered_at_utc timestamptz NOT NULL,
  left_at_utc timestamptz, -- NULL if currently active
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Daily aggregations
CREATE TABLE ticket_status_agg_daily (
  bucket_date date NOT NULL,
  status text NOT NULL,
  avg_duration_wall_seconds bigint NOT NULL,
  avg_duration_business_seconds bigint NOT NULL,
  count_segments integer NOT NULL,
  PRIMARY KEY (bucket_date, status)
);

-- Weekly aggregations
CREATE TABLE ticket_status_agg_weekly (
  bucket_iso_year integer NOT NULL,
  bucket_iso_week integer NOT NULL,
  status text NOT NULL,
  avg_duration_wall_seconds bigint NOT NULL,
  avg_duration_business_seconds bigint NOT NULL,
  count_segments integer NOT NULL,
  PRIMARY KEY (bucket_iso_year, bucket_iso_week, status)
);
```

#### Webhook Processing
- **Endpoint**: `POST /webhooks/pylon/tickets`
- **Authentication**: HMAC-SHA256 signature verification
- **Replay Protection**: 5-minute timestamp window
- **Idempotency**: Deduplication by `event_id`
- **Async Processing**: Queue-based segment building

#### Business Hours Calculation
- **Timezone**: Europe/Vienna with DST support
- **Business Window**: Monday-Friday 09:00-17:00
- **Weekend Exclusion**: Complete exclusion of weekends
- **Multi-day Segments**: Proper handling of segments spanning multiple days

### Frontend Implementation

#### Widget Architecture
- **Modular Design**: Pluggable widget system
- **Shared Controls**: Date range and grouping controls
- **Type Safety**: Full TypeScript implementation
- **Responsive**: Mobile and desktop optimized

#### Data Flow
1. User selects date range and grouping
2. Widget fetches data from API with caching
3. Data transformed for chart visualization
4. Interactive controls update display

## API Endpoints

### GET /api/ticket-lifecycle/data
Returns aggregated ticket lifecycle data.

**Parameters:**
- `from` (required): Start date (YYYY-MM-DD)
- `to` (required): End date (YYYY-MM-DD)
- `grouping` (optional): 'day' or 'week' (default: 'day')
- `hoursMode` (optional): 'wall' or 'business' (default: 'business')
- `status` (optional): Comma-separated status filter

**Response:**
```json
{
  "data": [
    {
      "date": "2024-01-15",
      "status": "open",
      "avgDurationSeconds": 3600,
      "avgDurationFormatted": "01:00",
      "countSegments": 5
    }
  ],
  "grouping": "day",
  "hoursMode": "business",
  "from": "2024-01-15",
  "to": "2024-01-21",
  "totalSamples": 25
}
```

### GET /api/ticket-lifecycle/statuses
Returns available ticket statuses.

**Response:**
```json
{
  "statuses": ["new", "open", "in_progress", "closed", "cancelled"]
}
```

### POST /api/ticket-lifecycle/aggregate
Triggers aggregation for a date range.

**Body:**
```json
{
  "from": "2024-01-01",
  "to": "2024-01-31",
  "grouping": "day"
}
```

### GET /api/ticket-lifecycle/stats
Returns system statistics.

**Response:**
```json
{
  "totalEvents": 1500,
  "totalSegments": 1200,
  "openSegments": 50,
  "dailyAggregations": 365,
  "weeklyAggregations": 52,
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

## Webhook Configuration

### Pylon Webhook Setup
1. **URL**: `https://your-domain.com/webhooks/pylon/tickets`
2. **Events**: `ticket.status_changed`, `ticket.created`
3. **Authentication**: Set `PYLON_WEBHOOK_SECRET` environment variable
4. **Retry Policy**: Configure Pylon to retry failed webhooks

### Webhook Payload
```json
{
  "type": "ticket.created" | "ticket.status_changed",
  "ticket_id": "ticket-123",
  "status": "open|pending|in_progress|closed|..."
}
```

**Note**: `event_id` and `occurred_at` are generated server-side using:
- `event_id`: `${ticket_id}-${status}-${timestamp}`
- `occurred_at`: Current server timestamp

## Setup Instructions

### 1. Database Setup
```bash
# Run the setup script
node scripts/setup-ticket-lifecycle.js
```

### 2. Environment Variables
```bash
# Add to server/.env
PYLON_WEBHOOK_SECRET=your-webhook-secret-here
```

### 3. Pylon Configuration
1. Register webhook endpoint in Pylon
2. Configure events: `ticket.status_changed`, `ticket.created`
3. Set retry policy for failed deliveries

### 4. Start Services
```bash
# Start server
cd server && npm run dev

# Start client
cd client && npm start
```

## Usage

### Navigation
1. Click "History" in the main dashboard
2. Use date controls to select time range
3. Toggle between daily and weekly views
4. Switch between Wall Hours and Business Hours
5. Filter by specific statuses

### Data Management
1. **Automatic Processing**: Webhooks process events in real-time
2. **Aggregation**: Run aggregation jobs for historical data
3. **Cache Management**: Redis handles performance optimization

## Performance

### Caching Strategy
- **Recent Data**: 1-minute TTL for current day
- **Historical Data**: 1-hour TTL for past data
- **Status List**: 1-hour TTL for available statuses
- **Statistics**: 5-minute TTL for system stats

### Database Optimization
- **Indexes**: Optimized for common query patterns
- **Partitioning**: Consider partitioning by date for large datasets
- **Archiving**: Implement data archiving for old events

## Monitoring

### Key Metrics
- **Webhook Processing**: Success/failure rates
- **Segment Building**: Processing time and queue length
- **Aggregation Jobs**: Completion time and data quality
- **Cache Performance**: Hit rates and response times

### Alerts
- **Stale Data**: Alert if aggregations are >26h old
- **Webhook Failures**: Alert on high failure rates
- **Queue Backlog**: Alert if processing queue grows too large

## Troubleshooting

### Common Issues

#### No Data Showing
1. Check webhook configuration
2. Verify PYLON_WEBHOOK_SECRET is set
3. Check webhook endpoint accessibility
4. Run aggregation jobs manually

#### Incorrect Business Hours
1. Verify timezone configuration
2. Check DST handling
3. Validate business hours calculation

#### Performance Issues
1. Check Redis connection
2. Verify database indexes
3. Monitor query performance
4. Consider data archiving

### Debug Commands
```bash
# Check webhook endpoint
curl -X POST https://your-domain.com/webhooks/pylon/tickets \
  -H "Content-Type: application/json" \
  -H "X-Pylon-Signature: your-signature" \
  -H "X-Pylon-Timestamp: $(date +%s)" \
  -d '{"type":"ticket.created","ticket_id":"test","status":"new"}'

# Run aggregation manually
curl -X POST https://your-domain.com/api/ticket-lifecycle/aggregate \
  -H "Content-Type: application/json" \
  -d '{"from":"2024-01-01","to":"2024-01-31","grouping":"day"}'
```

## Future Enhancements

### Planned Features
- **Per-Assignee Breakdown**: Lifecycle analysis by assignee
- **SLA Tracking**: SLA breach detection and visualization
- **Custom Status Mapping**: Map Pylon statuses to internal categories
- **Export Functionality**: Export data to CSV/Excel
- **Real-time Updates**: WebSocket-based live updates

### Scalability Considerations
- **Horizontal Scaling**: Multiple webhook processors
- **Database Sharding**: Partition by date or ticket ID
- **Caching Layers**: Multi-level caching strategy
- **Event Streaming**: Kafka/RabbitMQ for high-volume processing

## Security

### Webhook Security
- **HMAC Verification**: Cryptographic signature validation
- **Timestamp Validation**: Replay attack prevention
- **Rate Limiting**: Prevent abuse and DoS attacks
- **IP Whitelisting**: Restrict webhook sources

### Data Protection
- **Encryption**: Encrypt sensitive data at rest
- **Access Control**: Role-based API access
- **Audit Logging**: Track all data access and modifications
- **Data Retention**: Configurable data retention policies
