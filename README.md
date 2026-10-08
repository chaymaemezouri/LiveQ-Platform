# LiveQ

Real-time audience interaction for scientific conferences, lectures, workshops, and training sessions.

This repository is at **Phase 4**: speakers can open a question for live voting, participants answer once over Socket.IO, and published results appear as charts. Session-wide analytics and projector mode are not implemented yet.

## Repository layout

```text
apps/api        NestJS API, Prisma schema, PostgreSQL access
apps/web        React + Vite application
docker-compose.yml
.env.example
```

The API owns business rules. The web app is a client. Shared contracts will live in a workspace package when both sides need them.

## Prerequisites

- Node.js 22 or newer
- npm 11
- Docker Desktop, with the Docker Compose plugin

## Run locally

From the repository root:

```bash
cp .env.example .env
npm install
npm run db:up
npm run db:deploy
npm run dev
```

- Web app: http://localhost:5173
- API health: http://localhost:3002/api/health

The Vite dev server proxies `/api` to the API. The status page calls that health check. The API listens on port 3002 so it does not collide with other local tools that commonly use ports 3000 and 3001. If port 5173 is already in use, Vite selects the next free port and prints it in the terminal. Session QR codes use `WEB_ORIGIN`, so keep that value equal to the address you open in the browser.

On Windows PowerShell, copy the env file with:

```powershell
Copy-Item .env.example .env
```

## Scripts

| Command                             | Purpose                                                  |
| ----------------------------------- | -------------------------------------------------------- |
| `npm run dev`                       | API and web app together                                 |
| `npm run dev:api`                   | API only                                                 |
| `npm run dev:web`                   | Web app only                                             |
| `npm run lint`                      | Lint both workspaces                                     |
| `npm run format`                    | Format the repository with Prettier                      |
| `npm test`                          | Unit tests                                               |
| `npm run test:e2e`                  | API health, sessions, questions, and participant joining |
| `npm run build`                     | Production build                                         |
| `npm run db:up` / `npm run db:down` | Start or stop PostgreSQL                                 |
| `npm run db:migrate`                | Create a new Prisma migration in development             |
| `npm run db:deploy`                 | Apply committed migrations                               |

`prisma generate` runs before the API dev server, tests, and build. The generated client is not committed.

## Configuration

All local secrets belong in the root `.env`, which is gitignored. `.env.example` lists every variable. `JWT_SECRET` must be at least 32 characters. The API validates its environment on startup and exits if the configuration is invalid.

Docker Compose reads the same file for the Postgres user, password, database, and host port. The database is published on port 5433 so it does not collide with another Postgres already using 5432.

## Current behavior

`GET /api/health` stays public and returns:

```json
{
  "status": "ok",
  "service": "liveq-api",
  "database": "up",
  "timestamp": "..."
}
```

If Postgres cannot answer the probe, the API responds with `503`.

Speaker routes:

| Method             | Path                                             | Access                                                                      |
| ------------------ | ------------------------------------------------ | --------------------------------------------------------------------------- |
| POST               | `/api/auth/register`                             | Public. Returns an access token and the speaker profile.                    |
| POST               | `/api/auth/login`                                | Public. Same response. Wrong email or password is a generic 401.            |
| POST               | `/api/auth/logout`                               | Bearer token. `204`. The client discards the token.                         |
| GET                | `/api/auth/me`                                   | Bearer token. Profile only.                                                 |
| GET, POST          | `/api/sessions`                                  | Bearer token. Lists or creates the signed-in speaker’s sessions.            |
| GET, PATCH, DELETE | `/api/sessions/:id`                              | Bearer token. Missing and foreign sessions both return 404.                 |
| POST               | `/api/sessions/:id/activate`                     | Draft to active.                                                            |
| POST               | `/api/sessions/:id/end`                          | Active to ended.                                                            |
| GET, POST          | `/api/sessions/:sessionId/questions`             | Bearer token. The signed-in speaker’s questions for that session.           |
| GET, PATCH, DELETE | `/api/sessions/:sessionId/questions/:questionId` | Bearer token. Delete is 204.                                                |
| PATCH              | `/api/sessions/:sessionId/questions/reorder`     | Bearer token. Full ordered list of question ids.                            |
| POST               | `/api/join`                                      | Public. Active sessions only. Returns a one-time reconnect token.           |
| GET                | `/api/join/me`                                   | Participant reconnect token. Refreshes last seen.                           |
| GET, POST          | `/api/sessions/:sessionId/live`                  | Bearer token. Live snapshot, plus `launch`, `close`, `publish`, and `next`. |
| GET                | `/api/join/live`                                 | Participant reconnect token. Current question without unpublished answers.  |
| POST               | `/api/join/votes`                                | Participant reconnect token. One vote on the open question.                 |

Passwords are stored as Argon2 hashes and are never returned. The speaker access token payload contains only the speaker id. Session and question writes ignore any client-supplied owner id. Each session gets an 8-character joining code. `joinUrl` is `${WEB_ORIGIN}/join/{code}`.

A participant joins with that code and an optional nickname. No account is required. The API stores only a SHA-256 hash of the reconnect token. Draft and unknown codes both return 404. A new join after the session ends returns 409. Refreshing the waiting room calls `GET /api/join/me` and keeps the same participant. Speaker session responses include `participantCount`.

A question has two to six options. `correctOptionIndex` selects one of those options. Omitting it, or sending null, stores an ungraded opinion poll in `correct_answers` by leaving that table empty. Questions that already have votes cannot be edited or deleted. Question routes are authenticated, so the correct option is available only to the session owner.

A speaker opens one question at a time. Participants receive it over Socket.IO and can vote once. The speaker sees the submitted-vote count immediately. Closing voting stops new votes. Publishing results sends the chart, the percentages, and—only then—the correct option. Opinion polls publish with no correct option. The next question opens only after the current results are published. Ending a session closes any open vote. Refreshing or reconnecting restores the same live state.

The web app provides registration, sign-in, a speaker dashboard with the participant count, session create/edit/detail with a QR code and live voting controls, a question list and editor on each session, account sign-out, `/status`, and a mobile waiting room at `/join` and `/join/:code`.

## Database

PostgreSQL 17. The Prisma schema is `apps/api/prisma/schema.prisma`. Phase 1 renames the session lifecycle value `LIVE` to `ACTIVE` and adds optional `scheduled_start_at` and `scheduled_end_at` columns. `started_at` and `ended_at` are still written when a session is activated or ended. Phases 2, 3, and 4 use the existing question, participant, question-run, and vote tables and do not add a migration.

Notable integrity rules already in the schema:

- A session belongs to one speaker (`users`).
- Questions are ordered per session.
- A question has at most one correct option, stored in `correct_answers`. No row means an ungraded opinion poll.
- Participants are anonymous. Only a SHA-256 hash of their reconnect token is stored.
- A participant can vote once per question. The vote row also rejects a second vote on the same run.
- A vote’s option, participant, and question run must belong to the same question and session.
- `question_runs.open_session_id` is unique. While a run is open it holds the session id; when the run closes it is set to null. That allows one open question per session.

## What is intentionally deferred

| Later phase | Not in this build           |
| ----------- | --------------------------- |
| 5           | Session-wide analytics      |
| 6           | Projector presentation mode |

Published question results use Recharts. Session-wide reports are still deferred.
