# AI Notes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a role-aware article note application with AI analysis, cloud persistence, and a teachable full-stack structure.

**Architecture:** Use a single Next.js App Router project so frontend pages and backend routes live together. Let Supabase handle auth and note storage with row-level security, and keep OpenAI calls in a protected server route.

**Tech Stack:** Next.js, React, TypeScript, Supabase Auth, Supabase Postgres, OpenAI Responses API

---

### Task 1: Project Baseline

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `.env.example`
- Create: `.eslintrc.json`
- Create: `.gitignore`
- Create: `README.md`

**Steps:**
1. Add a minimal Next.js + TypeScript project manifest.
2. Add environment placeholders for Supabase and OpenAI.
3. Add a README that explains frontend, backend, database, and setup steps.
4. Keep the dependency list small so later installation is easy to understand.

### Task 2: Database and Role Model

**Files:**
- Create: `supabase/migrations/20260508000000_init.sql`

**Steps:**
1. Create `profiles` and `notes` tables.
2. Add a role enum with `admin` and `user`.
3. Add RLS policies for user-owned notes and admin visibility.
4. Add the new-user trigger that creates a matching profile row.

### Task 3: Supabase Clients and Auth Boundaries

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`

**Steps:**
1. Add a browser Supabase client for safe user-scoped CRUD.
2. Add a server Supabase client for protected routes and page loaders.
3. Add middleware to keep auth sessions fresh.
4. Make auth boundaries visible in code comments and naming.

### Task 4: Shared Types and AI Logic

**Files:**
- Create: `lib/types.ts`
- Create: `lib/openai/analyze-note.ts`

**Steps:**
1. Define shared profile, note, role, and analysis types.
2. Add one analysis function that turns a saved article into structured JSON.
3. Keep prompt logic in one place so future prompt tuning is easy.

### Task 5: Auth Pages and Layout

**Files:**
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `app/auth/signin/page.tsx`
- Create: `app/auth/signup/page.tsx`
- Create: `components/forms/auth-form.tsx`
- Create: `components/layout/app-shell.tsx`

**Steps:**
1. Build the landing page and auth entry points.
2. Create a distinctive editorial UI direction.
3. Add one reusable auth form for sign-in and sign-up.
4. Add a shared dashboard shell for signed-in users.

### Task 6: Notes Workspace

**Files:**
- Create: `app/dashboard/layout.tsx`
- Create: `app/dashboard/page.tsx`
- Create: `components/notes/notes-workspace.tsx`
- Create: `components/notes/notes-list.tsx`
- Create: `components/notes/note-editor.tsx`
- Create: `components/notes/ai-analysis-panel.tsx`

**Steps:**
1. Load the current user profile and user-owned notes on the server.
2. Hydrate a client workspace that supports create, update, delete, and search.
3. Keep note CRUD in the browser through Supabase so the data flow is easy to learn.
4. Keep AI analysis as a separate panel and separate request path.

### Task 7: Protected AI Route

**Files:**
- Create: `app/api/ai/analyze/route.ts`

**Steps:**
1. Accept a note id from the client.
2. Re-check access with the authenticated server client.
3. Generate the AI breakdown.
4. Store the result back into the note row.

### Task 8: Admin Dashboard

**Files:**
- Create: `app/dashboard/admin/page.tsx`
- Create: `components/admin/admin-overview.tsx`

**Steps:**
1. Restrict the page to admins.
2. Show user counts, note counts, and a readable global note list.
3. Keep admin visibility read-only for the first version.

### Task 9: Verification and Teaching Notes

**Files:**
- Modify: `README.md`
- Review: `docs/plans/2026-05-08-ai-notes-design.md`

**Steps:**
1. Verify the environment variables are documented.
2. Verify each layer is easy to trace for a beginner.
3. Add any missing setup or migration notes discovered during local verification.
