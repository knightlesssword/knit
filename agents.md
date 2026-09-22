# coding agent instructions

## 1. role

you are implementing a local-first freelance project management application.

the product is deliberately minimalist.

optimize for:

1. correctness
2. maintainability
3. simplicity
4. ux quality
5. testability
6. performance

do not optimize for feature count.

do not introduce infrastructure because it might be useful someday.

---

# 2. source of truth

`project.md` is the product specification.

follow it unless the user explicitly changes the requirement.

when implementation details are unspecified:

* choose the simplest robust solution
* prefer established libraries
* avoid speculative abstractions
* avoid unnecessary dependencies
* preserve the product's minimalist philosophy

if a requirement conflicts with an existing implementation, explain the conflict before making a destructive architectural change.

---

# 3. non-goals

do not implement:

* notifications
* event buses
* background event systems
* payments
* third-party integrations
* client portals
* cloud file storage
* file uploads
* ai
* chat
* team collaboration
* realtime collaboration
* multi-user workspaces
* complex accounting
* tax systems
* subscription billing
* crm features

do not sneak these in as "preparation".

---

# 4. architecture

preferred architecture:

```text
react + typescript
        |
        v
local api
        |
        v
sqlite
```

preferred technologies:

```text
frontend
vite
react
typescript

backend
python
fastapi
pydantic
sqlalchemy

database
sqlite

testing
pytest
frontend testing appropriate to chosen react stack
```

the exact dependency choices may change if there is a compelling technical reason.

before introducing a new dependency, ask:

1. can the existing stack solve this?
2. does this dependency materially reduce complexity?
3. does it add maintenance cost?
4. is it actively maintained?
5. does it fit a local-first application?

---

# 5. database rules

use sqlite for v1.

requirements:

* migrations
* foreign keys
* indexes
* constraints
* transactions
* explicit relationships

never disable sqlite foreign-key enforcement.

money must use integer minor units.

do not use floating point for monetary values.

example:

```text
$10.25
```

becomes:

```text
1025
```

with:

```text
currency = USD
```

---

# 6. domain modelling

model actual business concepts.

avoid generic tables such as:

```text
entities
items
records
metadata
```

unless there is a demonstrated reason.

prefer explicit entities:

```text
User
Client
Project
Milestone
Task
TimeEntry
Expense
Invoice
InvoiceItem
Payment
ProjectPath
Comment
```

do not create entities for things that are merely ui concepts.

---

# 7. domain boundaries

business rules belong outside the ui.

bad:

```text
react component calculates invoice total
```

good:

```text
invoice domain/service
    ↓
validated total
    ↓
api
    ↓
ui
```

frontend validation improves ux.

backend validation protects the domain.

database constraints protect persistence.

all three layers should be used where appropriate.

---

# 8. api design

use resource-oriented endpoints.

example:

```text
GET    /clients
POST   /clients
GET    /clients/{id}
PATCH  /clients/{id}
DELETE /clients/{id}
```

projects:

```text
GET    /projects
POST   /projects
GET    /projects/{id}
PATCH  /projects/{id}
DELETE /projects/{id}
```

nested resources should only be nested when the relationship is meaningful.

do not create unnecessarily deep routes such as:

```text
/projects/{project}/milestones/{milestone}/tasks/{task}/comments/{comment}
```

keep api design readable.

---

# 9. api responses

responses should be predictable.

errors should have structured information.

example:

```json
{
  "error": {
    "code": "invoice_number_exists",
    "message": "invoice number already exists"
  }
}
```

do not expose stack traces to the frontend.

log detailed diagnostic information server-side.

---

# 10. authentication

passwords must never be stored directly.

use a modern password hashing implementation.

authentication must be handled server-side.

do not put password validation logic exclusively in react.

do not store raw passwords in logs.

do not log authentication secrets.

sessions/tokens must be handled securely for the local architecture.

---

# 11. frontend architecture

organize by feature rather than one giant component directory.

preferred:

```text
src/
  app/
  features/
    auth/
    clients/
    projects/
    tasks/
    milestones/
    time/
    expenses/
    invoices/
    dashboard/
  components/
  hooks/
  lib/
  styles/
```

feature-specific components should stay near their feature.

shared components should only become shared after there is an actual repeated pattern.

---

# 12. avoid abstraction theater

do not create:

```text
BaseRepository
GenericService
UniversalModal
UniversalEntity
AbstractControllerFactory
```

