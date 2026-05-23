package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoad_AppliesDefaults(t *testing.T) {
	t.Setenv("SHOPLIT_DB_DSN", "postgres://x")
	t.Setenv("SHOPLIT_DB_DSN_READONLY", "postgres://y")
	t.Setenv("SHOPLIT_REDIS_URL", "redis://localhost:6379/0")

	cfg, err := Load()
	require.NoError(t, err)

	assert.Equal(t, "dev", cfg.Env)
	assert.Equal(t, "info", cfg.LogLevel)
	assert.Equal(t, ":8080", cfg.APIAddr)
	assert.Equal(t, ":8081", cfg.RedirectAddr)
	assert.Equal(t, "postgres://x", cfg.DBDSN)
	assert.Equal(t, "postgres://y", cfg.DBDSNReadOnly)
	assert.Equal(t, "redis://localhost:6379/0", cfg.RedisURL)
}

// mustUnset clears the given env vars for the duration of the test and restores
// their original values (or removes them) when the test ends.
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

func TestLoad_RequiresMandatory(t *testing.T) {
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
