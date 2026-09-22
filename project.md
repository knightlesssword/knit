# freelance project manager

## 1. product definition

a minimalist, local-first project management application for freelancers.

the application manages four primary areas:

1. projects and tasks
2. clients
3. time tracking and timesheets
4. money and invoices

the product is intentionally narrow.

it is not intended to become:

* jira
* notion
* quickbooks
* google drive
* slack
* a crm
* an agency management platform
* an ai assistant
* a notification platform
* a payment processor

the product should feel calm, sparse, deliberate, and text-first.

the interface should communicate:

> what am i working on, what is due, how much work have i done, and what money is associated with it?

without requiring the user to navigate through a dense administrative dashboard.

---

# 2. product goals

## primary goals

* manage freelance projects
* manage clients
* manage project tasks
* track time against projects and tasks
* manage project budgets
* manage expenses
* create invoices
* generate invoice pdfs
* maintain project milestones
* maintain project file locations as local filesystem paths
* provide useful project and business summaries
* work completely locally
* work offline
* provide a pwa-capable frontend
* remain usable with a minimal amount of data

## secondary goals

* demonstrate strong full-stack engineering
* demonstrate local-first architecture
* demonstrate clean domain modelling
* demonstrate responsive, polished ui
* demonstrate robust persistence and migrations
* demonstrate testing and error handling
* be portfolio-grade
* potentially evolve into a real product later

---

# 3. explicit non-goals

the following must not be implemented in v1:

* notifications
* event bus infrastructure
* background event processing
* payment processing
* online payments
* third-party integrations
* github integration
* google calendar integration
* google drive integration
* gmail integration
* slack integration
* client portal
* client accounts
* file uploads
* cloud file storage
* storing project files inside the application
* ai functionality
* chat
* realtime collaboration
* team accounts
* multi-user workspaces
* complex accounting
* tax filing
* payroll
* subscription billing
* crm functionality
* heavy analytics
* 3d graphics
* webgl
* glassmorphism
* decorative visual effects
* excessive charts
* dense enterprise-style dashboards

these exclusions are intentional.

do not add infrastructure for hypothetical future requirements.

---

# 4. target user

the initial product is single-user.

the user represents one freelancer.

the application may eventually support freelancers generally, but v1 assumes:

```text
one local installation
        |
        └── one user
              |
              ├── clients
              └── projects
```

there is no workspace/member hierarchy.

---

# 5. core product model

the primary domain relationship is:

```text
user
 |
 ├── clients
 |
 └── projects
       |
       ├── milestones
       │     └── tasks
       |
       ├── time entries
       |
       ├── expenses
       |
       ├── invoices
       │     └── invoice items
       |
       ├── comments
       |
       └── filesystem paths
```

the project is the central entity.

clients provide business context.

tasks represent work.

time entries represent work performed.

expenses represent project costs.

invoices represent money requested from the client.

filesystem paths represent where project files already exist on the user's machine.

---

# 6. core workflows

## workflow 1: create a client

```text
clients
  |
  └── new client
        |
        ├── name
        ├── company
        ├── email
        ├── phone
        └── notes
```

after creation, the user can create projects belonging to that client.

---

# 7. workflow 2: create a project

a project requires:

* name
* client
* project type
* status
* currency

optional:

* description
* start date
* due date
* budget
* hourly rate
* fixed price
* recurring amount
* notes

project types:

```text
fixed_price
hourly
retainer
```

currency:

```text
USD
GBP
INR
```

---

# 8. workflow 3: manage project work

project:

```text
project
  |
  ├── overview
  ├── tasks
  ├── milestones
  ├── time
  ├── expenses
  ├── invoices
  ├── files
  └── activity
```

the primary project view should show only the information needed to understand project state.

example:

```text
website redesign

acme inc.
active

████████████░░░░  72%

deadline
oct 12

42h 30m tracked
$4,250 budget
$2,870 invoiced

next
finish responsive implementation
```

avoid filling the screen with cards.

---

# 9. task management

tasks support:

* title
* description
* status
* priority
* due date
* milestone
* estimated duration
* created date
* completed date

task statuses:

```text
todo
in_progress
done
```

priority:

```text
low
medium
high
```

v1 provides:

* list view
* kanban view

tasks can belong to:

* project
* optional milestone

tasks can have time entries.

tasks do not support:

* task dependencies
* subtasks
* custom workflows
* automation
* recurring tasks
* task assignments

there is only one user.

---

# 10. milestones

milestones represent meaningful project stages.

example:

```text
discovery
design
development
testing
delivery
```

milestones contain:

* name
* description
* due date
* status
* order