unless the abstraction solves a real repeated problem.

three similar functions are not automatically an abstraction.

prefer explicit code over speculative architecture.

---

# 13. state management

use the simplest state model that works.

server/domain state should have a clear ownership model.

local ui state should remain local where possible.

avoid putting every piece of state into a global store.

examples of local state:

* modal open state
* current input
* selected tab
* temporary filters

examples of domain state:

* projects
* clients
* tasks
* invoices

---

# 14. data fetching

all api access should go through a consistent client layer.

do not scatter raw fetch calls throughout components.

prefer:

```text
feature api module
        ↓
typed api client
        ↓
backend
```

handle:

* loading
* success
* empty
* error

consistently.

---

# 15. optimistic updates

use optimistic updates only when the operation is safe and rollback is straightforward.

good candidates:

* task status
* task completion
* lightweight ui preferences

be cautious with:

* invoices
* financial data
* deletion
* money calculations

never sacrifice financial correctness for perceived speed.

---

# 16. database transactions

use transactions for operations that must be atomic.

examples:

```text
create invoice
  + invoice items
```

```text
delete/archive project
  + dependent changes
```

```text
record payment
  + update invoice state
```

do not leave partially persisted financial records.

---

# 17. invoice rules

invoice numbers must be unique.

invoice totals must be derived from invoice items.

never trust a client-supplied total.

the backend should calculate:

```text
subtotal
discount
tax
total
```

from persisted line item values.

the frontend may display calculated values, but the backend is authoritative.

---

# 18. project progress

default progress calculation:

```text
completed tasks / total tasks
```

if there are zero tasks:

```text
progress = null
```

do not show:

```text
0%
```

when there is no underlying work.

do not create arbitrary weighted formulas.

---

# 19. time tracking

durations must be represented as durations.

do not store duration as a fake timestamp.

example:

```text
2h 30m
```

should become a deterministic numeric duration such as:

```text
9000 seconds
```

or another explicitly documented unit.

time calculations must not depend on browser locale.

---

# 20. currency

supported currencies:

```text
USD
GBP
INR
```

do not hardcode:

```text
$
£
₹
```

throughout the application.

use a currency formatter.

currency belongs to the relevant financial object.

do not silently convert currencies.

v1 does not implement exchange rates.

---

# 21. date handling

distinguish:

```text
date
timestamp
duration
```

examples:

```text
due_date
    -> date

created_at
    -> timestamp

tracked_duration
    -> duration
```

do not convert date-only values into timestamps unless necessary.

display dates consistently according to user preferences.

---

# 22. deletion

do not casually cascade-delete valuable data.

for projects:

prefer archive.

for clients:

prevent deletion if active dependencies make deletion ambiguous.

for tasks/comments:

normal deletion is acceptable if no financial records depend on them.

financial records require additional care.

---

# 23. filesystem paths

project files are not uploaded.

store only:

```text
label
path
description
```

never read or recursively index an entire project directory simply to display it.

opening a filesystem path should be handled as a local capability where possible.

invalid paths should not crash the application.

---

# 24. pwa/offline requirements

the application must load its shell offline.

domain data must remain accessible locally.

do not create an architecture where the app is technically "offline-capable" but immediately fails because a remote api cannot be reached.

if the chosen architecture requires a local backend process, document that clearly.

do not pretend a local backend is equivalent to browser-only offline functionality.

---

# 25. ui philosophy

the interface is intentionally minimal.

visual hierarchy should come from:

```text
typography
spacing
alignment
whitespace
subtle borders
small progress indicators
```

not:

```text
gradients
cards
shadows
illustrations
3d
webgl
glass
neon
```

---

# 26. visual rules

default palette should remain close to:

```text
black
white
gray
```

color may be used sparingly for semantic states.

do not create a rainbow status system.

avoid:

```text
green card
blue card
yellow card
purple card
pink card
```

for every piece of information.

---

# 27. typography

typography is a primary visual component.

establish:

* clear display hierarchy
* readable body text
* compact metadata
* consistent line heights
* predictable spacing

avoid using font size alone to create visual noise.

do not use ten different text styles.

---

# 28. layout

prefer whitespace.

do not fill empty space merely because it exists.

a page can intentionally contain only:

```text
heading

short metadata

one primary action

content
```

this is preferable to a grid of decorative cards.

---

# 29. animation

animation must communicate state.

allowed:

```text
hover
focus
pressed
menu opening
modal opening
progress changes
dragging
```

