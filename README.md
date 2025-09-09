# HTS Dashboard - Pylon Integration

A modern, real-time dashboard for Hotel Technology Support teams, providing unified visibility into support tickets through direct Pylon API integration with comprehensive historical analysis capabilities.

## Why

We recently migrated our ticketing system to **Pylon**. In **Odoo**, we previously relied on a custom operations dashboard. This project rebuilds that dashboard from scratch—modernized and directly integrated with Pylon—to restore the same core functionality while adding extended capabilities for better visibility, faster decisions, and a smoother daily workflow.

## Features

### 🎯 Global KPIs
- **Created Today** - All tickets created on the current day
- **Total Open** - All tickets with status ≠ Closed/Cancelled
- **On Hold** - All tickets currently in status On Hold
- **Open >24h** - All tickets with status ≠ Closed/Cancelled and created > 24 hours ago
- **Closed Today** - All tickets closed on the current day
- **Avg Resolution Time** - Average resolution time for closed tickets (last 30 days)

### 📊 Ticket Assignment Table
- Per-agent breakdown of ticket counts by status
- Unassigned tickets row
- Direct links to Pylon filtered views
- Closed Today column for each agent
- **User Status Indicators** - Green/gray dots showing agent availability (Online/Out of Office)
- **Interactive Tooltips** - Hover over agents to see their current status

### 📈 Analytics & Insights
- **Daily Flow Chart** - Created vs Closed vs Cancelled tickets (last 14 days)
- **Hourly Heatmap** - Ticket creation patterns by day and hour
- **Ticket Assignment** - Agent workload distribution

### 📊 History Dashboard
- **Modular Widget System** - Easy to add new historical analysis widgets
- **Closed by Assignee Widget** - Stacked bar chart showing ticket closure distribution across team members over time
- **Ticket Lifecycle Widget** - Average time spent in each ticket status with business/wall hours tracking
- **Interactive Date Controls** - Preset ranges (Current Week, Current Month, Last Week, Last Month) and custom date picker
- **Timezone Support** - All dates handled in Europe/Vienna timezone
- **Real-time Data** - Cached responses with background refresh
- **Responsive Design** - Works on desktop and mobile

### ℹ️ Interactive Information
- **Info Icons** - Click the "i" icon on any component for detailed explanations
- **Component Descriptions** - Learn about functionality and features of each dashboard element
- **Tooltips** - Hover over elements for quick information and status updates

## Tech Stack

- **Backend**: Node.js, Express, PostgreSQL, Redis (optional), Axios, Day.js
- **Frontend**: React, TypeScript, TailwindCSS, Recharts, Framer Motion, React Router
- **Authentication**: CAS (Central Authentication Service) via reverse proxy
- **Deployment**: Docker, Docker Compose, Nginx, GitHub Actions
- **Database**: PostgreSQL for historical data aggregation
- **Caching**: Redis for performance optimization

## Development Transparency (AI Ready)

This Proof of Concept was built in approximately **5–6 hours** with support from **Cursor IDE** and **ChatGPT (GPT-5)**.  
The value lies in the architecture and integration work (Pylon API, Docker, Redis caching, Cloudflare Access) and in turning AI-generated scaffolding into a reliable, production-ready dashboard.  
AI was used as a productivity tool—prompts, iteration, and validation were driven by engineering judgement to ensure correctness, security, and maintainability.

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 12+
- Pylon API access
- Redis (optional, for caching)

### Development Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd hts-pylon-DB
   npm run install:all
   ```

2. **Configure environment:**
   ```bash
   cp server/env.example server/.env
   # Edit server/.env with your Pylon API credentials and database settings
   ```

3. **Start development servers:**
   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

### Production Deployment

**Using GitHub Actions (Recommended):**
1. Go to Actions tab in GitHub
2. Select "Build Docker Image" workflow
3. Click "Run workflow"
4. Pull and run the image:
```bash
docker pull ghcr.io/mg-seekda/hts-pylon-db:latest
docker run -d --name hts-dashboard -p 3000:3001 \
  -e PYLON_API_URL=your_api_url \
  -e PYLON_API_TOKEN=your_api_token \
  -e REDIS_URL=redis://your_redis_url \
  ghcr.io/mg-seekda/hts-pylon-db:latest
