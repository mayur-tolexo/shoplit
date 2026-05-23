# shoplit v1 — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the shoplit repo so both Go services (`shoplit-api` and `shoplit-redirect`) build, start, expose a `/health` endpoint backed by Postgres + Redis liveness, and pass green CI. No business logic yet — this is the deployable skeleton.

**Architecture:** Single Go module at `github.com/mayur-tolexo/shoplit`. Two binaries live under `cmd/`. Shared packages under `internal/`. Postgres schema managed by `golang-migrate`. Queries generated with `sqlc`. HTTP routing with `chi`. Tests use real Postgres via `testcontainers-go` and `miniredis` for Redis.

**Tech Stack:**
- Go 1.22+
- `github.com/jackc/pgx/v5` (Postgres driver + pool)
- `github.com/redis/go-redis/v9`
- `github.com/go-chi/chi/v5` (HTTP router)
- `github.com/golang-migrate/migrate/v4` (schema migrations)
- `github.com/sqlc-dev/sqlc` (typed queries; codegen)
- `github.com/stretchr/testify` (assertions)
- `github.com/testcontainers/testcontainers-go` and `.../modules/postgres`
- `github.com/alicebob/miniredis/v2`
- `github.com/caarlos0/env/v11` (env-var config loading)
- GitHub Actions for CI

---

## File structure produced by this plan

```
shoplit/
├── .github/
│   └── workflows/
│       └── ci.yml
├── cmd/
│   ├── shoplit-api/
│   │   └── main.go
│   └── shoplit-redirect/
│       └── main.go
├── internal/
│   ├── config/
│   │   ├── config.go
│   │   └── config_test.go
│   ├── db/
│   │   ├── conn.go
│   │   ├── conn_test.go
│   │   ├── migrate.go
│   │   ├── migrate_test.go
│   │   └── migrations/
│   │       ├── 0001_init.up.sql
│   │       └── 0001_init.down.sql
│   ├── redis/
│   │   ├── client.go
│   │   └── client_test.go
│   └── httpx/
│       ├── health.go
│       └── health_test.go
├── pkg/
│   └── testutil/
│       └── pg.go              # shared testcontainers helper
├── sqlc.yaml
├── Makefile
├── go.mod
├── go.sum
├── .env.example
├── .gitignore
├── .golangci.yml
└── README.md
```

---

## Task 1: Initialize Go module and `.gitignore`

**Files:**
- Create: `go.mod`
- Create: `.gitignore`

- [ ] **Step 1: Run go mod init**

```bash
cd /Users/mayurdas/Documents/projects/go/src/shoplit
go mod init github.com/mayur-tolexo/shoplit
```

Expected: creates `go.mod` declaring module `github.com/mayur-tolexo/shoplit` with `go 1.22` (or your installed Go version).

- [ ] **Step 2: Write `.gitignore`**

```gitignore
# binaries
/bin/
shoplit-api
shoplit-redirect

# env files
.env
.env.local

# editor
.vscode/
.idea/
*.swp
.DS_Store

# coverage
coverage.out
coverage.html

# generated (committed elsewhere; rules below cover regenerable artifacts)
```

- [ ] **Step 3: Commit**

```bash
git add go.mod .gitignore
git commit -m "chore: initialize go module and gitignore"
```

---

## Task 2: Create directory skeleton with placeholder files

**Files:**
- Create: `cmd/shoplit-api/.gitkeep`
- Create: `cmd/shoplit-redirect/.gitkeep`
- Create: `internal/config/.gitkeep`
- Create: `internal/db/migrations/.gitkeep`
- Create: `internal/redis/.gitkeep`
- Create: `internal/httpx/.gitkeep`
- Create: `pkg/testutil/.gitkeep`

- [ ] **Step 1: Create empty dirs with `.gitkeep`**

```bash
mkdir -p cmd/shoplit-api cmd/shoplit-redirect \
  internal/config internal/db/migrations internal/redis internal/httpx \
  pkg/testutil
touch cmd/shoplit-api/.gitkeep cmd/shoplit-redirect/.gitkeep \
  internal/config/.gitkeep internal/db/migrations/.gitkeep \
  internal/redis/.gitkeep internal/httpx/.gitkeep \
  pkg/testutil/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add cmd internal pkg
git commit -m "chore: scaffold directory layout"
```

---

## Task 3: Add `.env.example` documenting all env vars

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Write the file**

