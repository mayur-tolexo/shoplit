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

func TestLoad_RequiresMandatory(t *testing.T) {
	// Force required env vars to be unset so the test is deterministic
	// regardless of any externally inherited env vars.
	os.Unsetenv("SHOPLIT_DB_DSN")
	os.Unsetenv("SHOPLIT_DB_DSN_READONLY")
	os.Unsetenv("SHOPLIT_REDIS_URL")

	_, err := Load()
	require.Error(t, err)
}
