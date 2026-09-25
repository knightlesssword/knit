-- 005: phase 4 time tracking. every entry belongs to one user and one
-- project; the task link is optional but must stay inside the same project.
-- durations are integer seconds, never timestamps or floats.
-- entry_date is a YYYY-MM-DD date, never a timestamp.
CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
    task_id INTEGER REFERENCES tasks (id) ON DELETE RESTRICT,
    entry_date TEXT NOT NULL CHECK (length(entry_date) = 10),
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    description TEXT,
    billable INTEGER NOT NULL DEFAULT 1 CHECK (billable IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries (project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries (task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_entry_date ON time_entries (entry_date);
