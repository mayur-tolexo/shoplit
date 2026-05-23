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
	assert.Equal(t, "http://localhost:3000", cfg.FrontendURL)
}

func TestLoad_RequiresMandatory(t *testing.T) {
	t.Run("missing DBDSN", func(t *testing.T) {
		mustUnset(t, "SHOPLIT_DB_DSN")
		t.Setenv("SHOPLIT_REDIS_URL", "redis://x")
		t.Setenv("SHOPLIT_SESSION_SECRET", "s")
		t.Setenv("GOOGLE_OAUTH_CLIENT_ID", "c")
		t.Setenv("GOOGLE_OAUTH_CLIENT_SECRET", "s")
		_, err := Load()
		require.Error(t, err)
	})
	t.Run("missing SessionSecret", func(t *testing.T) {
		t.Setenv("SHOPLIT_DB_DSN", "postgres://x")
		t.Setenv("SHOPLIT_REDIS_URL", "redis://x")
		mustUnset(t, "SHOPLIT_SESSION_SECRET")
		t.Setenv("GOOGLE_OAUTH_CLIENT_ID", "c")
		t.Setenv("GOOGLE_OAUTH_CLIENT_SECRET", "s")
		_, err := Load()
		require.Error(t, err)
	})
	t.Run("missing GoogleOAuthClientID", func(t *testing.T) {
		t.Setenv("SHOPLIT_DB_DSN", "postgres://x")
		t.Setenv("SHOPLIT_REDIS_URL", "redis://x")
		t.Setenv("SHOPLIT_SESSION_SECRET", "s")
		mustUnset(t, "GOOGLE_OAUTH_CLIENT_ID")
		t.Setenv("GOOGLE_OAUTH_CLIENT_SECRET", "s")
		_, err := Load()
		require.Error(t, err)
	})
}