milestone status should be derived where practical from its tasks.

example:

```text
5 tasks
3 done
2 remaining

60%
```

the user may manually mark a milestone complete when required.

---

# 11. time tracking

v1 does not require a live timer.

time is entered manually.

a time entry contains:

* project
* optional task
* date
* duration
* description
* billable flag

example:

```text
sep 22

frontend implementation
2h 30m
website redesign
billable
```

time entries must support:

* create
* edit
* delete
* filtering
* weekly grouping
* project grouping
* task grouping
* billable/non-billable distinction

---

# 12. timesheets

the timesheet view should be extremely simple.

default view:

```text
mon   5h 20m
tue   6h 10m
wed   4h 45m
thu   7h 05m
fri   5h 30m

week total
28h 50m
```

allow navigation between weeks.

show:

* total hours
* billable hours
* non-billable hours
* hours by project

do not build payroll-style timesheets.

---

# 13. project financial model

projects support:

## fixed price

```text
project value = fixed price
```

## hourly

```text
project value =
tracked billable hours × hourly rate
```

## retainer

v1 supports storing:

* recurring amount
* billing period

but does not automate recurring invoices.

---

# 14. expenses

expenses belong to projects.

expense fields:

* project
* amount
* currency
* date
* category
* description
* billable

categories:

```text
software
travel
hardware
services
other
```

there are no receipt uploads in v1.

---

# 15. invoices

v1 supports invoice creation and pdf generation.

invoice fields:

* invoice number
* client
* project
* issue date
* due date
* currency
* notes
* status

invoice statuses:

```text
draft
issued
paid
overdue
cancelled
```

invoice items:

* description
* quantity
* unit price
* tax percentage
* discount

v1 does not send invoices.

the user generates a pdf and handles delivery externally.

---

# 16. invoice pdf

generated invoices should be professional and minimal.

include:

```text
freelancer information

invoice number
issue date
due date

client information

line items

subtotal
discount
tax
total

notes
payment instructions
```

the pdf should respect the invoice currency.

do not hardcode currency symbols.

---

# 17. clients

client fields:

```text
id
name
company
email
phone
notes
created_at
updated_at
```

client detail should aggregate:

```text
projects
total project value
total invoiced
total tracked hours
```

do not implement a full crm.

---

# 18. project filesystem paths

the application does not store project files.

instead, a project may contain multiple filesystem locations.

example:

```text
project files

+ add path

C:\Users\abu\Projects\acme-website
D:\Designs\Acme
D:\Contracts\Acme
```

each path contains:

* label
* path
* optional description

the ui may provide an "open" action where supported by the local environment.

the database stores the path string only.

never copy files into the application's storage.

---

# 19. comments

comments exist only on tasks.

comment fields:

```text
id
task_id
body
created_at
updated_at
```

single-user means comments primarily act as work notes.

there is no messaging system.

---

# 20. dashboard

the dashboard should not resemble an enterprise analytics dashboard.

the initial dashboard should answer:

```text
what am i working on?
what needs attention?
how much time have i logged?
what money is outstanding?
```

possible sections:

```text
active projects

upcoming deadlines

overdue tasks

recent work

this week's time

outstanding invoices
```

use text and progress bars.

avoid card grids wherever possible.

---

# 21. command center

the application should have a command palette.

keyboard shortcut:

```text
cmd/ctrl + k
```

initial commands:

```text
new project
new client
new task
log time
new expense
new invoice
search
go to projects
go to clients
go to timesheet
go to invoices
```

the command palette must remain lightweight.

no ai command interpretation.

---

# 22. search

global search should cover:

* clients
* projects
* tasks
* invoices

search should be fast and local.

initial implementation may use sqlite full-text search if useful, but do not introduce a search engine.

---

# 23. authentication

local account system.

registration:

```text
name
email or username
password
```

login:

```text
identifier
password
```

the application has one user.

passwords must never be stored in plaintext.

use a modern password hashing algorithm supported by the chosen backend.

authentication must be implemented as a real domain boundary even though the application is local.

---

# 24. local-first architecture

the application should work without internet connectivity.

the database is local.

the ui must not require an external api to function.

target architecture:

```text
react pwa
    |
    v
local application api
    |
    v
sqlite
```

if a python backend is used:

```text
react
  |
  | http
  v
fastapi
  |
  v
sqlite
```

the backend should remain local.

do not add postgres merely for familiarity.

the system should be designed so sqlite can later be replaced with postgres without rewriting the domain model.

---

# 25. persistence

sqlite is the default v1 database.

requirements:

* migrations
* foreign keys enabled
* transactions
* indexes
* constraints
* timestamps
* soft deletion only where it materially helps

