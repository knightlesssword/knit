# knit

a minimalist, local-first freelance project manager. react + fastapi + local
sqlite. calm, sparse, text-first. each account gets its own clients, projects,
and data.

product spec: `project.md`. engineering rules: `agents.md`. both are
authoritative — read them before changing anything.

## status

working through phase 3 of 7: auth, clients, projects (with archive),
milestones, tasks (list + kanban), server-side progress, about page, pwa
shell. not yet built: time tracking (4), money/invoices (5), files/comments
(6), command palette + search (7).

## prerequisites

- python 3.12+
- node 22+ / npm 10+

## run it

two separate processes — the backend is never served by the frontend:

```powershell
# backend → http://127.0.0.1:8000 (interactive docs at /docs)
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# frontend → http://localhost:5173 (/api proxied to the backend)
cd frontend
npm install
npm run dev
```

first backend run creates `backend/data/knit.db` and applies
`backend/app/migrations/*.sql`. register at
http://localhost:5173/register, then log in.

## configuration

| variable             | default                 | note                    |
| -------------------- | ----------------------- | ----------------------- |
| `KNIT_DATABASE_PATH` | `backend/data/knit.db`  | sqlite file             |
| `KNIT_SECRET_KEY`    | dev-only fallback       | set a long random value |
| `KNIT_TOKEN_DAYS`    | `7`                     | auth token lifetime     |

never commit a real secret key. never log passwords or tokens.

## database

- sqlite with `PRAGMA foreign_keys = ON` (always) and WAL mode.
- migrations are versioned plain-sql files
  (`backend/app/migrations/NNN_name.sql`), tracked in `schema_migrations`;
  each runs in one transaction. reversible where practical
  (`NNN_name.down.sql`).
- every schema change needs a new migration + a matching sqlalchemy model;
  `tests/test_migrations.py` asserts they match.
- money is integer minor units + explicit currency, never float. durations are
  integer seconds. dates are `YYYY-MM-DD` text, timestamps ISO-8601.

## tests

```powershell
cd backend; python -m pytest -q   # 49 tests: health, auth, clients, projects, work, migrations
cd frontend; npm test             # 40 tests: validation, money, duration, api client, states, about
cd frontend; npm run build        # typecheck + production build
```

## api

auth is bearer-token; every endpoint is scoped to the authenticated user
(cross-user access returns 404, no existence leak).

- `GET /api/health` → `{status, version}`
- `POST /api/auth/register` `{name, email, password}` → 201 `{token, user}`
- `POST /api/auth/login` `{identifier, password}` → 200 `{token, user}`
- `GET /api/auth/me` → 200 user
- clients: `GET /api/clients`, `POST` → 201, `GET/PATCH /api/clients/{id}`,
  `DELETE` → 204 (or 409 `client_has_projects`)
- projects: `GET /api/projects` (archived excluded unless
  `?include_archived=true`), `POST` → 201 (money in minor units, dates
  `YYYY-MM-DD`), `GET/PATCH /api/projects/{id}` (embeds `client_name` and
  `progress: {total, done} | null`), `POST …/archive|unarchive`,
  `DELETE` → 204 (or 409 `project_has_work`)
- milestones: `GET/POST /api/projects/{id}/milestones`,
  `GET/PATCH/DELETE /api/milestones/{id}` (delete keeps tasks, unassigns them)
- tasks: `GET/POST /api/projects/{id}/tasks` (milestone must belong to the
  project), `GET /api/tasks`, `GET/PATCH/DELETE /api/tasks/{id}` (status
  drives `completed_at` server-side)
- errors always look like `{error: {code, message}}`. no stack traces leave
  the server.

## offline note

the service worker caches the app shell so it loads offline, but domain data
lives behind the local fastapi process — the ui needs that process running.
`/api/*` is never cached, and the ui says plainly when the server is
unreachable.

## layout

```text
backend/app/    config, errors, db (migrations), database (engine),
                models, schemas, security, deps, routers/*, migrations/*
backend/tests/  health, auth, clients, projects, work, migrations
frontend/src/   app/ (shell, router)  features/auth  features/dashboard
                features/clients  features/projects  features/work
                features/about  components/ (loading/empty/error/progress)
                lib/ (api client, validation, money, duration)  styles/
```

## decisions worth knowing

- hand-rolled sql migrations instead of alembic: deterministic and
  dependency-free; alembic buys little at this schema size.
- hand-written `sw.js` instead of a pwa plugin: same shell caching, zero deps.
- passwords: bcrypt. tokens: hs256 jwt, 7-day expiry, localstorage.
- `identifier` on login is the email address (lowercased); the field name
  leaves room for username login without an api change.
- kanban moves are buttons, not drag-drop: no new dependency, keyboard-first.

## license

MIT — see `LICENSE`.
