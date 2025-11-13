# Admin Setup

To enable admin operations (creating employee accounts via the API), set the following environment variables in your `.env` file:

Required:

- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Service Role Key (keep this secret)

Optional:

- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` — Redirect URL if used in auth flows

Notes:

- The Service Role Key is required for using `auth.admin.createUser` in server routes. Do not expose this key on the client.
- After adding the variables, restart the dev server so changes take effect.
- Admin-only API: `POST /api/admin/create-employee` expects `{ name, email, password, type }` and will create an employee in Supabase Auth with appropriate metadata and a corresponding profile via the trigger.
 - Admin-only API: `POST /api/admin/reset-password` expects `{ user_id, new_password }` (minimum 8 characters) and updates the employee's auth password. Requires an authenticated admin or a temporary `admin_code_login=true` cookie for local testing.
 - Admin-only API: `POST /api/admin/delete-employee` expects `{ user_id }` and deletes the employee from Supabase Auth. The `public.users` row is removed via foreign key cascade. You cannot delete admin accounts or your own account.

## Theme Toggle Location

The theme toggle (dark/light) is now located in the admin sidebar at the top, directly next to the Logout button. Theme preference is persisted via `localStorage` (`dp-theme`) and respects the system theme when set to `system`. The toggle is accessible on desktop and mobile—open the mobile sidebar to access it.

Role assignment:

- Roles live in `public.users.role` (`admin` or `employee`) and are also mirrored in `auth.users.raw_user_meta_data.role` for convenience.
- New employees created via the admin API are given `role = "employee"` automatically.
- To set roles for existing accounts, run the SQL in `scripts/004_backfill_roles.sql` using Supabase SQL Editor. Edit the emails in that file to match your users before executing.