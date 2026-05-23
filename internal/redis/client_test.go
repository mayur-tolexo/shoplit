package redis_test

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/mayur-tolexo/shoplit/internal/redis"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpen_PingsSuccessfully(t *testing.T) {
	mr := miniredis.RunT(t)
	url := "redis://" + mr.Addr() + "/0"

	client, err := redis.Open(context.Background(), url)
	require.NoError(t, err)
	defer client.Close()

	require.NoError(t, client.Ping(context.Background()).Err())
}

func TestOpen_RoundTripsAValue(t *testing.T) {
	mr := miniredis.RunT(t)
	url := "redis://" + mr.Addr() + "/0"
	ctx := context.Background()

	client, err := redis.Open(ctx, url)
	require.NoError(t, err)
	defer client.Close()

	require.NoError(t, client.Set(ctx, "k", "v", 0).Err())
	got, err := client.Get(ctx, "k").Result()
	require.NoError(t, err)
	assert.Equal(t, "v", got)
}

func TestOpen_ReturnsErrorOnBadURL(t *testing.T) {
	_, err := redis.Open(context.Background(), "not-a-url")
	require.Error(t, err)
}