```bash
# ─── shared ────────────────────────────────────────────────────────────
# DSN for shoplit-api (full read/write owner)
SHOPLIT_DB_DSN=postgres://shoplit:shoplit@localhost:5432/shoplit?sslmode=disable
# DSN for shoplit-redirect (read-only role on links + relevant tables)
SHOPLIT_DB_DSN_READONLY=postgres://shoplit_ro:shoplit_ro@localhost:5432/shoplit?sslmode=disable

SHOPLIT_REDIS_URL=redis://localhost:6379/0

# Logging: debug | info | warn | error
SHOPLIT_LOG_LEVEL=info
# Environment label used in health output: dev | staging | prod
SHOPLIT_ENV=dev

# ─── shoplit-api ───────────────────────────────────────────────────────
SHOPLIT_API_ADDR=:8080

# ─── shoplit-redirect ──────────────────────────────────────────────────
SHOPLIT_REDIRECT_ADDR=:8081
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add .env.example"
```

---

## Task 4: Add `Makefile`

**Files:**
- Create: `Makefile`

- [ ] **Step 1: Write the Makefile**

```makefile
.PHONY: help build test lint run-api run-redirect migrate-up migrate-down sqlc install-tools

GO ?= go

# Pinned tool versions. Installed via `make install-tools` once per dev machine.
MIGRATE_VERSION   = v4.17.1
SQLC_VERSION      = v1.26.0
GOLANGCI_VERSION  = v1.59.1

help:
	@grep -E '^[a-zA-Z_-]+:.*?## ' Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "%-20s %s\n", $$1, $$2}'

install-tools: ## Install migrate, sqlc, golangci-lint at pinned versions
	$(GO) install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@$(MIGRATE_VERSION)
	$(GO) install github.com/sqlc-dev/sqlc/cmd/sqlc@$(SQLC_VERSION)
	$(GO) install github.com/golangci/golangci-lint/cmd/golangci-lint@$(GOLANGCI_VERSION)

build: ## Build both binaries
	$(GO) build -o bin/shoplit-api ./cmd/shoplit-api
	$(GO) build -o bin/shoplit-redirect ./cmd/shoplit-redirect

test: ## Run all tests
	$(GO) test ./... -race -count=1

lint: ## Run golangci-lint (requires `make install-tools` first)
	golangci-lint run ./...

run-api: ## Run shoplit-api locally (needs .env loaded)
	$(GO) run ./cmd/shoplit-api

run-redirect: ## Run shoplit-redirect locally
	$(GO) run ./cmd/shoplit-redirect

migrate-up: ## Apply all up migrations (requires `make install-tools` first)
	migrate -path internal/db/migrations -database "$(SHOPLIT_DB_DSN)" up

migrate-down: ## Roll back one migration
	migrate -path internal/db/migrations -database "$(SHOPLIT_DB_DSN)" down 1

sqlc: ## Regenerate sqlc code (requires `make install-tools` first)
	sqlc generate
```

- [ ] **Step 2: Commit**

```bash
git add Makefile
git commit -m "chore: add Makefile"
```

---

## Task 5: Add `internal/config` package with env-var loader

**Files:**
- Create: `internal/config/config.go`
- Create: `internal/config/config_test.go`
- Modify: `go.mod` (add `github.com/caarlos0/env/v11`)

- [ ] **Step 1: Add the dependency**

```bash
go get github.com/caarlos0/env/v11
```

- [ ] **Step 2: Write the failing test**

```go
// internal/config/config_test.go
package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoad_AppliesDefaults(t *testing.T) {
	t.Setenv("SHOPLIT_DB_DSN", "postgres://x")
	t.Setenv("SHOPLIT_DB_DSN_READONLY", "postgres://y")
	t.Setenv("SHOPLIT_REDIS_URL", "redis://localhost:6379/0")

	cfg, err := Load()
	require.NoError(t, err)

	assert.Equal(t, "dev", cfg.Env)
	assert.Equal(t, "info", cfg.LogLevel)
	assert.Equal(t, ":8080", cfg.APIAddr)
	assert.Equal(t, ":8081", cfg.RedirectAddr)
	assert.Equal(t, "postgres://x", cfg.DBDSN)
	assert.Equal(t, "postgres://y", cfg.DBDSNReadOnly)
	assert.Equal(t, "redis://localhost:6379/0", cfg.RedisURL)
}

func TestLoad_RequiresMandatory(t *testing.T) {
	// no env vars set
	_, err := Load()
	require.Error(t, err)
}
```

- [ ] **Step 3: Run test, see it fail**

Run: `go test ./internal/config/... -run TestLoad -v`
Expected: FAIL — `Load` is not defined.

- [ ] **Step 4: Write the minimal implementation**

