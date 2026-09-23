# knit

a minimalist, local-first freelance project manager. react + fastapi + local
sqlite. calm, sparse, text-first. each account gets its own clients, projects,
and data.

specs: `project.md` (product), `agents.md` (engineering rules). both are
authoritative — read them before changing anything.

## status: phase 1 clients

working: backend shell, sqlite + migrations (users, clients), auth
(register/login/me), per-user client crud, frontend shell with auth pages,
clients list/detail, about page, pwa shell, backend + frontend test suites.

not yet built: projects (phase 2), tasks (phase 3), time (phase 4),
money/invoices (phase 5), files/comments (phase 6), command palette + search
(phase 7).

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
- errors always look like `{error: {code, message}}`. no stack traces leave the server.

## layout

```text
backend/app/    config, errors, db (migrations), database (engine),
                models, schemas, security, deps, routers/*, migrations/*
backend/tests/  health, auth, clients, migrations
frontend/src/   app/ (shell, router)  features/auth  features/dashboard
                features/clients  features/about
                components/ (loading/empty/error/progress primitives)
                lib/ (typed api client, validation)  styles/
```

## decisions worth knowing

- hand-rolled sql migrations instead of alembic: one table today, deterministic
  and dependency-free; alembic buys little until the schema grows.
- hand-written `sw.js` instead of a pwa plugin: same shell caching, zero deps.
- passwords: bcrypt. tokens: hs256 jwt, 7-day expiry, localstorage on the client.
- `identifier` on login is the email address (lowercased); the field name leaves
  room for username login without an api change.
