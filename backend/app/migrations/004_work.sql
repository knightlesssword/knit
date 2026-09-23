-- 004: phase 3 work items. milestones and tasks belong to one user and one
-- project; tasks may optionally belong to a milestone in the same project.
-- durations are integer seconds, never float. dates as YYYY-MM-DD text.
CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    description TEXT,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
    position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_milestones_user_id ON milestones (user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones (project_id);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
    milestone_id INTEGER REFERENCES milestones (id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date TEXT,
    estimated_duration_seconds INTEGER CHECK (estimated_duration_seconds IS NULL OR estimated_duration_seconds >= 0),
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks (milestone_id);