```go
// internal/config/config.go
package config

import (
	"fmt"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	Env      string `env:"SHOPLIT_ENV" envDefault:"dev"`
	LogLevel string `env:"SHOPLIT_LOG_LEVEL" envDefault:"info"`

	DBDSN         string `env:"SHOPLIT_DB_DSN,required"`
	DBDSNReadOnly string `env:"SHOPLIT_DB_DSN_READONLY,required"`
	RedisURL      string `env:"SHOPLIT_REDIS_URL,required"`

	APIAddr      string `env:"SHOPLIT_API_ADDR" envDefault:":8080"`
	RedirectAddr string `env:"SHOPLIT_REDIRECT_ADDR" envDefault:":8081"`
}

func Load() (*Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}
	return &c, nil
}
```

- [ ] **Step 5: Run test, see it pass**

Run: `go test ./internal/config/... -v`
Expected: PASS for both tests.

- [ ] **Step 6: Commit**

```bash
git add go.mod go.sum internal/config
git commit -m "feat(config): env-var config loader with defaults"
```

---

## Task 6: Add Postgres testcontainer helper

This helper is used by every package that needs a real Postgres in tests. Building it once here keeps later tasks tight.

**Files:**
- Create: `pkg/testutil/pg.go`
- Modify: `go.mod` (testcontainers + pgx)

- [ ] **Step 1: Add dependencies**

```bash
go get github.com/jackc/pgx/v5
go get github.com/testcontainers/testcontainers-go
go get github.com/testcontainers/testcontainers-go/modules/postgres
go get github.com/stretchr/testify
```

- [ ] **Step 2: Write the helper**

```go
// pkg/testutil/pg.go
// Package testutil provides shared test helpers. Functions here are only used
// from _test.go files but live in a non-_test file so multiple packages can
// import them.
package testutil

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

// NewPostgres spins up a throw-away Postgres 16 container and returns a
// connection pool plus the DSN. The container is terminated via t.Cleanup.
func NewPostgres(t *testing.T) (*pgxpool.Pool, string) {
	t.Helper()
	ctx := context.Background()

	c, err := postgres.Run(ctx,
		"postgres:16-alpine",
		postgres.WithDatabase("shoplit_test"),
		postgres.WithUsername("test"),
		postgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	require.NoError(t, err)
	t.Cleanup(func() { _ = c.Terminate(context.Background()) })

	dsn, err := c.ConnectionString(ctx, "sslmode=disable")
	require.NoError(t, err)

	pool, err := pgxpool.New(ctx, dsn)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	require.NoError(t, pool.Ping(ctx))
	return pool, dsn
}
```

- [ ] **Step 3: Verify it compiles**

```bash
go build ./pkg/testutil/...
```

Expected: no output. (No test for this file directly; later tests exercise it.)

- [ ] **Step 4: Commit**

```bash
git add go.mod go.sum pkg/testutil
git commit -m "test: add pg testcontainers helper"
```

---

## Task 7: Add `internal/db` connection package

**Files:**
- Create: `internal/db/conn.go`
- Create: `internal/db/conn_test.go`

- [ ] **Step 1: Write the failing test**

```go
// internal/db/conn_test.go
package db_test

import (
	"context"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/db"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpen_PingsSuccessfully(t *testing.T) {
	_, dsn := testutil.NewPostgres(t)

	pool, err := db.Open(context.Background(), dsn)
	require.NoError(t, err)
	defer pool.Close()

	assert.NoError(t, pool.Ping(context.Background()))
}

func TestOpen_ReturnsErrorOnBadDSN(t *testing.T) {
	_, err := db.Open(context.Background(), "postgres://nope:nope@127.0.0.1:1/none?sslmode=disable&connect_timeout=1")
	require.Error(t, err)
}
```

- [ ] **Step 2: Run test, see it fail**

Run: `go test ./internal/db/... -run TestOpen -v`
Expected: FAIL — `db.Open` not defined.

- [ ] **Step 3: Write the implementation**

```go
// internal/db/conn.go
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Open returns a connection pool to the given Postgres DSN. The pool is
// validated with a Ping before being returned; callers should defer Close.
func Open(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("db: parse dsn: %w", err)
	}
	cfg.MaxConns = 10
	cfg.MinConns = 1
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("db: new pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db: ping: %w", err)
	}
	return pool, nil
}
```

- [ ] **Step 4: Run tests, see them pass**

Run: `go test ./internal/db/... -run TestOpen -v`
Expected: PASS for both tests.

- [ ] **Step 5: Commit**

