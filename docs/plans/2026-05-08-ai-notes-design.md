# AI Notes Design

## Product Summary

AI Notes is a role-aware article note system. A user signs in, pastes useful article content into a note, adds a lightweight marker, and asks AI to generate a structured breakdown. An admin can view all users and all notes for management purposes.

## Primary Audience

- Learners collecting high-signal articles from the web
- A supervising admin who needs visibility into platform usage

## MVP Goals

- Save article-based notes in a durable cloud-backed system
- Make notes searchable and editable across devices
- Generate one structured AI analysis per saved note
- Support `user` and `admin` roles from the start

## In Scope

- Email/password registration and sign-in
- User notes with `title`, `source_url`, `marker`, and `content`
- Search within a user's own notes
- AI breakdown sections:
  - topic
  - core argument
  - supporting evidence
  - best-fit scenarios
  - takeaways
- Admin views for all users and all notes

## Out of Scope

- URL auto-ingest
- browser extension capture
- multi-note retrieval
- collaborative sharing
- file attachments
- AI analysis version history

## UX Direction

- Editorial reading-room aesthetic
- Three-panel workspace:
  - left: note search and list
  - center: note editor
  - right: AI analysis
- Admin dashboard focused on visibility instead of editing

## Data Model

### Profiles

- `id`
- `email`
- `role`
- `display_name`
- `created_at`
- `updated_at`

### Notes

- `id`
- `user_id`
- `title`
- `source_url`
- `marker`
- `content`
- `ai_summary`
- `ai_status`
- `created_at`
- `updated_at`

## Permission Rules

- Users can read and mutate only their own notes
- Admins can view all profiles and all notes
- AI analysis only runs for authenticated users on notes they are allowed to access

## Teaching Goals

The project should teach:

- how frontend pages talk to data
- why AI calls belong on the server
- how auth, roles, and database policies work together
- how to structure a small AI product for future growth
