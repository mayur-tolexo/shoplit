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
