# TechTrack (migrated off Base44)

React + Vite app using **Supabase** for Postgres, auth, storage, and optional Edge Functions for email.

**Plain summary for AI (what it is + what I want):** [docs/COPY_PASTE_BRIEF.txt](docs/COPY_PASTE_BRIEF.txt) · [docs/DEVELOPER_BRIEF.md](docs/DEVELOPER_BRIEF.md)

## Quick start

1. `npm install`
2. Create a [Supabase](https://supabase.com) project. Run the SQL in `supabase/migrations/20260401140000_initial_schema.sql` (SQL Editor or `supabase db push`).
3. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings → API.
4. Deploy the `send-email` Edge Function (`supabase/functions/send-email`) and set secrets: `RESEND_API_KEY`, `RESEND_FROM` (optional), or email sending will fail until configured.
5. Enable **Email** provider with password sign-in in Supabase → Authentication → Providers.
6. `npm run dev`

## First admin user

After you sign up, open Supabase → Table Editor → `profiles` and set your row’s `role` to `admin`.

## Data from Base44

Export any data from Base44 before you shut it down, then insert rows into the matching tables (see `supabase/seed.sql`). Entity JSON shapes live in the `/entities` folder.

## Legacy Base44 env vars

`VITE_BASE44_APP_ID` / `VITE_BASE44_APP_BASE_URL` in `src/lib/app-params.js` are unused for this stack; you can ignore them.
# techtrack
