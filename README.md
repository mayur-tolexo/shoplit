# shoplit

Build a curated cart of products from Amazon, Myntra, Nykaa and more, then share it with a short URL. Free and open-source.

## Status

v1 in development. See `docs/superpowers/specs/2026-05-23-shoplit-design.md` for the design spec and `docs/superpowers/plans/` for implementation plans.

## Local development

### Prerequisites

- Go 1.22+
- Node 20+ and pnpm 9+ (`corepack enable && corepack prepare pnpm@9 --activate`)
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
make up         # builds Go binaries, brings up postgres+redis, applies migrations,
                # then starts shoplit-api (:8080), shoplit-redirect (:8081),
                # AND shoplit-web (Next.js dev on :3000) in the background.
                # Returns to your prompt as soon as all three respond.

make logs       # tail all three service logs (Ctrl-C stops the tail, not services)
make ps         # show what's running (compose + go services + web)
make down       # stop everything (go services + web + docker compose)
make down-clean # stop everything AND wipe the local database
```

On first run, `make up` will also run `pnpm install` in `web/` (one-time, ~30s). Subsequent runs skip it.

PIDs are tracked in `.pids/`, logs in `.logs/` (both gitignored). Re-running `make up` stops the old processes and starts fresh ones. Containers: `shoplit-pg` on `:5433`, `shoplit-redis` on `:6379`. Data persists across `make down` / `make up` cycles; only `make down-clean` discards it.

Open the app in your browser at **http://localhost:3000**.

### Lower-level targets (if you want finer control)

```bash
make up-infra      # only start postgres + redis, no migrations, no services
make migrate-up    # apply pending migrations
make run-api       # run just shoplit-api on the host (foreground, blocks)
make run-redirect  # run just shoplit-redirect on the host (foreground, blocks)
make run-web       # run just the Next.js dev server (foreground, blocks)
make web-install   # install web/ deps (one-time; usually auto by make up)
make logs-infra    # tail compose logs (postgres + redis only)
```

Sanity check:

```bash
curl -s localhost:8080/health | jq      # shoplit-api
curl -s localhost:8081/health | jq      # shoplit-redirect
curl -s localhost:3000 | head -1        # shoplit-web (returns HTML)
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
internal/              shared Go packages
web/                   Next.js frontend (landing, dashboard, public cart pages)
docs/superpowers/      specs and implementation plans
scripts/               start.sh / stop.sh used by make up / make down
```

## License

TBD (intend MIT or Apache-2.0).
