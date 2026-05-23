package db_test

import (
	"context"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/db"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpen_PingsSuccessfully(t *testing.T) {
	_, dsn := testutil.NewPostgres(t)

	pool, err := db.Open(context.Background(), dsn)
	require.NoError(t, err)
	defer pool.Close()

	assert.NoError(t, pool.Ping(context.Background()))
}

func TestOpen_ReturnsErrorOnBadDSN(t *testing.T) {
	_, err := db.Open(context.Background(), "postgres://nope:nope@127.0.0.1:1/none?sslmode=disable&connect_timeout=1")
	require.Error(t, err)
}