```bash
git add internal/db/conn.go internal/db/conn_test.go
git commit -m "feat(db): postgres connection pool with health-check ping"
```

---

## Task 8: Write initial schema migration `0001_init`

**Files:**
- Create: `internal/db/migrations/0001_init.up.sql`
- Create: `internal/db/migrations/0001_init.down.sql`

- [ ] **Step 1: Write the up migration**

```sql
-- internal/db/migrations/0001_init.up.sql

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  email           CITEXT UNIQUE,
  phone           TEXT UNIQUE,
  google_sub      TEXT UNIQUE,
  display_name    TEXT NOT NULL,
  avatar_url      TEXT,
  handle          CITEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  banned_at       TIMESTAMPTZ
);

CREATE TABLE carts (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  slug            CITEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT,
  cover_image_url TEXT,
  is_public       BOOLEAN NOT NULL DEFAULT true,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX carts_user_idx ON carts(user_id) WHERE archived_at IS NULL;

CREATE TABLE links (
  id              BIGSERIAL PRIMARY KEY,
  slug            CITEXT NOT NULL UNIQUE,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  original_url    TEXT NOT NULL,
  retailer        TEXT NOT NULL,
  link_type       TEXT NOT NULL,
  cart_id         BIGINT REFERENCES carts(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at     TIMESTAMPTZ,
  CONSTRAINT cart_required_for_in_cart CHECK (
    (link_type = 'single' AND cart_id IS NULL) OR
    (link_type = 'in_cart' AND cart_id IS NOT NULL)
  )
);
CREATE INDEX links_user_idx ON links(user_id);
CREATE INDEX links_cart_idx ON links(cart_id);

CREATE TABLE cart_items (
  id              BIGSERIAL PRIMARY KEY,
  cart_id         BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  position        INT NOT NULL,
  link_id         BIGINT NOT NULL REFERENCES links(id),
  title           TEXT NOT NULL,
  description     TEXT,
  image_url       TEXT,
  price_text      TEXT,
  retailer        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cart_id, position)
);
CREATE INDEX cart_items_cart_idx ON cart_items(cart_id);

CREATE TABLE click_events (
  id              BIGSERIAL PRIMARY KEY,
  link_id         BIGINT NOT NULL REFERENCES links(id),
  occurred_at     TIMESTAMPTZ NOT NULL,
  country_code    TEXT,
  user_agent_kind TEXT,
  referer_host    TEXT
);
CREATE INDEX click_events_link_time ON click_events(link_id, occurred_at);

CREATE TABLE click_daily (
  link_id         BIGINT NOT NULL REFERENCES links(id),
  day             DATE NOT NULL,
  clicks          INT NOT NULL,
  PRIMARY KEY (link_id, day)
);

CREATE TABLE cart_views_daily (
  cart_id         BIGINT NOT NULL REFERENCES carts(id),
  day             DATE NOT NULL,
  views           INT NOT NULL,
  PRIMARY KEY (cart_id, day)
);

CREATE TABLE otp_attempts (
  id              BIGSERIAL PRIMARY KEY,
  phone           TEXT NOT NULL,
  ip              INET NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at     TIMESTAMPTZ
);
CREATE INDEX otp_attempts_phone_time ON otp_attempts(phone, sent_at DESC);
```

- [ ] **Step 2: Write the down migration**

```sql
-- internal/db/migrations/0001_init.down.sql

DROP TABLE IF EXISTS otp_attempts;
DROP TABLE IF EXISTS cart_views_daily;
DROP TABLE IF EXISTS click_daily;
DROP TABLE IF EXISTS click_events;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS links;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS users;
DROP EXTENSION IF EXISTS citext;
```

- [ ] **Step 3: Commit**

```bash
git add internal/db/migrations
git commit -m "feat(db): initial schema migration (0001_init)"
```

---

## Task 9: Add migration runner with integration test

**Files:**
- Create: `internal/db/migrate.go`
- Create: `internal/db/migrate_test.go`

- [ ] **Step 1: Add dependencies**

```bash
go get github.com/golang-migrate/migrate/v4
go get github.com/golang-migrate/migrate/v4/database/postgres
go get github.com/golang-migrate/migrate/v4/source/file
```

- [ ] **Step 2: Write the failing test**

```go
// internal/db/migrate_test.go
package db_test

import (
	"context"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/db"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigrateUp_CreatesAllTables(t *testing.T) {
	pool, dsn := testutil.NewPostgres(t)

	require.NoError(t, db.MigrateUp(dsn, "./migrations"))

	expected := []string{
		"users", "carts", "links", "cart_items",
		"click_events", "click_daily", "cart_views_daily", "otp_attempts",
	}
	for _, table := range expected {
		var exists bool
		err := pool.QueryRow(context.Background(),
			`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
			table,
		).Scan(&exists)
		require.NoError(t, err)
		assert.True(t, exists, "table %s should exist after migrate up", table)
	}
}

