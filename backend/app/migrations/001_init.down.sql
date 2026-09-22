-- down migration for 001 (reversible where practical).
DROP TABLE IF EXISTS users;
DELETE FROM schema_migrations WHERE version = 1;