```

**Manual Deploy:**
```bash
# 1. Configure environment
cp env.production.example .env.production
# Edit .env.production with your settings

# 2. Deploy
docker-compose up -d
```

**📖 For detailed deployment instructions, see [DEPLOYMENT.md](docs/DEPLOYMENT.md)**

## GitHub Actions

The project includes automated Docker builds via GitHub Actions:

- **Manual Build**: Go to Actions tab → "Build Docker Image" → Run workflow
- **Image Location**: `ghcr.io/mg-seekda/hts-pylon-db:latest`
- **Documentation**: See [GITHUB_ACTIONS.md](docs/GITHUB_ACTIONS.md)

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PYLON_API_URL` | Pylon API base URL | Required |
| `PYLON_API_TOKEN` | Pylon API authentication token | Required |
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment mode | development |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379 |
| `REDIS_ENABLED` | Enable Redis caching | false |
| `CAS_LOGIN_URL` | CAS login URL | https://login.seekda.com/login |
| `CAS_VALIDATE_URL` | CAS validation URL | https://login.seekda.com/serviceValidate |
| `DEV_BYPASS_AUTH` | Bypass authentication in development | false |
| `DEV_USER` | Development user email | dev@example.com |
| `CORS_ORIGIN` | CORS allowed origin | http://localhost:3000 |
| `POSTGRES_USER` | PostgreSQL username | Required |
| `POSTGRES_PASSWORD` | PostgreSQL password | Required |
| `POSTGRES_DB` | PostgreSQL database name | Required |
| `POSTGRES_HOST` | PostgreSQL host | localhost |
| `POSTGRES_PORT` | PostgreSQL port | 5432 |

### Authentication

The dashboard supports two authentication modes:

1. **Production**: CAS authentication via reverse proxy
   - Nginx handles CAS authentication
   - Injects `X-Remote-User` header
   - Backend trusts the header

2. **Development**: Bypass mode
   - Set `DEV_BYPASS_AUTH=true`
   - Uses `DEV_USER` for authentication
   - No external authentication required

## API Endpoints

### Tickets
- `GET /api/tickets/kpis` - Global KPIs
- `GET /api/tickets/assignment-table` - Assignment table data
- `GET /api/tickets/by-assignee/:assigneeId/:status` - Tickets by assignee and status
- `GET /api/tickets/oldest` - Oldest open tickets
- `GET /api/tickets/top-accounts` - Top accounts with open tickets

### Analytics
- `GET /api/analytics/dashboard` - Complete analytics data
- `GET /api/analytics/daily-flow` - Daily flow data (created/closed/cancelled)
- `GET /api/analytics/hourly-heatmap` - Hourly ticket creation patterns

### History
- `GET /api/history/closed-by-assignee` - Closed tickets by assignee over time
- `GET /api/ticket-lifecycle/data` - Ticket lifecycle analysis data
- `GET /api/ticket-lifecycle/statuses` - Available ticket statuses
- `POST /api/history/backfill` - Import historical data from Pylon
- `POST /api/history/ingest-daily` - Trigger daily data ingestion
- `POST /api/ticket-lifecycle/clear-cache` - Clear ticket lifecycle cache

### Users
- `GET /api/users` - All users
- `GET /api/users/:userId` - User by ID

## Development

