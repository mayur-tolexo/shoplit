package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	Env      string `env:"SHOPLIT_ENV" envDefault:"dev"`
	LogLevel string `env:"SHOPLIT_LOG_LEVEL" envDefault:"info"`

	DBDSN         string `env:"SHOPLIT_DB_DSN,required"`
	DBDSNReadOnly string `env:"SHOPLIT_DB_DSN_READONLY"`
	RedisURL      string `env:"SHOPLIT_REDIS_URL,required"`

	APIAddr      string `env:"SHOPLIT_API_ADDR" envDefault:":8080"`
	RedirectAddr string `env:"SHOPLIT_REDIRECT_ADDR" envDefault:":8081"`

	// Session signing secret. Random 32+ bytes (hex/base64) — generate with
	// `openssl rand -hex 32`. If unset in dev, we auto-generate a per-process
	// random one so the binary boots; sessions then invalidate on every
	// restart. Production MUST set this explicitly.
	SessionSecret string `env:"SHOPLIT_SESSION_SECRET"`

	// CookieSecure marks session cookies Secure (HTTPS-only). false for local
	// dev over http; MUST be true in production (served over HTTPS) or browsers
	// silently drop the cookie.
	CookieSecure bool `env:"SHOPLIT_COOKIE_SECURE" envDefault:"false"`

	// AutoMigrate runs DB migrations from internal/db/migrations on startup.
	// Convenient in dev; set false in prod where a dedicated migrate job runs
	// them and the binary ships without the migrations directory.
	AutoMigrate bool `env:"SHOPLIT_AUTO_MIGRATE" envDefault:"true"`

	// Google OAuth 2.0 — create a client in https://console.cloud.google.com/.
	// See docs/superpowers/runbooks/google-oauth-setup.md.
	// Optional: if either is empty, the Google sign-in route returns 503 with
	// a friendly message. The rest of the app still boots so you can develop
	// other features without GCP setup.
	GoogleOAuthClientID     string `env:"GOOGLE_OAUTH_CLIENT_ID"`
	GoogleOAuthClientSecret string `env:"GOOGLE_OAUTH_CLIENT_SECRET"`
	// Redirect hits the backend directly (:8080) — this must EXACTLY match
	// the Authorized redirect URI registered in the GCP OAuth client. The
	// browser does the OAuth dance directly against the backend (full-page
	// navigation, not fetch), so the state + session cookies are set and read
	// by the same origin. CORS (see CORSAllowedOrigin) lets the frontend's
	// XHR calls reach the backend cross-origin with credentials.
	GoogleOAuthRedirectURL string `env:"GOOGLE_OAUTH_REDIRECT_URL" envDefault:"http://localhost:8080/api/v1/auth/google/callback"`

	// Resend (resend.com) API key for sending the feedback notification email.
	// Optional: if empty, feedback is still stored; the email is skipped (logged).
	ResendAPIKey string `env:"RESEND_API_KEY"`
	// Where feature-request notifications are sent, and the From line Resend uses.
	FeedbackEmail string `env:"SHOPLIT_FEEDBACK_EMAIL" envDefault:"mayur.das4@gmail.com"`
	FeedbackFrom  string `env:"SHOPLIT_FEEDBACK_FROM" envDefault:"shoplit <onboarding@resend.dev>"`
	// Comma-separated user IDs allowed to view the in-app feedback inbox.
	AdminUserIDs string `env:"SHOPLIT_ADMIN_USER_IDS" envDefault:"1"`

	// Origin allowed to make credentialed cross-origin requests to the API.
	// In dev this is the Next.js frontend.
	CORSAllowedOrigin string `env:"SHOPLIT_CORS_ORIGIN" envDefault:"http://localhost:3000"`

	// After successful sign-in, the OAuth callback redirects the browser to
	// this URL on the frontend.
	FrontendURL string `env:"SHOPLIT_FRONTEND_URL" envDefault:"http://localhost:3000"`

	// Directory where uploaded product/cover images are written and served
	// from (under /uploads). In prod this is a persistent Docker volume.
	UploadDir string `env:"SHOPLIT_UPLOAD_DIR" envDefault:"./uploads"`
}

// GoogleOAuthConfigured returns true only when both client id and secret are set.
// Handlers should check this before initiating the OAuth dance.
func (c *Config) GoogleOAuthConfigured() bool {
	return c.GoogleOAuthClientID != "" && c.GoogleOAuthClientSecret != ""
}

func Load() (*Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}
	if c.SessionSecret == "" {
		// Dev fallback so the binary boots without manual setup. Logs a
		// warning so production deploys can't silently regress.
		s, err := generateDevSecret()
		if err != nil {
			return nil, fmt.Errorf("config: auto-generate session secret: %w", err)
		}
		c.SessionSecret = s
		slog.Warn("SHOPLIT_SESSION_SECRET not set — generated a per-process secret. Sessions will invalidate on restart. Set the env var explicitly (e.g. `openssl rand -hex 32`) before deploying.")
	}
	if !c.GoogleOAuthConfigured() {
		slog.Warn("Google OAuth not configured (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET missing) — /api/v1/auth/google will return 503 until you complete docs/superpowers/runbooks/google-oauth-setup.md.")
	}
	return &c, nil
}

func generateDevSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
