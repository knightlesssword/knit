# knit

a minimalist, local-first freelance project manager. react + fastapi + local
sqlite. calm, sparse, text-first. each account gets its own clients, projects,
and data.

specs: `project.md` (product), `agents.md` (engineering rules). both are
authoritative — read them before changing anything.

## status: phase 3 milestones and tasks

working: backend shell, sqlite + migrations (users, clients, projects,
milestones, tasks), auth, per-user client/project crud with archive, milestones
with derived counts, tasks with list + kanban, server-side progress,
per-user task views, about page, pwa shell, backend + frontend test suites.

not yet built: time (phase 4), money/invoices (phase 5), files/comments
(phase 6), command palette + search (phase 7).

## prerequisites

- python 3.12+
- node 22+ / npm 10+

## run it

```powershell
# backend (http://127.0.0.1:8000, docs at /docs)
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# frontend (http://localhost:5173, /api proxied to the backend)
cd frontend
npm install
npm run dev
```

first run creates `backend/data/knit.db` and applies `backend/app/migrations/*.sql`.
register at http://localhost:5173/register, then log in.

## local-backend caveat (offline)

the pwa service worker caches the app shell so it loads offline, but domain
data lives behind the local fastapi process — the ui needs that process
running. this is documented, not disguised: `/api/*` is never cached, and the
overview page says plainly when the server is unreachable.

## configuration

| variable            | default                          | note                        |
| ------------------- | -------------------------------- | --------------------------- |
| `KNIT_DATABASE_PATH`| `backend/data/knit.db`           | sqlite file                 |
| `KNIT_SECRET_KEY`   | dev-only fallback (see warning)  | set a long random value     |
| `KNIT_TOKEN_DAYS`   | `7`                              | auth token lifetime         |

never commit a real secret key. never log passwords or tokens.

## database

- sqlite with `PRAGMA foreign_keys = ON` (always) and WAL mode.
- migrations are versioned plain-sql files: `backend/app/migrations/NNN_name.sql`,
  tracked in `schema_migrations`. each runs in one transaction (all-or-nothing).
- every schema change needs a new migration + a matching sqlalchemy model update.
  `tests/test_migrations.py` asserts models match the migrated schema.
- reversible where practical: `NNN_name.down.sql` sits next to each migration.
- money (later phases): integer minor units + explicit currency, never float.

## tests

```powershell
cd backend; python -m pytest -q        # 13 tests: health, auth, migrations
cd frontend; npm test                  # 13 tests: validation, api client, states
cd frontend; npm run build             # typecheck + production build
```

## api (phases 0-1)

- `GET /api/health` → `{status, version}`
- `POST /api/auth/register` `{name, email, password}` → 201 `{token, user}`
- `POST /api/auth/login` `{identifier, password}` → 200 `{token, user}`
- `GET /api/auth/me` (bearer) → 200 user
- `GET /api/clients` (bearer) → 200 own clients
- `POST /api/clients` `{name, company?, email?, phone?, notes?}` → 201 client
- `GET /api/clients/{id}` → 200 client, or 404 (also when owned by someone else)
- `PATCH /api/clients/{id}` partial update → 200 client
- `DELETE /api/clients/{id}` → 204
- `DELETE /api/clients/{id}` → 204, or 409 `client_has_projects`
- `GET /api/projects` (bearer, archived excluded unless `?include_archived=true`)
- `POST /api/projects` `{name, client_id, project_type, currency, status?, description?, notes?, budget?, hourly_rate?, fixed_price?, recurring_amount?, recurring_billing_period?, start_date?, due_date?}` → 201 project (money in integer minor units, dates `YYYY-MM-DD`)
- `GET /api/projects/{id}` → 200 project with `client_name`
- `PATCH /api/projects/{id}` partial update → 200 project
- `POST /api/projects/{id}/archive` → 200 archived project (idempotent)
- `POST /api/projects/{id}/unarchive` → 200 project
- `DELETE /api/projects/{id}` → 204
- `DELETE /api/projects/{id}` → 204, or 409 `project_has_work`
- `GET /api/projects/{id}/milestones`, `POST` → 201 milestone
- `GET/PATCH/DELETE /api/milestones/{id}` (delete keeps tasks, unassigns them)
- `GET /api/projects/{id}/tasks`, `POST` → 201 task (milestone must belong to the project)
- `GET /api/tasks` (all own tasks), `GET/PATCH/DELETE /api/tasks/{id}` (status drives `completed_at` server-side)
- project responses carry `progress: {total, done} | null` (null when no tasks)
- errors always look like `{error: {code, message}}`. no stack traces leave the server.

## layout

```text
backend/app/    config, errors, db (migrations), database (engine),
                models, schemas, security, deps, routers/*, migrations/*
backend/tests/  health, auth, clients, projects, migrations
frontend/src/   app/ (shell, router)  features/auth  features/dashboard
                features/clients  features/projects  features/about
                components/ (loading/empty/error/progress primitives)
                lib/ (typed api client, validation, money)  styles/
```

## decisions worth knowing

- hand-rolled sql migrations instead of alembic: one table today, deterministic
  and dependency-free; alembic buys little until the schema grows.
- hand-written `sw.js` instead of a pwa plugin: same shell caching, zero deps.
- passwords: bcrypt. tokens: hs256 jwt, 7-day expiry, localstorage on the client.
- `identifier` on login is the email address (lowercased); the field name leaves
  room for username login without an api change.
