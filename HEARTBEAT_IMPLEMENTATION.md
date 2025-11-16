# Heartbeat-Based Auto Punch-Out System — Implementation Guide

## Overview

This implementation replaces the unreliable `navigator.sendBeacon` approach with a **robust heartbeat + server-side detection** model:

1. **Frontend** sends heartbeats every 10 seconds (while punched in)
2. **Backend** stores `lastSeen` timestamps in the `employee_status` table
3. **Worker/Cron** periodically scans for stale heartbeats and auto-punches out
4. **Supabase Realtime** pushes updates back to UI so it stays live

---

## Architecture

```
┌─────────────────────────────────────┐
│  React Dashboard (Client)            │
│  • useHeartbeat hook (10s interval)  │
│  • Realtime subscription             │
└────────────────┬────────────────────┘
                 │ POST /api/heartbeat
                 ▼
┌─────────────────────────────────────┐
│  Next.js API (Backend)               │
│  • POST /api/employee/heartbeat      │
│    → Upsert employee_status.lastSeen │
└─────────────────────────────────────┘
                 │
                 ▼
       ┌─────────────────────────┐
       │  Supabase (PostgreSQL)  │
       │  • employee_status      │
       │  • punches (audit)      │
       └─────────────────────────┘
                 ▲
                 │
┌─────────────────────────────────────┐
│  Worker / Scheduled Cron             │
│  • GET /api/worker/heartbeat-check   │
│    every 15 seconds                  │
│  → Find stale employees              │
│  → Insert AUTO_OUT punch             │ s
│  → Broadcast via Realtime            │
└─────────────────────────────────────┘
```

---

## Files Created / Modified

### 1. Database Schema
**File:** `scripts/011_heartbeat_schema.sql`

Creates:
- `punches` table — immutable audit log (IN, OUT, AUTO_OUT)
- `employee_status` table — current status + last_seen timestamp
- Realtime publication for UI subscriptions
- RLS policies for security

**Action needed:** Run this migration in Supabase SQL editor.

### 2. Heartbeat Endpoint
**File:** `app/api/employee/heartbeat/route.ts`

- Accepts authenticated POST requests with `{ employeeId, sessionId }`
- Validates user matches authenticated token
- Upserts `employee_status.last_seen` with current timestamp
- Returns 200 on success, 401 if unauthorized

**Key constants:**
- Heartbeat interval: **10 seconds** (client-side)
- STALE threshold: **30 seconds** (server-side worker)
- Grace period: 20 seconds before auto-punch-out

### 3. React Hook
**File:** `hooks/use-heartbeat.ts`

```tsx
useHeartbeat({
  employeeId: userId,
  enabled: !loading && !!userId && isPunchedIn,
  interval: 10000,  // 10 seconds
})
```

**Features:**
- Sends heartbeat every N milliseconds
- Uses `navigator.sendBeacon` on tab close (most reliable)
- Fallback to synchronous XHR if sendBeacon unavailable
- Gracefully handles network errors

### 4. Stale Detection Worker
**File:** `lib/workers/stale-heartbeat-worker.ts`

Exports `checkStaleHeartbeats()` function:
- Finds all employees with status = `IN`
- Checks if `now - last_seen > 30_000ms` (stale)
- Idempotency check: avoids duplicate AUTO_OUT writes
- Inserts punch record and updates status
- Logs metadata for debugging

### 5. Cron Endpoint (Serverless-Safe)
**File:** `app/api/worker/heartbeat-check/route.ts`

- GET endpoint with `CRON_SECRET` header validation
- Triggers `checkStaleHeartbeats()` worker
- Safe for external cron services (Vercel, GitHub Actions, etc.)

### 6. Client Integration
**File:** `app/employee/dashboard/client.tsx`

**Changes:**
- Import `useHeartbeat` hook
- Add `userId` state to track authenticated user ID
- Call `useHeartbeat()` when punched in
- Subscribe to `employee_status` realtime changes
- Show toast notification on auto-punch-out event

---

## Setup & Deployment

### Step 1: Run Database Migration

Copy and run `scripts/011_heartbeat_schema.sql` in Supabase SQL Editor:

