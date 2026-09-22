# knit

a minimalist, local-first freelance project manager. single user, local sqlite,
react + fastapi. calm, sparse, text-first.

specs: `project.md` (product), `agents.md` (engineering rules). both are
authoritative — read them before changing anything.

## status: phase 0 foundation

working: backend shell, sqlite + migrations, auth (register/login/me),
frontend shell with auth pages + navigation skeleton, pwa shell (manifest +
service worker), backend + frontend test suites.

not yet built: clients (phase 1), projects (phase 2), tasks (phase 3),
time (phase 4), money/invoices (phase 5), files/comments (phase 6),
command palette + search (phase 7).

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

## api (phase 0)

- `GET /api/health` → `{status, version}`
- `POST /api/auth/register` `{name, email, password}` → 201 `{token, user}`
- `POST /api/auth/login` `{identifier, password}` → 200 `{token, user}`
- `GET /api/auth/me` (bearer) → 200 user
- errors always look like `{error: {code, message}}`. no stack traces leave the server.

## layout

```text
backend/app/    config, errors, db (migrations), database (engine),
                models, schemas, security, deps, routers/*, migrations/*
backend/tests/  health, auth, migrations
frontend/src/   app/ (shell, router)  features/auth  features/dashboard
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
