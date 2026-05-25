package publicapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-chi/chi/v5"
	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/carts"
	"github.com/mayur-tolexo/shoplit/internal/db"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/mayur-tolexo/shoplit/internal/ogfetch"
	"github.com/mayur-tolexo/shoplit/internal/publicapi"
	rediscli "github.com/mayur-tolexo/shoplit/internal/redis"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setup(t *testing.T) (http.Handler, string) {
	pool, dsn := testutil.NewPostgres(t)
	require.NoError(t, db.MigrateUp(dsn, "../db/migrations"))
	q := sqlcgen.New(pool)

	upsert := auth.NewUserUpsertFn(q)
	uid, err := upsert(auth.GoogleUserInfo{Sub: "g-pub", Email: "pub@example.com", Name: "Pub User", Picture: ""})
	require.NoError(t, err)

	svc := carts.NewService(q)
	mr := miniredis.RunT(t)
	rc, _ := rediscli.Open(context.Background(), "redis://"+mr.Addr()+"/0")
	fetcher := ogfetch.New(rc)
	_ = fetcher // future use

	// Create a cart via the authenticated handlers so we have a slug to read.
	r := chi.NewRouter()
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				next.ServeHTTP(w, r.WithContext(auth.WithUserID(r.Context(), uid)))
			})
		})
		carts.RegisterRoutes(r, svc, fetcher, func(int64) bool { return false })
	})
	r.Route("/api/public", func(r chi.Router) {
		publicapi.RegisterRoutes(r, svc, nil)
	})

	body := bytes.NewBufferString(`{"title":"Public Test Cart"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/carts", body)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	require.Equal(t, http.StatusCreated, rr.Code)
	var cart map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &cart))

	return r, cart["slug"].(string)
}

func TestGETPublicCart_ReturnsCart(t *testing.T) {
	r, slug := setup(t)
	req := httptest.NewRequest(http.MethodGet, "/api/public/carts/"+slug, nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusOK, rr.Code)
	var out map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &out))
	assert.Equal(t, "Public Test Cart", out["title"])
}

func TestGETPublicCart_404Missing(t *testing.T) {
	r, _ := setup(t)
	req := httptest.NewRequest(http.MethodGet, "/api/public/carts/does-not-exist", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusNotFound, rr.Code)
}