keep transitions short.

respect:

```text
prefers-reduced-motion
```

never introduce animation simply because the page looks empty.

---

# 30. responsive ui

desktop is primary.

mobile must remain usable.

do not reduce desktop layouts until unreadable.

reorganize information when necessary.

example:

desktop:

```text
project | client | status | deadline | budget
```

mobile:

```text
project
client
status
deadline
budget
```

---

# 31. accessibility

every interactive element must be keyboard accessible.

use semantic html.

buttons must be buttons.

links must be links.

inputs need labels.

focus states must remain visible.

do not rely solely on hover.

do not rely solely on color.

---

# 32. command palette

implement:

```text
ctrl/cmd + k
```

commands should be typed and searchable.

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

do not make command execution dependent on ai.

---

# 33. keyboard shortcuts

only introduce shortcuts that are discoverable.

initial candidates:

```text
ctrl/cmd + k
/
esc
```

additional shortcuts may be added later.

do not create a keyboard shortcut for every action.

---

# 34. testing strategy

test business rules first.

minimum backend coverage:

```text
authentication
project creation
task state changes
progress calculation
time calculations
expense calculations
invoice calculations
currency handling
deletion/archive rules
```

frontend tests should cover:

* important user workflows
* form validation
* project interactions
* task interactions
* invoice rendering
* empty states
* error states

do not chase 100% coverage.

test behavior, not implementation details.

---

# 35. integration testing

include tests that verify:

```text
api
 ↓
domain logic
 ↓
database
```

for important workflows.

especially:

```text
create project
create tasks
complete tasks
calculate progress
log time
create invoice
calculate invoice
persist invoice
```

---

# 36. test data

provide deterministic development/test fixtures.

do not make developers manually create 20 records to inspect a screen.

fixtures should include:

```text
1 client
3 projects
multiple tasks
multiple milestones
time entries
expenses
invoice
```

development fixtures must be clearly separated from production data.

---

# 37. migrations

every schema change must have a migration.

never tell developers to manually edit sqlite tables.

migrations must be:

* deterministic
* versioned
* reversible where practical
* tested

---

# 38. logging

logs should help diagnose actual failures.

include useful context:

```text
operation
resource
identifier
error
duration where useful
```

never log:

* passwords
* auth secrets
* session secrets
* sensitive credentials

avoid noisy debug logging in production builds.

---

# 39. errors

never silently swallow errors.

bad:

```ts
try {
  await save()
} catch {}
```

good:

```text
capture
log where appropriate
show useful user-facing message
preserve application state
```

the user should understand what happened.

---

# 40. loading states

every data-driven screen needs:

```text
loading
empty
error
success
```

do not show a blank page while data loads.

do not use a giant loading spinner for a tiny operation.

prefer local loading indicators.

---

# 41. forms

forms should:

* validate early where useful
* validate definitively on the backend
* preserve user input after recoverable errors
* identify the invalid field
* avoid unnecessary modal nesting

do not clear a form after a failed submission.

---

# 42. destructive actions

confirm meaningful destructive actions.

confirmation text should describe the consequence.

bad:

```text
are you sure?
```

better:

```text
archive "website redesign"?

the project will disappear from active projects but its tasks, time and invoices will remain accessible.
```

---

# 43. accessibility of financial data

financial values should be visually clear.

do not rely only on color for:

```text
paid
overdue
unpaid
```

include textual state.

---

# 44. security

even though the application is local, treat it as a real application.

requirements:

* secure password hashing
* input validation
* parameterized queries/orm
* no secrets in source
* no passwords in logs
* safe file path handling
* csrf consideration where applicable
* secure auth/session handling
* dependency updates
* no arbitrary command execution from user input

filesystem path opening must not turn into arbitrary shell execution.

---

# 45. dependency policy

before adding a dependency:

```text
why is it needed?
what does it replace?
is it maintained?
what is its license?
what is its bundle/runtime cost?
```

avoid dependencies that solve trivial problems.

do not install an entire framework to solve one helper function.

---

# 46. documentation

maintain:

```text
README.md
PROJECT.md
AGENTS.md
```

README should explain:

* what the project is
* how to run it
* prerequisites
* development commands
* database setup
* test commands
* build commands

do not duplicate the entire product specification in README.

---

# 47. implementation workflow

for every feature:

## step 1

read `project.md`.

## step 2

identify:

* affected domain entities
* database changes
* api changes
* ui changes
* tests