do not use an in-memory data store for domain state.

---

# 26. pwa

the frontend should be installable as a pwa.

support:

* app manifest
* service worker
* static asset caching
* offline application shell
* offline data access

the app should remain usable when disconnected from the internet.

native mobile packaging is explicitly deferred.

---

# 27. ui principles

the ui is one of the most important parts of the project.

visual direction:

```text
minimal
editorial
black
white
gray
typography
whitespace
subtle borders
small progress bars
small transitions
```

reference feeling:

* squarespace
* editorial web design
* restrained productivity software
* high-quality documentation interfaces

do not imitate another product literally.

---

# 28. ui anti-patterns

do not introduce:

* glassmorphism
* gradients everywhere
* neon colors
* huge hero illustrations
* 3d
* webgl
* animated backgrounds
* floating blobs
* excessive shadows
* excessive rounded cards
* giant dashboards
* rainbow status badges
* oversized icons
* decorative charts
* unnecessary modals
* visual noise

if an element does not help the user understand or operate the system, remove it.

---

# 29. interaction design

interactions should feel responsive without becoming theatrical.

allowed:

* subtle hover transitions
* small opacity changes
* button state transitions
* progress animation
* page transitions
* dropdown animation
* command palette animation
* drag/drop feedback

avoid:

* long transitions
* spring-heavy animation
* parallax
* continuous animation
* loading animations used as decoration

interaction speed should feel close to instantaneous.

---

# 30. responsive behavior

desktop is the primary environment.

the application must still support:

* tablet
* mobile browser
* installed pwa

responsive behavior should preserve information hierarchy.

do not simply shrink desktop layouts.

---

# 31. navigation

initial navigation:

```text
overview
projects
clients
tasks
timesheet
invoices
settings
```

do not expose every database table as navigation.

for example:

```text
milestones -> project
expenses -> project / financial views
comments -> task
filesystem paths -> project
```

---

# 32. project page

the project page is the most important page.

recommended structure:

```text
project name
client
status
deadline

progress

overview
tasks
milestones
time
money
files
activity
```

tabs should be used only where they reduce cognitive load.

avoid turning every section into a separate route if a contextual layout works better.

---

# 33. project progress

project progress should have a transparent calculation.

default:

```text
completed tasks / total tasks
```

example:

```text
12 / 20 completed
60%
```

if a project has no tasks:

```text
no progress
```

do not invent a percentage based on arbitrary weighting.

later, milestone-weighted progress can be introduced if needed.

---

# 34. money calculations

all monetary calculations must avoid floating-point arithmetic.

use integer minor units.

example:

```text
$12.50
```

stored as:

```text
1250
```

with:

```text
currency = USD
```

for INR, GBP and USD use the appropriate currency precision.

money calculations must be deterministic.

---

# 35. dates and time

store timestamps consistently.

the application must distinguish:

* date-only values
* timestamps
* durations

examples:

```text
project due date
    -> date

created_at
    -> timestamp

time entry
    -> date + duration
```

do not represent durations as timestamps.

timezone should be associated with the local user configuration.

---

# 36. data integrity

the application must prevent:

* tasks referencing nonexistent projects
* invoices referencing nonexistent clients
* time entries referencing nonexistent projects
* invoice items without invoices
* duplicate invoice numbers where uniqueness is required
* negative monetary values where invalid
* malformed currency codes
* orphaned records
* invalid status transitions

database constraints should enforce invariants wherever possible.

---

# 37. auditability

v1 does not need a general event system.

however, important records should have:

* created_at
* updated_at

where useful:

* completed_at
* deleted_at

do not build a generic event bus.

do not build notification infrastructure.

---

# 38. deletion strategy

destructive actions should require confirmation where data loss is meaningful.

for example:

```text
delete project
```

should warn that associated tasks, time entries and other data may also be affected.

prefer archive for projects over immediate destruction.

do not introduce soft deletion everywhere by default.

---

# 39. error handling

errors must be understandable.

bad:

```text
error 500
```

good:

```text
couldn't create invoice.
the invoice number already exists.
```

validation should happen at:

1. ui boundary
2. api/domain boundary
3. database boundary where appropriate

never rely solely on frontend validation.

---

# 40. loading states

every async view needs:

* loading state
* empty state
* error state

empty states should explain the next useful action.

example:

```text
no projects yet.

create your first project
```

not:

```text
no data
```

---

# 41. accessibility

support:

* keyboard navigation
* visible focus states
* semantic html
* labels for inputs
* accessible buttons
* sufficient contrast
* screen-reader-friendly controls
* reduced motion preference

