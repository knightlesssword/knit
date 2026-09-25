-- down migration for 005 (reversible where practical).
DROP TABLE IF EXISTS time_entries;
DELETE FROM schema_migrations WHERE version = 5;