## step 3

implement database/migration.

## step 4

implement domain/business logic.

## step 5

implement api.

## step 6

implement frontend.

## step 7

add tests.

## step 8

run lint/type checks/tests.

## step 9

manually inspect the affected ui.

## step 10

remove unnecessary complexity.

---

# 48. do not overbuild

before implementing something, classify it:

```text
required
useful
future
unnecessary
```

only `required` should block the current milestone.

`useful` can be considered after the milestone.

`future` goes into documentation only.

`unnecessary` is rejected.

---

# 49. no speculative infrastructure

do not implement:

```text
event bus
message broker
redis
kafka
websocket server
notification service
microservices
kubernetes
cloud storage
external queues
```

unless the current product requirement demonstrably requires it.

this is a local application.

a sqlite transaction is preferable to a distributed system.

---

# 50. no premature postgres

sqlite is intentional.

do not migrate to postgres because:

```text
"postgres is more production grade"
```

the application is local and single-user.

if a postgres migration becomes necessary later, the domain layer and repository boundaries should make the transition manageable.

---

# 51. no fake enterprise architecture

do not create:

```text
api gateway
service mesh
repository microservice
auth service
billing service
notification service
```

for a local freelancer application.

one application is enough.

---

# 52. code quality

prefer:

```text
small functions
explicit dependencies
typed interfaces
clear naming
predictable control flow
domain-oriented modules
```

avoid:

```text
giant components
magic strings
duplicated business rules
implicit globals
deep nesting
untyped api responses
```

---

# 53. naming

use descriptive names.

bad:

```text
data
item
thing
obj
res
tmp
misc
```

good:

```text
project
client
invoice
timeEntry
invoiceItem
```

database naming should follow one consistent convention.

do not mix:

```text
createdAt
created_at
created-date
```

choose one convention per layer and document conversions where needed.

---

# 54. commit discipline

commits should represent coherent changes.

examples:

```text
feat: add client management
feat: add project milestones
feat: add manual time entries
feat: add invoice calculation
fix: prevent duplicate invoice numbers
test: cover project progress calculation
refactor: isolate invoice domain logic
```

do not make giant commits containing unrelated features.

---

# 55. milestone discipline

do not start the next phase until the current phase:

* works
* is tested
* has no known blocking bugs
* has acceptable ui
* has migrations
* has documentation where needed

do not accumulate unfinished half-features.

---

# 56. ui review checklist

after every significant frontend feature, inspect:

```text
does it look sparse?
does it have enough whitespace?
is the hierarchy obvious?
are there unnecessary cards?
are there unnecessary icons?
are labels clear?
does keyboard navigation work?
does mobile remain usable?
does the empty state look intentional?
does the loading state look intentional?
does the error state look intentional?
```

if the answer is no, fix the ui before adding more features.

---

# 57. financial review checklist

before considering financial functionality complete:

```text
currency stored explicitly
money stored as integer minor units
no floating-point money arithmetic
invoice totals calculated server-side
invoice numbers unique
tax calculation deterministic
discount calculation deterministic
rounding rules explicit
negative values validated
tests cover edge cases
```

test cases should include:

```text
0
0.01
large values
discounts
tax
multiple line items
empty invoice
different currencies
rounding boundaries
```

---

# 58. final definition of done

a feature is done only when:

```text
implementation complete
database migration complete
api complete
ui complete
validation complete
error handling complete
tests complete
loading state complete
empty state complete
responsive behavior checked
accessibility checked
lint passes
type checks pass
tests pass
no obvious dead code
no speculative infrastructure
```

---

# 59. agent behavior

when requirements are ambiguous:

1. inspect `project.md`
2. inspect existing implementation
3. prefer the simplest interpretation
4. do not invent major product behavior
5. ask only when the ambiguity materially changes architecture or user behavior

when encountering existing bad code:

* fix it if it is directly related to the current feature
* do not rewrite unrelated systems without reason
* document significant architectural changes

when encountering a tempting feature:

ask whether it exists in `project.md`.

if not, do not silently add it.

---

# 60. final principle

the product should feel like:

```text
less software
more signal
```

the implementation should follow the same principle.

the best architecture for this project is not the architecture with the most layers.

the best architecture is the smallest architecture that keeps:

```text
data correct
business rules explicit
ui clean
tests meaningful
future changes manageable
```

build the boring foundations properly.

then make the interface almost disappear.