func TestMigrateUp_IsIdempotent(t *testing.T) {
	_, dsn := testutil.NewPostgres(t)

	require.NoError(t, db.MigrateUp(dsn, "./migrations"))
	require.NoError(t, db.MigrateUp(dsn, "./migrations"), "second up should be a no-op")
}
```

- [ ] **Step 3: Run, see it fail**

Run: `go test ./internal/db/... -run TestMigrate -v`
Expected: FAIL — `db.MigrateUp` not defined.

- [ ] **Step 4: Write the implementation**

```go
// internal/db/migrate.go
package db

import (
	"errors"
	"fmt"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// MigrateUp applies all pending up migrations from migrationsDir. It is a
// no-op when the database is already at the latest version.
func MigrateUp(dsn, migrationsDir string) error {
	abs, err := filepath.Abs(migrationsDir)
	if err != nil {
		return fmt.Errorf("migrate: abs path: %w", err)
	}
	m, err := migrate.New("file://"+abs, dsn)
	if err != nil {
		return fmt.Errorf("migrate: new: %w", err)
	}
	defer func() { _, _ = m.Close() }()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate: up: %w", err)
	}
	return nil
}
```

- [ ] **Step 5: Run tests, see them pass**

Run: `go test ./internal/db/... -v`
Expected: PASS for all `TestMigrate*` and `TestOpen*` tests.

- [ ] **Step 6: Commit**

```bash
git add go.mod go.sum internal/db/migrate.go internal/db/migrate_test.go
git commit -m "feat(db): migration runner with idempotency test"
```

---

## Task 10: Set up `sqlc` configuration (empty queries file)

We're not generating any queries yet, but wiring sqlc now means later tasks can just add `.sql` files.

**Files:**
- Create: `sqlc.yaml`
- Create: `internal/db/queries.sql`
- Create: `internal/db/sqlc/` (will be generated; add `.gitkeep` for now)

- [ ] **Step 1: Write `sqlc.yaml`**

```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "internal/db/queries.sql"
    schema: "internal/db/migrations"
    gen:
      go:
        package: "sqlcgen"
        out: "internal/db/sqlc"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_prepared_queries: false
        emit_interface: true
```

- [ ] **Step 2: Write a stub `queries.sql`**

```sql
-- internal/db/queries.sql
-- Real queries will be added in later plans. sqlc needs at least one entry
-- to generate, so we register a trivial one.

-- name: PingNow :one
SELECT now() AS now;
```

- [ ] **Step 3: Run sqlc generate**

```bash
make sqlc
```

Expected: generates `internal/db/sqlc/db.go`, `internal/db/sqlc/models.go`, `internal/db/sqlc/queries.sql.go`.

- [ ] **Step 4: Verify it builds**

```bash
go build ./...
```

Expected: no output (no compile errors).

- [ ] **Step 5: Commit**

```bash
git add sqlc.yaml internal/db/queries.sql internal/db/sqlc go.mod go.sum
git commit -m "feat(db): sqlc setup with stub query"
```

---

## Task 11: Add `internal/redis` client package

**Files:**
- Create: `internal/redis/client.go`
- Create: `internal/redis/client_test.go`

- [ ] **Step 1: Add dependencies**

```bash
go get github.com/redis/go-redis/v9
go get github.com/alicebob/miniredis/v2
```

- [ ] **Step 2: Write the failing test**

```go
// internal/redis/client_test.go
package redis_test

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/mayur-tolexo/shoplit/internal/redis"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpen_PingsSuccessfully(t *testing.T) {
	mr := miniredis.RunT(t)
	url := "redis://" + mr.Addr() + "/0"

	client, err := redis.Open(context.Background(), url)
	require.NoError(t, err)
	defer client.Close()

	require.NoError(t, client.Ping(context.Background()).Err())
}

func TestOpen_RoundTripsAValue(t *testing.T) {
	mr := miniredis.RunT(t)
	url := "redis://" + mr.Addr() + "/0"
	ctx := context.Background()

	client, err := redis.Open(ctx, url)
	require.NoError(t, err)
	defer client.Close()

	require.NoError(t, client.Set(ctx, "k", "v", 0).Err())
	got, err := client.Get(ctx, "k").Result()
	require.NoError(t, err)
	assert.Equal(t, "v", got)
}

