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
	if cfg.DBDSNReadOnly == "" {
		return errors.New("SHOPLIT_DB_DSN_READONLY is required for shoplit-redirect")
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
