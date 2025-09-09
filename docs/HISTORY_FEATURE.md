# History Dashboard Feature

## Overview

The History Dashboard provides historical analysis and trends for ticket data with a modular widget system. The first widget implemented is "Closed by Assignee" which shows a stacked bar chart of tickets closed by each assignee over time.

## Features

### 🎯 Core Functionality
- **Modular Widget System**: Easy to add new history widgets
- **Shared Date Controls**: Preset ranges (This Week, Last Week, This Month, Last Month) and custom date picker
- **Timezone Support**: All dates handled in Europe/Vienna timezone
- **Real-time Data**: Cached responses with background refresh
- **Responsive Design**: Works on desktop and mobile

### 📊 Closed by Assignee Widget
- **Stacked Bar Chart**: Shows ticket counts by assignee over time
- **Interactive Legend**: Click to show/hide assignees
- **Time Buckets**: Daily or weekly aggregation
- **Summary Stats**: Total tickets, assignees, period, averages
- **Loading States**: Proper loading, error, and empty states

## Technical Implementation

### Backend
- **PostgreSQL Database**: Stores aggregated historical data
- **Redis Caching**: SWR (Stale-While-Revalidate) pattern
- **Daily Ingestion**: Automated daily data collection
- **Backfill API**: One-time historical data import
- **Timezone Utils**: Europe/Vienna timezone handling

### Frontend
- **React Router**: Navigation between dashboard and history
- **Recharts**: Interactive charts and visualizations
- **Framer Motion**: Smooth animations and transitions
- **TypeScript**: Type safety throughout
- **Tailwind CSS**: Consistent styling

## Database Schema

```sql
-- Aggregated counts per bucket per assignee
CREATE TABLE closed_by_assignee (
  bucket_start timestamptz NOT NULL,
  bucket text NOT NULL CHECK (bucket IN ('day','week')),
  assignee_id text NOT NULL,
  assignee_name text NOT NULL,
  count integer NOT NULL,
  PRIMARY KEY (bucket_start, bucket, assignee_id)
);

-- Assignee information cache
CREATE TABLE assignees (
  assignee_id text PRIMARY KEY,
  assignee_name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## API Endpoints

### GET /api/history/closed-by-assignee
Returns closed ticket data grouped by assignee and time bucket.

**Parameters:**
- `from` (required): Start date (YYYY-MM-DD)
- `to` (required): End date (YYYY-MM-DD)  
- `bucket` (optional): 'day' or 'week' (default: 'day')

**Response:**
```json
{
  "data": [
    {
      "bucket_start": "2024-01-15",
      "assignee_id": "user123",
      "assignee_name": "John Doe",
      "count": 5
    }
  ]
}
```

### POST /api/history/backfill
Imports historical data from Pylon for a date range.

**Body:**
```json
{
  "from": "2024-01-01",
  "to": "2024-01-31"
}
```

### POST /api/history/ingest-daily
Manually triggers daily ingestion for yesterday's data.

## Usage

### Navigation
1. Click the "History" button in the main dashboard header
2. Use the date controls to select your time range
3. Toggle between daily and weekly views
4. Click legend items to show/hide assignees

### Data Management
1. **Initial Setup**: Run backfill to import historical data
2. **Daily Updates**: Automatic ingestion runs at 1 AM Vienna time
3. **Manual Refresh**: Use the ingest-daily endpoint if needed

### Adding New Widgets
1. Create a new widget component in `client/src/components/history/widgets/`
2. Add it to the registry in `client/src/components/history/historyWidgets.ts`
3. Implement the required API endpoints in the backend

## Configuration

### Environment Variables
```bash
# PostgreSQL
POSTGRES_USER=HTS-DB-User
POSTGRES_PASSWORD=DEV1234
POSTGRES_DB=HTS-DB
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Redis (optional)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=false
```

### Pylon API Requirements
- `status = "closed"` filter
- `closed_at` custom field access
- `/issues/search` endpoint access

## Performance

- **Caching**: 300s TTL with background refresh
- **Database**: Indexed queries for fast retrieval
- **Pagination**: Handles large datasets efficiently
- **Rate Limiting**: Built-in delays to avoid API limits

## Future Enhancements

- **Created vs Closed Widget**: Compare ticket creation vs closure trends
- **SLA Breaches Widget**: Track tickets that exceeded SLA
- **Resolution Time Widget**: Average time to close tickets
- **Account Performance Widget**: Tickets by account over time
- **Export Functionality**: Download data as CSV/Excel
- **Advanced Filtering**: Filter by assignee, account, priority, etc.


