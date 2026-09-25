# checkpoint — 2026-09-25

mid-project status note. specs (`project.md`, `agents.md`) remain authoritative;
this file is a dated snapshot, not a spec.

## 1. how much is completed

- phases 0–3 of 7 done: foundation + auth, clients, projects, milestones + tasks
- backend: 4 versioned migrations (users, clients, projects, milestones+tasks),
  27 endpoints under `/api`, per-user scoping everywhere, 49 pytest tests passing
- frontend: 11 routes, typed api client, money/duration/validation helpers,
  list + kanban tasks, server-side progress, 40 vitest tests passing, tsc clean,
  production build clean
- docs: README rewritten for public repo, MIT LICENSE, remote in sync

## 2. where we are now

- phase 3 complete on `master`, pushed to
  `https://github.com/knightlesssword/knit.git`
- working tree clean; dev database is gitignored local-only
- awaiting manual UI test feedback on phases 0–3 (checklist given 2026-09-24)
- no open bugs known; two small gaps logged below (password-echo log,
  missing budget/notes inputs)

## 3. what is next

- phase 4: time tracking — manual time entries (project, optional task, date,
  duration seconds, description, billable flag), edit/delete, timesheet view
  with week navigation, totals (all/billable/non-billable/by project)
- then phase 5 (expenses, invoices, payments, pdf), phase 6 (paths, comments),
  phase 7 (palette, search, shortcuts, responsive + a11y pass, performance)

## 4. decisions required before proceeding

- none blocking. proceeding on these defaults unless objected:
  - timesheet week starts monday
  - duration entry is a whole-minutes number field (displayed as `2h 30m`)
  - new time entries default billable = true
  - timesheet filter is a project dropdown only (no date-range picker in v1)
  - task delete becomes blocked once time entries reference it (spec §22)

## 5. workflow — how to navigate and use knit

daily flow:

```text
register / log in
  └── overview (server health + empty state for now)
  ├── clients → new client → client detail → its projects
  ├── projects → new project → project detail
  │     ├── milestones (create, complete, counts, %)
  │     ├── tasks (create, edit, status → progress updates)
  │     ├── time (phase 4), money (phase 5), files (phase 6)
  ├── tasks (global list ⇄ kanban, same data both views)
  ├── timesheet / invoices (placeholders until phases 4/5)
  ├── settings (placeholder until later)
  └── about (description, controls, usage, versions, dev notes)
```

concrete pass: register → create client "acme" → create project "site"
under acme (hourly, USD) → add milestone "build" → add tasks (one in the
milestone) → mark one done → header shows `1 / 2 completed 50%` → same state
visible on `/tasks` in both list and kanban → archive project → it leaves the
active list, stays under archived.

## 6. constraints — not doable currently

- no time entries or timesheet (phase 4)
- no expenses, invoices, payments, or pdf generation (phase 5; pdf library
  not yet chosen)
- no filesystem paths, no task comments (phase 6)
- no command palette, search, or shortcuts (phase 7)
- overview is health-check + empty state, not the full dashboard from spec §20
- no deterministic seed fixtures yet (spec §36 asks for them)

## 7. scope left

- roughly half the phase list: 4 of 7 phases complete
- entities remaining: TimeEntry, Expense, Invoice, InvoiceItem, Payment,
  ProjectPath, Comment
- views remaining: timesheet, invoices, full dashboard, palette, search

## 8. recommendations

- redact submitted values from 422 error logs — a short/invalid password can
  currently be echoed into the backend log (small security fix, do with phase 4)
- add budget/notes/recurring-billing-period inputs to project create/edit
  forms — backend already supports them, ui only exposes rate/amount
- add a deterministic seed script (`1 client, 3 projects, tasks, milestones`)
  kept out of production data, per spec §36 — do with phase 4
- give the about-page offline state a retry button like other error states
- evaluate pdf libraries at the start of phase 5 (reportlab vs fpdf2 vs
  weasyprint) against the dependency policy; do not pre-pick now
- keep the manual-test-then-report loop per phase; it caught nothing so far,
  which is the point — keep it
