package db_test

import (
	"context"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/db"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigrateUp_CreatesAllTables(t *testing.T) {
	pool, dsn := testutil.NewPostgres(t)

	require.NoError(t, db.MigrateUp(dsn, "./migrations"))

	expected := []string{
		"users", "carts", "links", "cart_items",
		"click_events", "click_daily", "cart_views_daily", "otp_attempts",
	}
	for _, table := range expected {
		var exists bool
		err := pool.QueryRow(context.Background(),
			`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
			table,
		).Scan(&exists)
		require.NoError(t, err)
		assert.True(t, exists, "table %s should exist after migrate up", table)
	}
}

func TestMigrateUp_IsIdempotent(t *testing.T) {
	_, dsn := testutil.NewPostgres(t)

	require.NoError(t, db.MigrateUp(dsn, "./migrations"))
	require.NoError(t, db.MigrateUp(dsn, "./migrations"), "second up should be a no-op")
}