do not use color as the only status indicator.

---

# 42. performance

the app is local-first, so interactions should feel immediate.

targets:

* fast initial load
* no unnecessary network round trips
* optimistic ui where safe
* efficient sqlite queries
* indexed foreign keys
* pagination for potentially large lists
* virtualized lists only when genuinely necessary

do not prematurely optimize.

---

# 43. architecture principles

prefer:

```text
feature
  |
  ├── ui
  ├── domain
  ├── persistence
  └── api
```

over:

```text
components/
utils/
helpers/
misc/
stuff/
```

avoid giant files.

avoid giant generic abstractions.

avoid creating abstractions before there are multiple concrete use cases.

---

# 44. recommended technical direction

frontend:

```text
vite
react
typescript
```

backend:

```text
python
fastapi
```

database:

```text
sqlite
```

orm/data layer:

```text
sqlalchemy
```

validation:

```text
pydantic
```

pwa:

```text
vite pwa tooling
```

pdf:

```text
server-side pdf generation
```

the exact libraries may be changed if the coding agent identifies a materially better maintained choice.

do not add dependencies merely for convenience.

---

# 45. development phases

## phase 0: foundation

deliver:

* project scaffolding
* frontend shell
* backend shell
* sqlite
* migrations
* configuration
* error handling
* logging
* basic test infrastructure
* pwa foundation
* auth foundation

acceptance:

* application launches locally
* database initializes correctly
* migration system works
* user can register
* user can log in
* password is securely hashed
* application works without internet

---

## phase 1: clients

deliver:

* client list
* client creation
* client editing
* client deletion/archive
* client detail
* project association

acceptance:

* user can create a client
* client appears immediately
* client can be edited
* client can be associated with projects

---

## phase 2: projects

deliver:

* project creation
* project editing
* project archive
* project status
* project type
* currency
* budget
* hourly rate
* dates
* project overview

acceptance:

* project can be created under a client
* project values persist
* project can be archived
* project overview accurately reflects stored data

---

## phase 3: milestones and tasks

deliver:

* milestones
* task list
* kanban
* task creation
* task editing
* priority
* due dates
* estimates
* task completion
* project progress

acceptance:

* task can belong to project
* task can belong to milestone
* task status changes correctly
* project progress updates correctly
* list and kanban remain consistent

---

## phase 4: time

deliver:

* manual time entries
* project association
* task association
* billable flag
* descriptions
* timesheet
* weekly summaries

acceptance:

* time can be logged
* time can be edited
* time can be deleted
* project totals update
* weekly totals are accurate

---

## phase 5: money

deliver:

* expenses
* project budget calculations
* financial summary
* invoice creation
* invoice items
* invoice statuses
* payment recording
* invoice pdf

acceptance:

* invoice totals are mathematically correct
* currency is preserved
* invoice numbers are unique
* pdf matches invoice data
* project financial summary is consistent

---

## phase 6: files and activity

deliver:

* filesystem path records
* add/remove path
* open path where supported
* task comments
* lightweight project activity

acceptance:

* no project files are copied into app storage
* path data persists
* invalid paths are handled gracefully

---

## phase 7: polish

deliver:

* command palette
* global search
* keyboard shortcuts
* responsive layouts
* accessibility pass
* empty states
* error states
* loading states
* subtle animations
* performance pass
* pwa installability

---

# 46. v1 definition of done

v1 is complete when a freelancer can:

```text
register
  ↓
create client
  ↓
create project
  ↓
create milestones
  ↓
create tasks
  ↓
complete work
  ↓
log time
  ↓
record expenses
  ↓
create invoice
  ↓
generate invoice pdf
```

and understand their current work from the overview screen.

the application must work locally without internet access.

---

# 47. future roadmap

these are intentionally deferred.

## later

* client portal
* email delivery
* notifications
* recurring invoices
* payment integrations
* github integration
* calendar integration
* google drive integration
* team accounts
* workspaces
* advanced reports
* native mobile app
* cloud sync
* multi-device synchronization
* ai features
* automation

none should influence v1 architecture unless there is a clear low-cost compatibility requirement.

---

# 48. product quality bar

the application should feel like a finished small product rather than a collection of CRUD screens.

quality means:

* consistent typography
* consistent spacing
* predictable interaction patterns
* minimal visual noise
* fast interactions
* strong empty states
* strong error handling
* sensible keyboard support
* correct calculations
* reliable persistence
* clean migrations
* tests around business logic
* no dead controls
* no fake functionality
* no placeholder lorem ipsum
* no speculative infrastructure

the interface should be capable of looking almost boring.

that is intentional.
