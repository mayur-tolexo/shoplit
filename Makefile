.PHONY: help build test lint run-api run-redirect migrate-up migrate-down sqlc install-tools up up-infra down down-clean logs ps

GO ?= go

# Pinned tool versions. Installed via `make install-tools` once per dev machine.
MIGRATE_VERSION   = v4.19.1
SQLC_VERSION      = v1.31.1
GOLANGCI_VERSION  = v1.64.8

# Auto-load .env if present, so targets like run-api and migrate-up get the
# config without a manual `export $(grep ...)` step. Comments and box-drawing
# characters in .env are tolerated by make's `include` directive.
ifneq (,$(wildcard .env))
include .env
export
endif

help:
	@grep -E '^[a-zA-Z_-]+:.*?## ' Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "%-20s %s\n", $$1, $$2}'

install-tools: ## Install migrate, sqlc, golangci-lint at pinned versions
	$(GO) install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@$(MIGRATE_VERSION)
	$(GO) install github.com/sqlc-dev/sqlc/cmd/sqlc@$(SQLC_VERSION)
	$(GO) install github.com/golangci/golangci-lint/cmd/golangci-lint@$(GOLANGCI_VERSION)

up: build up-infra migrate-up ## ONE COMMAND (detached): build, infra, migrate, then run both go services in the background
	@./scripts/start.sh

up-infra: ## Start postgres + redis only (no go services, no migrations)
	docker compose up -d --wait

down: ## Stop everything: go services (via .pids/) + docker compose (keeps data volumes)
	@./scripts/stop.sh
	docker compose down

down-clean: ## Stop everything AND wipe data volumes (destroys local DB)
	@./scripts/stop.sh
	docker compose down -v

logs: ## Tail go service logs (Ctrl-C stops the tail, NOT the services)
	@mkdir -p .logs
	@touch .logs/api.log .logs/redirect.log
	tail -F .logs/api.log .logs/redirect.log

logs-infra: ## Tail postgres + redis logs from compose
	docker compose logs -f

ps: ## Show running shoplit processes (compose + go services)
	@docker compose ps
	@echo ""
	@if [ -f .pids/api.pid ] && kill -0 $$(cat .pids/api.pid) 2>/dev/null; then \
	  echo "shoplit-api      running (pid $$(cat .pids/api.pid))"; \
	else echo "shoplit-api      stopped"; fi
	@if [ -f .pids/redirect.pid ] && kill -0 $$(cat .pids/redirect.pid) 2>/dev/null; then \
	  echo "shoplit-redirect running (pid $$(cat .pids/redirect.pid))"; \
	else echo "shoplit-redirect stopped"; fi

build: ## Build both binaries
	$(GO) build -o bin/shoplit-api ./cmd/shoplit-api
	$(GO) build -o bin/shoplit-redirect ./cmd/shoplit-redirect

test: ## Run all tests
	$(GO) test ./... -race -count=1

lint: ## Run golangci-lint (requires `make install-tools` first)
	golangci-lint run ./...

run-api: ## Run shoplit-api locally (auto-loads .env)
	$(GO) run ./cmd/shoplit-api

run-redirect: ## Run shoplit-redirect locally (auto-loads .env)
	$(GO) run ./cmd/shoplit-redirect

migrate-up: ## Apply all up migrations (requires `make install-tools` first)
	migrate -path internal/db/migrations -database "$(SHOPLIT_DB_DSN)" up

migrate-down: ## Roll back one migration
	migrate -path internal/db/migrations -database "$(SHOPLIT_DB_DSN)" down 1

sqlc: ## Regenerate sqlc code (requires `make install-tools` first)
	sqlc generate
