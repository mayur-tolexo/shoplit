package httpx_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/mayur-tolexo/shoplit/internal/httpx"
	rediscli "github.com/mayur-tolexo/shoplit/internal/redis"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealth_ReturnsOKWhenDepsHealthy(t *testing.T) {
	pool, _ := testutil.NewPostgres(t)
	mr := miniredis.RunT(t)
	rc, err := rediscli.Open(context.Background(), "redis://"+mr.Addr()+"/0")
	require.NoError(t, err)

	h := httpx.Health(pool, rc, "test")
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	h.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)

	var body struct {
		Status string `json:"status"`
		DB     string `json:"db"`
		Redis  string `json:"redis"`
		Env    string `json:"env"`
	}
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
	assert.Equal(t, "ok", body.Status)
	assert.Equal(t, "ok", body.DB)
	assert.Equal(t, "ok", body.Redis)
	assert.Equal(t, "test", body.Env)
}

func TestHealth_FailsWhenRedisDown(t *testing.T) {
	pool, _ := testutil.NewPostgres(t)
	mr := miniredis.RunT(t)
	rc, err := rediscli.Open(context.Background(), "redis://"+mr.Addr()+"/0")
	require.NoError(t, err)
	mr.Close()

	h := httpx.Health(pool, rc, "test")
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	h.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusServiceUnavailable, rr.Code)
}
