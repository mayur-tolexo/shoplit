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

### Configure environment

```bash
cp .env.example .env
```

The Makefile auto-loads `.env`, so subsequent `make` commands pick up the config without a manual `export`.

### Run the whole stack (one command, detached)

```bash
make up         # builds binaries, brings up postgres+redis, applies migrations,
                # then starts shoplit-api (:8080) and shoplit-redirect (:8081)
                # in the background. Returns to your prompt immediately.

make logs       # tail both go service logs (Ctrl-C stops the tail, not services)
make ps         # show what's running (compose + go services)
make down       # stop everything (go services + docker compose)
make down-clean # stop everything AND wipe the local database
```

PIDs are tracked in `.pids/`, logs in `.logs/` (both gitignored). Re-running `make up` stops the old binaries and starts fresh ones with the latest build. Containers: `shoplit-pg` on `:5433`, `shoplit-redis` on `:6379`. Data persists across `make down` / `make up` cycles; only `make down-clean` discards it.

### Lower-level targets (if you want finer control)

```bash
make up-infra      # only start postgres + redis, no migrations, no go services
make migrate-up    # apply pending migrations
make run-api       # run just shoplit-api on the host (foreground, blocks)
make run-redirect  # run just shoplit-redirect on the host (foreground, blocks)
make logs          # tail compose logs
make ps            # show compose service status
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