```sql
-- Execute the migration
psql -U postgres -d your_db -f 011_heartbeat_schema.sql
```

Or paste the SQL directly into Supabase dashboard.

### Step 2: Environment Variables

Add to `.env.local` (or Vercel/deployment secrets):

```env
# For cron endpoint authentication
CRON_SECRET=your-secret-key-here-make-it-long
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Set Up External Cron

**Option A: Vercel Cron (Recommended)**

Create `api/cron.ts`:
```ts
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1 mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/worker/heartbeat-check`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return res.status(response.status).json({ ok: true });
}
```

Then in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "*/15 * * * *"  // Every 15 seconds
    }
  ]
}
```

**Option B: External Scheduler (GitHub Actions, Cloud Scheduler, etc.)**

```bash
curl -X GET https://yourapp.com/api/worker/heartbeat-check \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Schedule this curl to run every **15 seconds** (or 1 minute if scheduler min is 60s).

**Option C: Local Persistent Worker**

If running on a always-on VM/container, add to server startup:

```ts
// In your server.ts or startup script
import { checkStaleHeartbeats } from "@/lib/workers/stale-heartbeat-worker"

setInterval(async () => {
  await checkStaleHeartbeats()
}, 15000)  // Every 15 seconds
```

### Step 4: Deploy

```bash
pnpm build
pnpm start
# or for Vercel:
vercel deploy
```

---

## Testing End-to-End

### Local Setup (with fake cron)

1. **Start dev server:**
   ```bash
   pnpm dev
   ```

2. **Log in and punch in** at `http://localhost:3000/employee/dashboard`

3. **Monitor heartbeats** in browser DevTools:
   - Open Console
   - Should see `[heartbeat] ✓ sent for <userId>` every 10s

4. **Trigger worker manually:**
   ```bash
   curl -X GET http://localhost:3000/api/worker/heartbeat-check \
     -H "Authorization: Bearer test-secret"
   ```

5. **Simulate stale heartbeat:**
   - Stop the client (close tab)
   - Wait 35+ seconds
   - Run worker curl again
   - Check Supabase: `punches` should have a new AUTO_OUT record
   - Check dashboard: if tab is still open, should see toast

6. **Check Supabase directly:**
   ```sql
   SELECT * FROM employee_status WHERE employee_id = 'your-id';
   SELECT * FROM punches WHERE type = 'AUTO_OUT' ORDER BY at DESC LIMIT 5;
   ```

### Production Checklist

- [ ] Database schema migrated to prod Supabase
- [ ] Cron endpoint secured with `CRON_SECRET`
- [ ] Cron trigger running every 15 seconds
- [ ] Heartbeat hook active on dashboard
- [ ] Realtime subscription working (test with Supabase Studio)
- [ ] Logs visible in application monitoring (Sentry, DataDog, etc.)
- [ ] Load test: simulate 100+ concurrent heartbeats
- [ ] Test multi-tab scenario: open 2 tabs, close 1, other should stay IN

---

## Monitoring & Observability

### Logs to Watch

**Client logs:**
```
[heartbeat] ✓ sent for <userId>
[realtime] Subscribed to employee status updates
[realtime] Status update: { new: { status: 'OUT', ... } }
```

**Server logs:**
```
[heartbeat] <userId> @ 2025-11-16T...
[worker] Detected stale heartbeat: <userId> (31245ms)
[worker] Auto-punched out <userId> at 2025-11-16T...
```

### Key Metrics to Track

1. **Heartbeat success rate** — `(successful / total) * 100`
2. **Auto-punch-outs per hour** — should be low in normal conditions
3. **Stale detection latency** — `(actual_out_time - detection_time)`
4. **Realtime subscription lag** — time from punch-out to UI update

### Alerts to Set

- Auto-punch-out spike (> 10 per minute) → check network/server health
- Realtime subscription failures → check Supabase status
- Heartbeat endpoint errors (5xx) → check database write capacity

---

## Tuning & Scaling

### Heartbeat Interval
- **Default:** 10 seconds
- **Mobile/unreliable network:** 15-20 seconds (longer battery drain prevention)
- **Office/stable network:** 5 seconds (faster detection)

