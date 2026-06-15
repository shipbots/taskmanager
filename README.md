# Task Tracker

A personal, cross-project task & calendar dashboard. Each **project** (ShipBots,
Stiefel, Casa Mexia, …) is its own board. Home stacks every project; click one to
drill in. The **ShipBots** project additionally mirrors live action items from the
Onboarding Dashboard (read-only).

Built with Next.js 16 (App Router) · React 19 · Tailwind v4 · NextAuth v5 (Google)
· Prisma + Vercel Postgres · Vercel Blob · @dnd-kit.

---

## Features

- **Projects** — add/recolor/reorder; ShipBots mirrors the Onboarding Dashboard.
- **Tasks** — name, description, client, auto creation date, due date, priority,
  status, file attachments, and a full activity **timeline**.
- **Subtasks** — each with its own due date. Completing one auto-advances the task
  status, and the task's due date follows the **next unfinished subtask**.
- **Templates** — reusable subtask checklists (with optional relative due-date
  offsets) you can apply when creating a task or later from the task drawer.
- **List view** — ordered by urgency. Overdue = red, today = blue, later = normal.
- **Kanban view** — Pending → In Progress → Blocked → Completed. Drag to change
  status; the Completed column is collapsed but expandable.
- **Calendar** — everything by due date, on Home and at `/calendar`.

---

## One-time setup

> Local dev runs on **port 3100** (so it won't clash with the Onboarding
> Dashboard on 3000).

### 1. Provision storage in Vercel
In your Vercel dashboard → **Storage**:
- **Create → Postgres**. Open its `.env.local` tab and copy `POSTGRES_PRISMA_URL`
  and `POSTGRES_URL_NON_POOLING`.
- **Create → Blob**. Copy the `BLOB_READ_WRITE_TOKEN`.

### 2. Google OAuth (login)
[console.cloud.google.com](https://console.cloud.google.com) → APIs & Services →
Credentials → **Create OAuth client ID → Web application**. Add Authorized
redirect URIs:
- `http://localhost:3100/api/auth/callback/google`
- `https://<your-vercel-domain>/api/auth/callback/google` (after first deploy)

Copy the Client ID and Secret.

### 3. Fill `.env`
Copy `.env.example` → `.env` and fill in:

| Variable | Where it comes from |
| --- | --- |
| `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` | Vercel Postgres |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `NEXTAUTH_SECRET` | run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3100` locally |
| `ALLOWED_EMAILS` | your Google email (only these can sign in) |
| `ONBOARDING_API_BASE` | deployed Onboarding Dashboard URL (for the ShipBots mirror) |

### 4. Create the tables & run
```bash
npm install
npm run db:push     # creates tables in Postgres
npm run dev         # http://localhost:3100
```
The three default projects (ShipBots, Stiefel, Casa Mexia) are created
automatically on first load. `npm run db:studio` opens a visual data browser.

---

## Deploy to Vercel
1. Push this folder to a new GitHub repo.
2. In Vercel → **New Project** → import the repo.
3. Attach the Postgres and Blob stores you created to the project (Storage tab →
   Connect), and add the remaining env vars (`GOOGLE_*`, `NEXTAUTH_SECRET`,
   `NEXTAUTH_URL` = your prod URL, `ALLOWED_EMAILS`, `ONBOARDING_API_BASE`).
4. Deploy. After the first deploy, run `npm run db:push` against the production
   database once (or `vercel env pull` locally and run it), and add the prod
   callback URL to Google OAuth.

---

## How status & due dates behave
- A new task starts **Pending**.
- With subtasks: completing one moves the task to **In Progress**; finishing all
  moves it to **Completed**. A manual status (e.g. Kanban drag, or **Blocked**)
  sticks until the next subtask change re-derives it.
- The task's due date = the **next unfinished subtask's** date when subtasks
  exist; otherwise the date you set by hand.

## Phase 2 (planned)
Link Google Calendars (multiple accounts per project) and overlay real events
into the calendar view.
