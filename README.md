# AI Notes

AI Notes is a learning-oriented full-stack web app for saving useful articles, lightly tagging them, and generating structured AI breakdowns.

## What You Are Building

This project is intentionally small, but it includes the real pieces that show up in AI products:

- **Frontend**: the pages a user sees and clicks
- **Backend**: secure server routes for model calls
- **Database**: cloud storage for accounts, notes, and role-based access
- **Auth**: email/password sign-in with user and admin roles

## Tech Stack

- **Next.js** for the web app and server routes
- **Supabase** for auth, Postgres, and row-level security
- **DeepSeek API** for article analysis

## Project Shape

```text
app/
  auth/                 Sign-in and sign-up pages
  dashboard/            User workspace and admin area
  api/ai/analyze/       Protected server route for AI analysis
components/
  admin/                Admin views
  forms/                Auth and editing forms
  layout/               Shared shell and navigation
  notes/                Note list, editor, AI panel
lib/
  openai/               Prompting and response parsing
  supabase/             Browser/server helpers
supabase/migrations/    Database schema and policies
docs/plans/            Product design and implementation plan
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

You will need:

- Project URL
- Publishable key

Put them into `.env.local` based on `.env.example`.

### 3. Apply the database migration

Run the SQL in [`supabase/migrations/20260508000000_init.sql`](./supabase/migrations/20260508000000_init.sql) inside the Supabase SQL editor.

### 4. Promote your first admin

After creating your first user account, run:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

### 5. Add your DeepSeek key

Set `DEEPSEEK_API_KEY` in `.env.local`.

Optional:

- `DEEPSEEK_BASE_URL=https://api.deepseek.com`
- `DEEPSEEK_MODEL=deepseek-v4-flash`

### 6. Start the app

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Learning Map

If you are new to full-stack development, this repo is arranged so each layer is easy to trace:

- `app/` shows **routing and page composition**
- `components/` shows **UI building blocks**
- `lib/supabase/` shows **how auth and database clients are created**
- `app/api/ai/analyze/route.ts` shows **why AI keys belong on the server**
- `supabase/migrations/` shows **how roles and data permissions are enforced**

## Current Scope

This first version includes:

- Email/password auth
- User and admin roles
- User note creation, editing, deletion, and search
- AI article breakdown for a single saved note
- Admin visibility into all users and all notes

It intentionally does **not** include:

- URL auto-import
- browser extensions
- multi-note chat
- AI history versions
- collaboration
