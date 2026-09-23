-- down migration for 004 (reversible where practical). tasks first: they
-- reference milestones via ON DELETE SET NULL.
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS milestones;
DELETE FROM schema_migrations WHERE version = 4;
