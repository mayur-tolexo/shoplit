package config

import (
	"fmt"

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
	// `openssl rand -hex 32`. Used to HMAC-sign session and OAuth-state cookies.
	SessionSecret string `env:"SHOPLIT_SESSION_SECRET,required"`

	// Google OAuth 2.0 — create a client in https://console.cloud.google.com/.
	// See docs/superpowers/runbooks/google-oauth-setup.md.
	GoogleOAuthClientID     string `env:"GOOGLE_OAUTH_CLIENT_ID,required"`
	GoogleOAuthClientSecret string `env:"GOOGLE_OAUTH_CLIENT_SECRET,required"`
	GoogleOAuthRedirectURL  string `env:"GOOGLE_OAUTH_REDIRECT_URL" envDefault:"http://localhost:8080/api/v1/auth/google/callback"`

	// After successful sign-in, the OAuth callback redirects the browser to
	// this URL on the frontend.
	FrontendURL string `env:"SHOPLIT_FRONTEND_URL" envDefault:"http://localhost:3000"`
}

func Load() (*Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}
	return &c, nil
}