### Project Structure
```
hts-pylon-DB/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── history/    # History dashboard widgets
│   │   │   │   └── widgets/ # Individual widget components
│   │   │   └── ...
│   │   ├── context/        # React context
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── utils/          # Utility functions
│   │   └── ...
│   └── package.json
├── server/                 # Node.js backend
│   ├── routes/            # API routes
│   │   ├── history.js     # History dashboard endpoints
│   │   ├── tickets.js     # Main dashboard endpoints
│   │   └── ...
│   ├── services/          # Business logic
│   │   ├── dailyIngestion.js      # Daily data collection
│   │   ├── ticketLifecycleAggregation.js # Ticket lifecycle analysis
│   │   ├── assigneeSyncService.js # Assignee data synchronization
│   │   └── ...
│   ├── middleware/        # Express middleware
│   ├── utils/            # Server utilities
│   └── package.json
├── nginx/                 # Nginx configuration
├── scripts/               # Deployment and utility scripts
├── docs/                  # Documentation
│   ├── HISTORY_FEATURE.md # History dashboard documentation
│   ├── DEPLOYMENT.md      # Deployment instructions
│   └── ...
├── .github/workflows/     # GitHub Actions
├── docker-compose.yml     # Docker Compose setup
└── Dockerfile            # Multi-stage Docker build
```

### Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build frontend for production
- `npm start` - Start production server
- `npm run install:all` - Install all dependencies

### Local Testing Scripts

- `./scripts/test-container.sh` - Test Docker container locally
- `./scripts/test-container.ps1` - Test Docker container locally (Windows)
- `./scripts/build.sh` - Build Docker image locally

### Adding New Features

1. **Backend**: Add new routes in `server/routes/`
2. **Frontend**: Add new components in `client/src/components/`
3. **API Integration**: Update `client/src/services/apiService.ts`
4. **State Management**: Update `client/src/context/DataContext.tsx`
5. **History Widgets**: Add new widgets in `client/src/components/history/widgets/`

## Database Schema

### Historical Data Tables

