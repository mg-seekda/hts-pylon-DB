# Closed by Assignee Data Architecture

## Overview
The `closed_by_assignee` table is now controlled by a **single source of truth** to ensure data consistency and prevent corruption.

## Single Source of Truth
**Only `AssigneeSyncService`** is allowed to write to the `closed_by_assignee` table.

## Disabled Services
The following services have been **completely disabled** from writing to `closed_by_assignee`:

### 1. Webhooks (`server/routes/webhooks.js`)
- ❌ **DISABLED**: `updateAssigneeCounts()` function
- ✅ **ENABLED**: Ticket lifecycle segments only
- **Reason**: Webhooks are unreliable and caused data corruption

### 2. Daily Ingestion (`server/services/dailyIngestion.js`)
- ❌ **DISABLED**: Assignee counting logic (lines 72-113)
- ✅ **ENABLED**: Ticket lifecycle aggregations only
- **Reason**: Daily ingestion was overwriting webhook data

### 3. Backfill Endpoint (`server/routes/history.js`)
- ❌ **DISABLED**: Recent dates (last 7 days)
- ✅ **ENABLED**: Historical data only (older than 7 days)
- **Reason**: Backfill was overwriting real-time data

## Active Service
### AssigneeSyncService (`server/services/assigneeSyncService.js`)
- ✅ **ONLY SERVICE** that writes to `closed_by_assignee`
- 🔄 **Runs every 5 minutes** automatically
- 📊 **Uses Pylon API** as source of truth
- 🔍 **Smart comparison** - only updates when data changes
- 📅 **Syncs today + last 30 days** to catch missed updates

## Data Flow
```
Pylon API (Source of Truth)
    ↓
AssigneeSyncService (Every 5 minutes)
    ↓
closed_by_assignee table
    ↓
Closed by Assignee Widget
```

## API Efficiency
- **1 API call** for users (assignee mapping)
- **7 API calls** for closed tickets (30 days in 5-day batches)
- **Total: 8 API calls every 5 minutes** (optimized from 32 calls)
- **Batch size: 5 days** to stay well under the 1000 ticket limit

## API Endpoints
- `POST /api/history/sync-assignees` - Manual sync (today + last 30 days)
- `POST /api/history/sync-assignees-range` - Sync specific date range
- `GET /api/history/sync-status` - Check sync status

## Benefits
1. **Data Consistency** - Dashboard and widget use same source
2. **No Corruption** - Single writer prevents race conditions
3. **Real-time Updates** - Syncs every 5 minutes
4. **Reliability** - Uses same API calls as dashboard
5. **Accuracy** - Matches dashboard exactly

## Monitoring
Check sync status:
```bash
curl http://192.168.178.42:4169/api/history/sync-status
```

Manual sync:
```bash
curl -X POST http://192.168.178.42:4169/api/history/sync-assignees
```

## Important Notes
- **DO NOT** re-enable webhook assignee counting
- **DO NOT** re-enable daily ingestion assignee counting
- **DO NOT** modify backfill to write recent dates
- **ONLY** use AssigneeSyncService for closed_by_assignee data
