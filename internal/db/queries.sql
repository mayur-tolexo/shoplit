-- internal/db/queries.sql
-- Real queries will be added in later plans. sqlc needs at least one entry
-- to generate, so we register a trivial one.

-- name: PingNow :one
SELECT now() AS now;
