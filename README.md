# Employee Management System (EMS)

A modern employee time and leave management platform built with Next.js and Supabase. It provides attendance tracking (punch in/out), leave management, real‑time updates, admin dashboards, and email onboarding.

## Features
- Attendance: punch in/out with audit trail and real‑time updates
- Multiple sessions per day: each punch‑in creates a separate record; punch‑out closes only the active session
- Auto punch‑out: safe server‑side correction on tab close or inactivity
- Leave management: apply, approve, and track balances
- Admin dashboard: live notifications for attendance, leaves, and feedback
- Email onboarding: mobile‑responsive welcome email with credentials

## Tech Stack
- Next.js 16, React 19
- Supabase (Auth, PostgREST, Realtime)
- TypeScript
- Tailwind CSS
- Vitest (tests)

## Getting Started
1. Install dependencies:
   - `npm install`
2. Configure environment variables (create `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server‑side only)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
   - `BRAND_NAME`, `COMPANY_SUPPORT_EMAIL`
   - `APP_BASE_URL`
3. Run the app:
   - `npm run dev`

## Scripts
- `npm run dev` — start development server
- `npm run build` — build for production
- `npm run start` — run production build
- `npm test` — run tests

## Attendance Model
- Punch‑in creates a new row in `attendance` with `login_time`.
- Punch‑out updates only the latest open row (`logout_time IS NULL`) by its `id`.
- Concurrency is handled: if another client closes the row first, the update is rejected.
- Server auto punch‑out route closes the open row and records audit entries.

## Key Paths
- `app/employee/dashboard/client.tsx` — client attendance logic
- `app/api/employee/auto-punch-out/route.ts` — server auto punch‑out
- `app/api/admin/create-employee/route.ts` — admin create user + welcome email

## Testing
- Uses Vitest. Run a single test: `npx vitest run __tests__/attendance-flow.test.ts`
- Add Vitest globals if needed via tsconfig for type hints.

## Deployment
- Build with `npm run build` and run `npm run start` or deploy via your platform.

## Security
- Supabase RLS recommended on tables
- Avoid storing plaintext passwords; Supabase Auth manages credentials
- Optional CSRF enforcement for admin APIs
