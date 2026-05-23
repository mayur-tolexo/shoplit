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
