-- 003: phase 2 projects. every row belongs to one user and one client;
-- all project endpoints filter by the authenticated user.
-- money in integer minor units, never float. dates as YYYY-MM-DD text.
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients (id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    description TEXT,
    notes TEXT,
    project_type TEXT NOT NULL CHECK (project_type IN ('fixed_price', 'hourly', 'retainer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed')),
    currency TEXT NOT NULL CHECK (currency IN ('USD', 'GBP', 'INR')),
    budget INTEGER CHECK (budget IS NULL OR budget >= 0),
    hourly_rate INTEGER CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
    fixed_price INTEGER CHECK (fixed_price IS NULL OR fixed_price >= 0),
    recurring_amount INTEGER CHECK (recurring_amount IS NULL OR recurring_amount >= 0),
    recurring_billing_period TEXT,
    start_date TEXT,
    due_date TEXT,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects (client_id);