```sql
-- Closed tickets by assignee aggregation
CREATE TABLE closed_by_assignee (
  bucket_start timestamptz NOT NULL,
  bucket text NOT NULL CHECK (bucket IN ('day','week')),
  assignee_id text NOT NULL,
  assignee_name text NOT NULL,
  count integer NOT NULL,
  PRIMARY KEY (bucket_start, bucket, assignee_id)
);

-- Ticket lifecycle aggregation
CREATE TABLE ticket_status_agg_daily (
  date date NOT NULL,
  status text NOT NULL,
  avg_duration_business_seconds integer NOT NULL,
  avg_duration_wall_seconds integer NOT NULL,
  count_segments integer NOT NULL,
  PRIMARY KEY (date, status)
);

CREATE TABLE ticket_status_agg_weekly (
  bucket_iso_year integer NOT NULL,
  bucket_iso_week integer NOT NULL,
  status text NOT NULL,
  avg_duration_business_seconds integer NOT NULL,
  avg_duration_wall_seconds integer NOT NULL,
  count_segments integer NOT NULL,
  PRIMARY KEY (bucket_iso_year, bucket_iso_week, status)
);

-- Assignee information cache
CREATE TABLE assignees (
  assignee_id text PRIMARY KEY,
  assignee_name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## Monitoring & Logs

- **Health Check**: `GET /api/health`
- **Redis**: Optional caching for improved performance (60s TTL)
- **GitHub Actions**: Automated Docker builds and deployments
- **Daily Ingestion**: Automated data collection at 1 AM Vienna time
- **Assignee Sync**: Periodic synchronization of assignee data

## Security

### 🔒 Customer Data Protection

**✅ No Customer PII Handling**
- **No customer names, emails, or personal information** are fetched, cached, or logged
- **Only internal agent data** (assignees) is processed
- **Aggregated data only** (counts, statistics, analytics)
- **Ticket IDs only** (no customer content or details)

**Data We Handle:**
- **Internal:** Agent emails, names, assignment counts
- **Technical:** Ticket IDs, states, timestamps
- **Analytics:** Aggregated counts, date ranges, statistics
- **No Customer Data:** Names, emails, personal information, ticket content

**Caching & Storage:**
- **Redis Cache:** Only stores aggregated data (counts, KPIs, analytics)
- **Cache Keys:** `tickets:kpis`, `analytics:daily-flow`, `analytics:hourly-heatmap`, `users:all` (internal agents only)
- **TTL:** 60 seconds (very short retention)
- **No Raw Data:** Individual ticket details with customer info are never cached

**Logging:**
- **Minimal Logging:** Reduced console output for production
- **No Customer Data in Logs:** No customer names, emails, or personal data logged
- **Technical Data Only:** Ticket IDs, counts, and system information

### 🛡️ General Security

- HTTPS enforced in production
- CAS authentication integration
- Rate limiting on API endpoints
- Security headers via Nginx
- Input validation and sanitization
- CORS configuration

## History Dashboard

### Features

The History Dashboard provides comprehensive historical analysis with a modular widget system:

#### Closed by Assignee Widget
- **Stacked Bar Chart**: Shows ticket closure distribution across team members
- **Interactive Legend**: Click to show/hide specific assignees
- **Time Buckets**: Daily or weekly aggregation
- **Date Presets**: Current Week, Current Month, Last Week, Last Month
- **Summary Statistics**: Total tickets, assignees, period, averages
- **Color-coded Assignees**: Easy visual identification

#### Ticket Lifecycle Widget
- **Status Duration Analysis**: Average time spent in each ticket status
- **Business vs Wall Hours**: Toggle between business hours (Mon-Fri 9-17) and 24/7 tracking
- **Status Filtering**: Toggle individual statuses on/off
- **Interactive Tooltips**: Detailed time breakdowns with color-coded statuses
- **Day/Week Views**: Switch between daily and weekly aggregation

### Usage

1. **Navigation**: Click "History" button in the main dashboard header
2. **Date Selection**: Use preset dropdown or custom date picker
3. **View Toggle**: Switch between daily and weekly views
4. **Interactive Elements**: Click legend items to show/hide data series
5. **Info Icons**: Click "i" icons for detailed explanations

### Data Management

1. **Initial Setup**: Run backfill to import historical data
2. **Daily Updates**: Automatic ingestion runs at 1 AM Vienna time
3. **Manual Refresh**: Use refresh buttons or API endpoints
4. **Cache Management**: Automatic cache invalidation and refresh

## Limitations & Next Steps

### Current Limitations
- Focused on **ticket-level analytics only** (no ticket details or customer data surfaced)
- **PoC** currently runs in a homelab environment (secured via **Cloudflare Tunnel & Access**)
- **Historical data** requires initial backfill and daily ingestion

### Next Steps
- Evaluate a deployment within **company-controlled infrastructure**
- Expand with **Task integrations** as soon as the relevant Pylon API becomes available
- Iterate on dashboards based on **team feedback** and usability testing
- Implement **Team Lead reporting visuals** (escalation-ready views for TL → Management)
- Add more history widgets (SLA breaches, resolution times, account performance)

## Troubleshooting

### Common Issues

1. **API Connection Errors**
   - Verify `PYLON_API_URL` and `PYLON_API_TOKEN`
   - Check network connectivity to Pylon instance

2. **Authentication Issues**
   - Verify CAS URLs in production
   - Enable `DEV_BYPASS_AUTH` for development

3. **Performance Issues**
   - Enable Redis caching
   - Check API response times
   - Monitor memory usage

4. **History Dashboard Issues**
   - Ensure PostgreSQL is running and accessible
   - Check if daily ingestion is running
   - Verify database schema is up to date
   - Run backfill if historical data is missing

### Debug Mode

Enable debug logging by setting:
```bash
NODE_ENV=development
```

### Database Issues

1. **Missing Historical Data**
   ```bash
   # Run backfill for historical data
   curl -X POST http://localhost:3001/api/history/backfill \
     -H "Content-Type: application/json" \
     -d '{"from": "2024-01-01", "to": "2024-12-31"}'
   ```

2. **Daily Ingestion Not Running**
   ```bash
   # Manually trigger daily ingestion
   curl -X POST http://localhost:3001/api/history/ingest-daily
   ```

3. **Clear Caches**
   ```bash
   # Clear ticket lifecycle cache
   curl -X POST http://localhost:3001/api/ticket-lifecycle/clear-cache
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details