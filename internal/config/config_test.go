package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mustUnset(t *testing.T, keys ...string) {
	t.Helper()
	for _, k := range keys {
		original, hadIt := os.LookupEnv(k)
		os.Unsetenv(k)
		if hadIt {
			t.Cleanup(func() { os.Setenv(k, original) })
		} else {
			t.Cleanup(func() { os.Unsetenv(k) })
		}
	}
}

func TestLoad_AppliesDefaults(t *testing.T) {
	t.Setenv("SHOPLIT_DB_DSN", "postgres://x")
	t.Setenv("SHOPLIT_REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("SHOPLIT_SESSION_SECRET", "test-secret-do-not-use-in-prod")
	t.Setenv("GOOGLE_OAUTH_CLIENT_ID", "test-client-id")
	t.Setenv("GOOGLE_OAUTH_CLIENT_SECRET", "test-client-secret")

	cfg, err := Load()
	require.NoError(t, err)

	assert.Equal(t, "dev", cfg.Env)
	assert.Equal(t, "info", cfg.LogLevel)
	assert.Equal(t, ":8080", cfg.APIAddr)
	assert.Equal(t, ":8081", cfg.RedirectAddr)
	assert.Equal(t, "postgres://x", cfg.DBDSN)
	assert.Equal(t, "redis://localhost:6379/0", cfg.RedisURL)
	assert.Equal(t, "test-secret-do-not-use-in-prod", cfg.SessionSecret)
	assert.Equal(t, "http://localhost:8080/api/v1/auth/google/callback", cfg.GoogleOAuthRedirectURL)
	assert.Equal(t, "http://localhost:3000", cfg.CORSAllowedOrigin)
	assert.Equal(t, "http://localhost:3000", cfg.FrontendURL)
}

func TestLoad_RequiresMandatory(t *testing.T) {
	// Only DBDSN and RedisURL are hard-required. SessionSecret auto-generates
	// when unset; GoogleOAuth* are optional (handler returns 503 instead).
	t.Run("missing DBDSN", func(t *testing.T) {
		mustUnset(t, "SHOPLIT_DB_DSN")
		t.Setenv("SHOPLIT_REDIS_URL", "redis://x")
		_, err := Load()
		require.Error(t, err)
	})
	t.Run("missing RedisURL", func(t *testing.T) {
		t.Setenv("SHOPLIT_DB_DSN", "postgres://x")
		mustUnset(t, "SHOPLIT_REDIS_URL")
		_, err := Load()
		require.Error(t, err)
	})
}

func TestLoad_AutoGeneratesSessionSecret(t *testing.T) {
	t.Setenv("SHOPLIT_DB_DSN", "postgres://x")
	t.Setenv("SHOPLIT_REDIS_URL", "redis://x")
	mustUnset(t, "SHOPLIT_SESSION_SECRET")
	mustUnset(t, "GOOGLE_OAUTH_CLIENT_ID")
	mustUnset(t, "GOOGLE_OAUTH_CLIENT_SECRET")
	cfg, err := Load()
	require.NoError(t, err)
	assert.NotEmpty(t, cfg.SessionSecret)
	assert.Len(t, cfg.SessionSecret, 64) // 32 bytes hex-encoded
	assert.False(t, cfg.GoogleOAuthConfigured())
}

func TestLoad_DetectsGoogleOAuthConfigured(t *testing.T) {
	t.Setenv("SHOPLIT_DB_DSN", "postgres://x")
	t.Setenv("SHOPLIT_REDIS_URL", "redis://x")
	t.Setenv("GOOGLE_OAUTH_CLIENT_ID", "c")
	t.Setenv("GOOGLE_OAUTH_CLIENT_SECRET", "s")
	cfg, err := Load()
	require.NoError(t, err)
	assert.True(t, cfg.GoogleOAuthConfigured())
}
