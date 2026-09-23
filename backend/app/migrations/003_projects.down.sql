-- down migration for 003 (reversible where practical).
DROP TABLE IF EXISTS projects;
DELETE FROM schema_migrations WHERE version = 3;