func TestOpen_ReturnsErrorOnBadURL(t *testing.T) {
	_, err := redis.Open(context.Background(), "not-a-url")
	require.Error(t, err)
}
```

- [ ] **Step 3: Run, see it fail**

Run: `go test ./internal/redis/... -v`
Expected: FAIL — `redis.Open` not defined.

- [ ] **Step 4: Write the implementation**

```go
// internal/redis/client.go
// Package redis wraps go-redis with a thin opener used by both shoplit
// services. Returning the underlying *redis.Client lets call sites use the
// full go-redis API without an extra abstraction layer.
package redis

import (
	"context"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

type Client = goredis.Client

// Open parses the URL, builds a client, and verifies it with a Ping.
func Open(ctx context.Context, url string) (*Client, error) {
	opts, err := goredis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("redis: parse url: %w", err)
	}
	opts.DialTimeout = 3 * time.Second
	opts.ReadTimeout = 2 * time.Second
	opts.WriteTimeout = 2 * time.Second

	c := goredis.NewClient(opts)

	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err := c.Ping(pingCtx).Err(); err != nil {
		_ = c.Close()
		return nil, fmt.Errorf("redis: ping: %w", err)
	}
	return c, nil
}
```

- [ ] **Step 5: Run tests, see them pass**

Run: `go test ./internal/redis/... -v`
Expected: PASS for all three tests.

- [ ] **Step 6: Commit**

```bash
git add go.mod go.sum internal/redis
git commit -m "feat(redis): client opener with miniredis tests"
```

---

## Task 12: Add `internal/httpx` health-check handler

**Files:**
- Create: `internal/httpx/health.go`
- Create: `internal/httpx/health_test.go`

- [ ] **Step 1: Write the failing test**

```go
// internal/httpx/health_test.go
package httpx_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/mayur-tolexo/shoplit/internal/httpx"
	rediscli "github.com/mayur-tolexo/shoplit/internal/redis"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealth_ReturnsOKWhenDepsHealthy(t *testing.T) {
	pool, _ := testutil.NewPostgres(t)
	mr := miniredis.RunT(t)
	rc, err := rediscli.Open(context.Background(), "redis://"+mr.Addr()+"/0")
	require.NoError(t, err)

	h := httpx.Health(pool, rc, "test")
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	h.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)

	var body struct {
		Status  string `json:"status"`
		DB      string `json:"db"`
		Redis   string `json:"redis"`
		Env     string `json:"env"`
	}
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
	assert.Equal(t, "ok", body.Status)
	assert.Equal(t, "ok", body.DB)
	assert.Equal(t, "ok", body.Redis)
	assert.Equal(t, "test", body.Env)
}

func TestHealth_FailsWhenRedisDown(t *testing.T) {
	pool, _ := testutil.NewPostgres(t)
	mr := miniredis.RunT(t)
	rc, err := rediscli.Open(context.Background(), "redis://"+mr.Addr()+"/0")
	require.NoError(t, err)
	mr.Close()

	h := httpx.Health(pool, rc, "test")
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	h.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusServiceUnavailable, rr.Code)
}
```

- [ ] **Step 3: Run, see it fail**

Run: `go test ./internal/httpx/... -v`
Expected: FAIL — `httpx.Health` not defined.

- [ ] **Step 4: Write the implementation**

```go
// internal/httpx/health.go
// Package httpx holds HTTP helpers shared by both Go services.
package httpx

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"
)

type healthResponse struct {
	Status string `json:"status"`
	DB     string `json:"db"`
	Redis  string `json:"redis"`
	Env    string `json:"env"`
}

