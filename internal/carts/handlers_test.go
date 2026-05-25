package carts_test

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
	rediscli "github.com/mayur-tolexo/shoplit/internal/redis"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupHandlers(t *testing.T) (http.Handler, *auth.SessionManager) {
	pool, dsn := testutil.NewPostgres(t)
	require.NoError(t, db.MigrateUp(dsn, "../db/migrations"))
	q := sqlcgen.New(pool)

	upsert := auth.NewUserUpsertFn(q)
	uid, err := upsert(auth.GoogleUserInfo{
		Sub: "g-1", Email: "test@example.com", Name: "Test User", Picture: "https://example.com/a.jpg",
	})
	require.NoError(t, err)

	mr := miniredis.RunT(t)
	rc, _ := rediscli.Open(context.Background(), "redis://"+mr.Addr()+"/0")
	fetcher := ogfetch.New(rc)

	sm := auth.NewSessionManager("test-secret")
	r := chi.NewRouter()
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(injectFixedUser(uid))
		carts.RegisterRoutes(r, carts.NewService(q), fetcher, func(int64) bool { return false })
	})
	return r, sm
}

// injectFixedUser is a test helper that bypasses RequireUser to inject a
// fixed user_id into context — keeps these tests focused on handlers, not auth.
func injectFixedUser(uid int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := auth.WithUserID(r.Context(), uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func TestPOSTCarts_CreatesAndReturns201(t *testing.T) {
	r, _ := setupHandlers(t)
	body, _ := json.Marshal(map[string]string{"title": "My Test Cart"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/carts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusCreated, rr.Code)

	var out map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &out))
	assert.Equal(t, "My Test Cart", out["title"])
	assert.NotEmpty(t, out["id"])
	assert.NotEmpty(t, out["slug"])
}

func TestGETCarts_ListsCarts(t *testing.T) {
	r, _ := setupHandlers(t)
	// create one first
	body, _ := json.Marshal(map[string]string{"title": "Cart 1"})
	req1 := httptest.NewRequest(http.MethodPost, "/api/v1/carts", bytes.NewReader(body))
	req1.Header.Set("Content-Type", "application/json")
	rr1 := httptest.NewRecorder()
	r.ServeHTTP(rr1, req1)

	// list
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/carts", nil)
	rr2 := httptest.NewRecorder()
	r.ServeHTTP(rr2, req2)
	assert.Equal(t, http.StatusOK, rr2.Code)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(rr2.Body.Bytes(), &list))
	assert.Len(t, list, 1)
}

func TestGETMe_ReturnsUser(t *testing.T) {
	r, _ := setupHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusOK, rr.Code)
	var u map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &u))
	assert.Equal(t, "Test User", u["displayName"])
}

func TestGETInsights_Returns14DayDaily(t *testing.T) {
	r, _ := setupHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/insights", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusOK, rr.Code)

	var out struct {
		Daily []struct {
			Date   string `json:"date"`
			Views  int    `json:"views"`
			Clicks int    `json:"clicks"`
		} `json:"daily"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &out))
	require.Len(t, out.Daily, 14)
	// Ascending by date, zero-filled (no activity seeded).
	for i := 1; i < len(out.Daily); i++ {
		assert.Less(t, out.Daily[i-1].Date, out.Daily[i].Date)
	}
	assert.Equal(t, 0, out.Daily[0].Views)
	assert.Equal(t, 0, out.Daily[0].Clicks)
}

func TestPOSTCartItems_AddsExplicitProduct(t *testing.T) {
	r, _ := setupHandlers(t)
	// create cart
	cb, _ := json.Marshal(map[string]string{"title": "Cart with items"})
	c1 := httptest.NewRequest(http.MethodPost, "/api/v1/carts", bytes.NewReader(cb))
	c1.Header.Set("Content-Type", "application/json")
	cr := httptest.NewRecorder()
	r.ServeHTTP(cr, c1)
	var cart map[string]any
	require.NoError(t, json.Unmarshal(cr.Body.Bytes(), &cart))

	// add product (explicit fields, no paste_url)
	ib, _ := json.Marshal(map[string]string{
		"title":        "Explicit Product",
		"image_url":    "https://example.com/p.jpg",
		"price_text":   "₹100",
		"original_url": "https://example.com/x",
		"retailer":     "other",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/carts/"+cart["id"].(string)+"/items", bytes.NewReader(ib))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusCreated, rr.Code)
}
