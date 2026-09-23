-- down migration for 002 (reversible where practical).
DROP TABLE IF EXISTS clients;
DELETE FROM schema_migrations WHERE version = 2;