// Health returns an http.Handler that pings the DB and Redis. Returns 200
// when both respond inside the timeout, 503 otherwise. The response body
// names each dependency so an operator can see which one is degraded.
func Health(pool *pgxpool.Pool, redis *goredis.Client, env string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		resp := healthResponse{Status: "ok", Env: env}
		code := http.StatusOK

		if err := pool.Ping(ctx); err != nil {
			resp.DB = "fail: " + err.Error()
			resp.Status = "degraded"
			code = http.StatusServiceUnavailable
		} else {
			resp.DB = "ok"
		}

		if err := redis.Ping(ctx).Err(); err != nil {
			resp.Redis = "fail: " + err.Error()
			resp.Status = "degraded"
			code = http.StatusServiceUnavailable
		} else {
			resp.Redis = "ok"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		_ = json.NewEncoder(w).Encode(resp)
	})
}
```

- [ ] **Step 5: Run tests, see them pass**

Run: `go test ./internal/httpx/... -v`
Expected: PASS for both tests.

- [ ] **Step 6: Commit**

```bash
git add go.mod go.sum internal/httpx
git commit -m "feat(httpx): /health handler pinging db and redis"
```

---

## Task 13: Implement `cmd/shoplit-api/main.go`

**Files:**
- Create: `cmd/shoplit-api/main.go`
- Delete: `cmd/shoplit-api/.gitkeep`

- [ ] **Step 1: Write main.go**

```go
// cmd/shoplit-api/main.go
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/mayur-tolexo/shoplit/internal/config"
	"github.com/mayur-tolexo/shoplit/internal/db"
	"github.com/mayur-tolexo/shoplit/internal/httpx"
	"github.com/mayur-tolexo/shoplit/internal/redis"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLevel(cfg.LogLevel),
	})))

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := db.Open(ctx, cfg.DBDSN)
	if err != nil {
		return err
	}
	defer pool.Close()

	rc, err := redis.Open(ctx, cfg.RedisURL)
	if err != nil {
		return err
	}
	defer rc.Close()

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	r.Method(http.MethodGet, "/health", httpx.Health(pool, rc, cfg.Env))

	srv := &http.Server{
		Addr:              cfg.APIAddr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		slog.Info("shoplit-api listening", "addr", cfg.APIAddr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("listen", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func parseLevel(s string) slog.Level {
	switch s {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
```

- [ ] **Step 2: Delete the placeholder gitkeep**

```bash
rm cmd/shoplit-api/.gitkeep
```

- [ ] **Step 3: Build it**

```bash
go build ./cmd/shoplit-api
```

Expected: produces `shoplit-api` binary in repo root.

- [ ] **Step 4: Smoke run** *(optional — needs running Postgres + Redis)*

```bash
SHOPLIT_DB_DSN="postgres://shoplit:shoplit@localhost:5432/shoplit?sslmode=disable" \
SHOPLIT_DB_DSN_READONLY="postgres://shoplit:shoplit@localhost:5432/shoplit?sslmode=disable" \
SHOPLIT_REDIS_URL="redis://localhost:6379/0" \
./shoplit-api
```

Then in another shell:
```bash
curl -i http://localhost:8080/health
```
Expected: HTTP 200 with JSON `{"status":"ok","db":"ok","redis":"ok","env":"dev"}`.

(Skip this step if you don't have Postgres + Redis locally — the unit + integration tests already cover the wiring.)

- [ ] **Step 5: Remove the binary from the repo** (we ignore `shoplit-api` in `.gitignore`)

```bash
rm -f shoplit-api
```

- [ ] **Step 6: Commit**

```bash
git add cmd/shoplit-api
git commit -m "feat(api): shoplit-api binary with /health"
```

---

## Task 14: Implement `cmd/shoplit-redirect/main.go`

**Files:**
- Create: `cmd/shoplit-redirect/main.go`
- Delete: `cmd/shoplit-redirect/.gitkeep`

- [ ] **Step 1: Write main.go**

```go
// cmd/shoplit-redirect/main.go
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/mayur-tolexo/shoplit/internal/config"
	"github.com/mayur-tolexo/shoplit/internal/db"
	"github.com/mayur-tolexo/shoplit/internal/httpx"
	"github.com/mayur-tolexo/shoplit/internal/redis"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLevel(cfg.LogLevel),
	})))

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// shoplit-redirect uses the read-only DSN — it only ever SELECTs.
	pool, err := db.Open(ctx, cfg.DBDSNReadOnly)
	if err != nil {
		return err
	}
	defer pool.Close()

	rc, err := redis.Open(ctx, cfg.RedisURL)
	if err != nil {
		return err
	}
	defer rc.Close()

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	r.Method(http.MethodGet, "/health", httpx.Health(pool, rc, cfg.Env))

	// /p/{slug} and /go/{slug} land here in a later plan.

	srv := &http.Server{
		Addr:              cfg.RedirectAddr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		slog.Info("shoplit-redirect listening", "addr", cfg.RedirectAddr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("listen", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func parseLevel(s string) slog.Level {
	switch s {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
```

- [ ] **Step 2: Delete the placeholder gitkeep**

```bash
rm cmd/shoplit-redirect/.gitkeep
```

- [ ] **Step 3: Build it**

```bash
go build ./cmd/shoplit-redirect
rm -f shoplit-redirect
```

Expected: builds clean.

- [ ] **Step 4: Commit**

```bash
git add cmd/shoplit-redirect
git commit -m "feat(redirect): shoplit-redirect binary with /health (read-only db)"
```

---

## Task 15: Add `golangci-lint` config and GitHub Actions CI

**Files:**
- Create: `.golangci.yml`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.golangci.yml`**

```yaml
run:
  timeout: 5m
  go: "1.22"

linters:
  disable-all: true
  enable:
    - govet
    - errcheck
    - staticcheck
    - unused
    - ineffassign
    - gosimple
    - gofmt
    - goimports
    - misspell

issues:
  exclude-rules:
    - path: _test\.go
      linters:
        - errcheck
```

- [ ] **Step 2: Write `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
          cache: true
      - name: Build
        run: make build
      - name: Test
        run: make test
        env:
          # CI Docker is available for testcontainers
          DOCKER_HOST: unix:///var/run/docker.sock

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
          cache: true
      - uses: golangci/golangci-lint-action@v6
        with:
          version: v1.59.1
```

- [ ] **Step 3: Verify locally that lint passes**

```bash
make lint
```

Expected: no findings. (If goimports/gofmt complains, run `gofmt -w .` and re-commit.)

- [ ] **Step 4: Verify locally that the full suite passes**

```bash
make test
```

Expected: every package green. testcontainers needs a running Docker daemon locally — start Docker Desktop or Colima before running.

- [ ] **Step 5: Commit**

```bash
git add .golangci.yml .github/workflows/ci.yml
git commit -m "ci: golangci-lint config and github actions workflow"
```

---

## Task 16: Add a developer-facing `README.md`

**Files:**
- Modify: `README.md` (currently contains only the GitHub-default content)

- [ ] **Step 1: Replace README contents**

```markdown
# shoplit

Build a curated cart of products from Amazon, Myntra, Nykaa and more, then share it with a short URL. Free and open-source.

## Status

v1 in development. See `docs/superpowers/specs/2026-05-23-shoplit-design.md` for the design spec and `docs/superpowers/plans/` for implementation plans.

## Local development

### Prerequisites

- Go 1.22+
- Docker (used for Postgres + tests)
- Make

### One-time setup: install dev tools

```bash
make install-tools
```

This installs pinned versions of `migrate`, `sqlc`, and `golangci-lint` into `$GOBIN`. Re-run only when versions in the Makefile change.

### Bring up local Postgres + Redis

```bash
docker run --rm -d --name shoplit-pg \
  -e POSTGRES_USER=shoplit -e POSTGRES_PASSWORD=shoplit -e POSTGRES_DB=shoplit \
  -p 5432:5432 postgres:16-alpine

docker run --rm -d --name shoplit-redis -p 6379:6379 redis:7-alpine
```

### Apply migrations

```bash
cp .env.example .env
export $(grep -v '^#' .env | xargs)
make migrate-up
```

### Run

```bash
make run-api       # listens on :8080
make run-redirect  # in another shell, listens on :8081
```

Sanity check:

```bash
curl -s localhost:8080/health | jq
curl -s localhost:8081/health | jq
```

### Tests

```bash
make test
```

Integration tests boot real Postgres containers via testcontainers; Docker must be running.

## Repo layout

```
cmd/
  shoplit-api/         creator API + dashboard backend
  shoplit-redirect/    /p and /go redirects, click tracking
internal/              shared packages
docs/superpowers/      specs and implementation plans
```

## License

TBD (intend MIT or Apache-2.0).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: developer-facing README"
```

---

## Task 17: Final verification

- [ ] **Step 1: Confirm a clean build from scratch**

```bash
make install-tools    # idempotent; skips packages already at the pinned version
go clean -testcache
make build
make test
make lint
```

Expected: build succeeds, all tests pass, lint clean.

- [ ] **Step 2: Confirm `go mod tidy` is a no-op**

```bash
go mod tidy
git diff -- go.mod go.sum
```

Expected: no diff.

- [ ] **Step 3: Push and verify CI**

```bash
git push origin main
```

Open the GitHub repo's Actions tab and confirm both `test` and `lint` jobs are green.

- [ ] **Step 4: Tag the milestone**

```bash
git tag -a v0.1.0-foundation -m "Plan 1: foundation complete"
git push origin v0.1.0-foundation
```

---

## What's next (Plan 2)

Plan 2 (Auth) will add:
- Google OAuth: `POST /auth/google` exchanges ID token for session JWT.
- Phone OTP: MSG91 client, `/auth/otp/send`, `/auth/otp/verify`, rate limits via Redis.
- JWT session middleware and `GET /me`.

Plan 2 is written after Plan 1 is executed, so it can reflect anything we learned during execution.
