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

	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/carts"
	"github.com/mayur-tolexo/shoplit/internal/config"
	"github.com/mayur-tolexo/shoplit/internal/db"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/mayur-tolexo/shoplit/internal/exttoken"
	"github.com/mayur-tolexo/shoplit/internal/feedback"
	"github.com/mayur-tolexo/shoplit/internal/httpx"
	"github.com/mayur-tolexo/shoplit/internal/mailer"
	"github.com/mayur-tolexo/shoplit/internal/ogfetch"
	"github.com/mayur-tolexo/shoplit/internal/publicapi"
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

	// Apply migrations on startup (dev convenience). In prod a dedicated
	// migrate job runs them and the binary ships without the migrations
	// directory, so SHOPLIT_AUTO_MIGRATE=false skips this.
	if cfg.AutoMigrate {
		if err := db.MigrateUp(cfg.DBDSN, "internal/db/migrations"); err != nil {
			return err
		}
	}

	q := sqlcgen.New(pool)
	mlr := mailer.NewResend(cfg.ResendAPIKey, cfg.FeedbackFrom)
	fb := feedback.NewService(q, mlr, cfg.FeedbackEmail)

	sm := auth.NewSessionManager(cfg.SessionSecret).
		WithSecure(cfg.CookieSecure).
		WithBearerResolver(exttoken.Resolver(q))

	rc, err := redis.Open(ctx, cfg.RedisURL)
	if err != nil {
		return err
	}
	defer rc.Close()
	upsert := auth.NewUserUpsertFn(q)
	fetcher := ogfetch.New(rc)
	svc := carts.NewService(q)

	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.Recoverer)
	r.Use(httpx.CORS(cfg.CORSAllowedOrigin))
	r.Method(http.MethodGet, "/health", httpx.Health(pool, rc, cfg.Env))

	// Auth endpoints (no middleware — these establish the session). Google
	// OAuth routes return 503 with a helpful message until GCP creds are
	// configured (see docs/superpowers/runbooks/google-oauth-setup.md).
	if cfg.GoogleOAuthConfigured() {
		oauthCfg := auth.GoogleConfig(cfg.GoogleOAuthClientID, cfg.GoogleOAuthClientSecret, cfg.GoogleOAuthRedirectURL)
		r.Get("/api/v1/auth/google", auth.HandleGoogleStart(oauthCfg, sm).ServeHTTP)
		r.Get("/api/v1/auth/google/callback",
			auth.HandleGoogleCallback(oauthCfg, sm, upsert, cfg.FrontendURL, auth.GoogleUserInfoURL).ServeHTTP)
	} else {
		notConfigured := func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "Google sign-in not configured on this server. See docs/superpowers/runbooks/google-oauth-setup.md.", http.StatusServiceUnavailable)
		}
		r.Get("/api/v1/auth/google", notConfigured)
		r.Get("/api/v1/auth/google/callback", notConfigured)
	}
	r.Post("/api/v1/auth/logout", auth.HandleLogout(sm).ServeHTTP)

	// Public, unauthenticated read endpoints
	r.Route("/api/public", func(r chi.Router) {
		publicapi.RegisterRoutes(r, svc)
		r.Post("/feedback", fb.Handler())
	})

	// Authenticated creator endpoints
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(sm.RequireUser())
		r.Post("/extension/token", exttoken.MintHandler(q))
		carts.RegisterRoutes(r, svc, fetcher)
	})

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
