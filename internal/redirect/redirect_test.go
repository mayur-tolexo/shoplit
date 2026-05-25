package redirect_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/db"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/mayur-tolexo/shoplit/internal/redirect"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setup(t *testing.T) (http.Handler, *sqlcgen.Queries) {
	pool, dsn := testutil.NewPostgres(t)
	require.NoError(t, db.MigrateUp(dsn, "../db/migrations"))
	q := sqlcgen.New(pool)

	// Create a user
	upsert := auth.NewUserUpsertFn(q)
	uid, err := upsert(auth.GoogleUserInfo{Sub: "g-r", Email: "r@example.com", Name: "Redirect User", Picture: ""})
	require.NoError(t, err)

	// Create a cart (needed because links reference cart_id for "in_cart" type)
	cart, err := q.CreateCart(context.Background(), sqlcgen.CreateCartParams{
		UserID:        uid,
		Slug:          "test-cart-slug",
		Title:         "Test Cart",
		IsPublic:      true,
		CoverImageUrl: pgtype.Text{},
	})
	require.NoError(t, err)

	// Create a link
	_, err = q.CreateLink(context.Background(), sqlcgen.CreateLinkParams{
		Slug:        "abc12345",
		UserID:      uid,
		OriginalUrl: "https://www.nykaa.com/example-product",
		Retailer:    "nykaa.com",
		LinkType:    "in_cart",
		CartID:      pgtype.Int8{Int64: cart.ID, Valid: true},
	})
	require.NoError(t, err)

	r := chi.NewRouter()
	redirect.RegisterRoutes(r, redirect.NewService(q, nil, "test-salt"))
	return r, q
}

func TestGo_RedirectsToOriginalURL(t *testing.T) {
	r, _ := setup(t)
	req := httptest.NewRequest(http.MethodGet, "/go/abc12345", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusFound, rr.Code)
	assert.Equal(t, "https://www.nykaa.com/example-product", rr.Header().Get("Location"))
}

func TestP_RedirectsToOriginalURL(t *testing.T) {
	r, _ := setup(t)
	req := httptest.NewRequest(http.MethodGet, "/p/abc12345", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusFound, rr.Code)
	assert.Equal(t, "https://www.nykaa.com/example-product", rr.Header().Get("Location"))
}

func TestRedirect_404OnMissing(t *testing.T) {
	r, _ := setup(t)
	req := httptest.NewRequest(http.MethodGet, "/go/does-not-exist", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusNotFound, rr.Code)
}