### Stale Threshold
- **Default:** 30 seconds (heartbeat 10s + grace period 20s)
- **Formula:** `threshold = (heartbeat_interval * 2) + grace_ms`
- **Example:** heartbeat=15s → threshold=45s

### Worker Frequency
- **Default:** 15 seconds
- **Constraint:** Must be ≤ your scheduler's minimum interval
- **Note:** Running too often wastes CPU; running too infrequently delays detection

### Database Tuning (Supabase)

```sql
-- Index for fast stale lookups
CREATE INDEX idx_employee_status_last_seen 
  ON employee_status(status, last_seen) 
  WHERE status = 'IN';

-- Partition punches table by date for large datasets
ALTER TABLE punches
  PARTITION BY RANGE (date_trunc('month', at));
```

---

## Common Issues & Fixes

### Issue: Auto-punch-out not triggering

**Cause:** Cron job not running or worker has errors

**Fix:**
```bash
# Check recent punches
SELECT * FROM punches ORDER BY at DESC LIMIT 10;

# Check employee_status.last_seen is updating
SELECT employee_id, last_seen, updated_at FROM employee_status LIMIT 5;

# Manually trigger worker
curl -X GET https://yourapp.com/api/worker/heartbeat-check \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Issue: Duplicate AUTO_OUT records

**Cause:** Worker ran twice or idempotency check failed

**Fix:** Idempotency check looks for recent AUTO_OUT in last 5 seconds. If you see dupes:
```sql
DELETE FROM punches 
WHERE type = 'AUTO_OUT' 
  AND employee_id = 'xxx' 
  AND at > now() - interval '1 minute'
  AND id != (
    SELECT id FROM punches 
    WHERE type = 'AUTO_OUT' 
      AND employee_id = 'xxx' 
    ORDER BY at DESC 
    LIMIT 1
  );
```

### Issue: Heartbeat endpoint returning 401

**Cause:** `createServerClient()` not finding auth context

**Fix:** Ensure heartbeat is only called AFTER user is logged in:
```tsx
useHeartbeat({
  enabled: !loading && !!userId,  // Only when user ID is set
  // ...
})
```

### Issue: Realtime subscription not updating UI

**Cause:** RLS policy blocking realtime events or subscription not active

**Fix:**
```sql
-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'employee_status';

-- Test subscription manually in Supabase Studio:
-- Go to SQL Editor → scroll down → "Realtime" tab
```

---

## Security Notes

1. **Heartbeat endpoint:**
   - Validates user JWT matches `employeeId` param
   - Will reject forged or mismatched requests

2. **Cron endpoint:**
   - Protected by `CRON_SECRET` header
   - Never log the secret
   - Rotate quarterly

3. **Database:**
   - `employee_status` RLS ensures users only see their own status
   - Service role (worker) has insert/update on `punches`
   - No direct SELECT from client (read via dashboard only)

4. **Realtime:**
   - Only subscribed employees receive updates
   - Filtered by `employee_id=eq.<user_id>`
   - Supabase handles auth internally

---

## Performance Metrics

**Heartbeat request:**
- Payload size: ~100 bytes
- Response time: <100ms
- Rate: 1 req / 10s per employee

**Worker scan:**
- 1,000 active employees: ~500ms
- Depends on: database indexes, Supabase CPU
- Recommendation: run every 15–30s

**Realtime notification:**
- Latency: <1s from punch-out to UI update
- Reliable if Supabase realtime is healthy

---

## Roadmap / Future Enhancements

1. **Multi-Tab Support:**
   - Track session count per employee
   - Only punch out when all sessions stale

2. **Redis for Presence (at scale):**
   - Replace `employee_status` writes with Redis
   - Worker scans Redis keys instead of DB query
   - Faster + less database load

3. **Slack / Email Notifications:**
   - Notify manager when employee auto-punched
   - Notify employee via email

4. **Mobile App Integration:**
   - Native background task for periodic heartbeat
   - Longer intervals (20–30s) to save battery

5. **Analytics Dashboard:**
   - Auto-punch-out frequency per employee
   - Network reliability stats
   - Early warning for system issues

---

## Questions?

Refer back to the original system design document for detailed explanations of each component.

Keep logs from the worker and heartbeat endpoint to diagnose production issues quickly.
