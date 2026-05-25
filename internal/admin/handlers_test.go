package admin_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mayur-tolexo/shoplit/internal/admin"
	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/db"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// seed inserts a deterministic fixture and returns the admin user id plus two
// other user ids. Layout:
//
//	admin (uid)  : 1 public cart (cartA, 2 items), 1 private cart (cartB, 0 items)
//	alice        : 1 public cart (cartC, 1 item)
//	bob          : 0 carts
//
// follows: alice→admin, bob→admin (admin has 2 followers, 0 following);
//
//	admin→alice                       (admin follows 1, alice has 1 follower).
//
// views_7d: cartA=5; clicks_7d: cartA item linkX=3.
func seed(t *testing.T, pool *pgxpool.Pool) (adminID, aliceID, bobID, cartA int64) {
	t.Helper()
	ctx := context.Background()

	mustScan := func(sql string, args ...any) int64 {
		var id int64
		require.NoError(t, pool.QueryRow(ctx, sql, args...).Scan(&id))
		return id
	}
	mustExec := func(sql string, args ...any) {
		_, err := pool.Exec(ctx, sql, args...)
		require.NoError(t, err)
	}

	adminID = mustScan(`INSERT INTO users (email, display_name, handle, google_sub) VALUES ('admin@x.com','Admin','admin','g-admin') RETURNING id`)
	aliceID = mustScan(`INSERT INTO users (email, display_name, handle, google_sub) VALUES ('alice@x.com','Alice','alice','g-alice') RETURNING id`)
	bobID = mustScan(`INSERT INTO users (email, display_name, handle, google_sub) VALUES ('bob@x.com','Bob','bob','g-bob') RETURNING id`)

	cartA = mustScan(`INSERT INTO carts (user_id, slug, title, visibility) VALUES ($1,'cart-a','Cart A','public') RETURNING id`, adminID)
	mustExec(`INSERT INTO carts (user_id, slug, title, visibility) VALUES ($1,'cart-b','Cart B','private')`, adminID)
	cartC := mustScan(`INSERT INTO carts (user_id, slug, title, visibility) VALUES ($1,'cart-c','Cart C','public') RETURNING id`, aliceID)
	// An archived cart for admin — must be excluded everywhere.
	mustExec(`INSERT INTO carts (user_id, slug, title, visibility, archived_at) VALUES ($1,'cart-arch','Archived','public', now())`, adminID)

	// Links + cart items. cartA gets 2 items, cartC gets 1.
	linkX := mustScan(`INSERT INTO links (slug, user_id, original_url, retailer, link_type, cart_id) VALUES ('lx',$1,'https://e/x','other','in_cart',$2) RETURNING id`, adminID, cartA)
	linkY := mustScan(`INSERT INTO links (slug, user_id, original_url, retailer, link_type, cart_id) VALUES ('ly',$1,'https://e/y','other','in_cart',$2) RETURNING id`, adminID, cartA)
	linkZ := mustScan(`INSERT INTO links (slug, user_id, original_url, retailer, link_type, cart_id) VALUES ('lz',$1,'https://e/z','other','in_cart',$2) RETURNING id`, aliceID, cartC)
	mustExec(`INSERT INTO cart_items (cart_id, position, link_id, title) VALUES ($1,0,$2,'X1')`, cartA, linkX)
	mustExec(`INSERT INTO cart_items (cart_id, position, link_id, title) VALUES ($1,1,$2,'X2')`, cartA, linkY)
	mustExec(`INSERT INTO cart_items (cart_id, position, link_id, title) VALUES ($1,0,$2,'Z1')`, cartC, linkZ)

	// follows: alice→admin, bob→admin, admin→alice.
	mustExec(`INSERT INTO follows (follower_id, creator_id) VALUES ($1,$2)`, aliceID, adminID)
	mustExec(`INSERT INTO follows (follower_id, creator_id) VALUES ($1,$2)`, bobID, adminID)
	mustExec(`INSERT INTO follows (follower_id, creator_id) VALUES ($1,$2)`, adminID, aliceID)

	// Analytics within the 7-day window (current_date), plus an out-of-window row
	// to prove the date filter clips it.
	mustExec(`INSERT INTO cart_views_daily (cart_id, day, views) VALUES ($1, current_date, 5)`, cartA)
	mustExec(`INSERT INTO cart_views_daily (cart_id, day, views) VALUES ($1, current_date - 30, 99)`, cartA)
	mustExec(`INSERT INTO click_daily (link_id, day, clicks) VALUES ($1, current_date, 3)`, linkX)
	mustExec(`INSERT INTO click_daily (link_id, day, clicks) VALUES ($1, current_date - 30, 88)`, linkX)

	return adminID, aliceID, bobID, cartA
}

// newRouter mounts the admin routes behind a fixed-user middleware so each test
// can act as a specific uid. Only adminID is treated as an admin.
func newRouter(pool *pgxpool.Pool, actingUID, adminID int64) http.Handler {
	q := sqlcgen.New(pool)
	r := chi.NewRouter()
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				next.ServeHTTP(w, req.WithContext(auth.WithUserID(req.Context(), actingUID)))
			})
		})
		admin.RegisterRoutes(r, admin.NewService(q), func(id int64) bool { return id == adminID })
	})
	return r
}

func setup(t *testing.T) *pgxpool.Pool {
	t.Helper()
	pool, dsn := testutil.NewPostgres(t)
	require.NoError(t, db.MigrateUp(dsn, "../db/migrations"))
	return pool
}

func TestAdminOverview_Counts(t *testing.T) {
	pool := setup(t)
	adminID, _, _, _ := seed(t, pool)
	r := newRouter(pool, adminID, adminID)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/overview", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	require.Equal(t, http.StatusOK, rr.Code)

	var out admin.OverviewJSON
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &out))

	assert.EqualValues(t, 3, out.Users)        // admin, alice, bob
	assert.EqualValues(t, 3, out.Carts)        // cartA, cartB, cartC (archived excluded)
	assert.EqualValues(t, 2, out.PublicCarts)  // cartA, cartC
	assert.EqualValues(t, 1, out.PrivateCarts) // cartB (= carts - publicCarts, in Go)
	assert.EqualValues(t, 3, out.Products)     // 2 in cartA + 1 in cartC
	assert.EqualValues(t, 3, out.Follows)      // 3 follow rows
	assert.EqualValues(t, 5, out.Views7d)      // out-of-window 99 excluded
	assert.EqualValues(t, 3, out.Clicks7d)     // out-of-window 88 excluded
}

func TestAdminListUsers_PerUserCounts(t *testing.T) {
	pool := setup(t)
	adminID, aliceID, bobID, _ := seed(t, pool)
	r := newRouter(pool, adminID, adminID)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	require.Equal(t, http.StatusOK, rr.Code)

	var users []admin.AdminUserJSON
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &users))
	require.Len(t, users, 3)

	by := make(map[string]admin.AdminUserJSON, len(users))
	for _, u := range users {
		by[u.Handle] = u
	}

	// Newest first: bob, alice, admin were inserted in that order, so created_at
	// DESC yields bob, alice, admin.
	assert.Equal(t, "bob", users[0].Handle)
	assert.Equal(t, "admin", users[2].Handle)

	// admin: 1 public + 1 private (archived excluded) = 2 carts, 2 followers, follows 1.
	adminRow := by["admin"]
	assert.Equal(t, "admin@x.com", adminRow.Email)
	assert.NotEmpty(t, adminRow.CreatedAt)
	assert.EqualValues(t, 2, adminRow.Carts)
	assert.EqualValues(t, 2, adminRow.Followers)
	assert.EqualValues(t, 1, adminRow.Following)

	// alice: 1 cart, 1 follower (admin), follows 1 (admin).
	assert.EqualValues(t, 1, by["alice"].Carts)
	assert.EqualValues(t, 1, by["alice"].Followers)
	assert.EqualValues(t, 1, by["alice"].Following)

	// bob: 0 carts, 0 followers, follows 1 (admin).
	assert.EqualValues(t, 0, by["bob"].Carts)
	assert.EqualValues(t, 0, by["bob"].Followers)
	assert.EqualValues(t, 1, by["bob"].Following)

	// IDs are stringified.
	assert.Equal(t, intStr(adminID), adminRow.ID)
	_ = aliceID
	_ = bobID
}

func TestAdminUserCarts_DrillDown(t *testing.T) {
	pool := setup(t)
	adminID, _, _, cartA := seed(t, pool)
	r := newRouter(pool, adminID, adminID)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users/"+intStr(adminID)+"/carts", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	require.Equal(t, http.StatusOK, rr.Code)

	var carts []admin.AdminUserCartJSON
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &carts))
	// Two non-archived carts (cartA public, cartB private); archived excluded.
	require.Len(t, carts, 2)

	byID := make(map[string]admin.AdminUserCartJSON, len(carts))
	for _, c := range carts {
		byID[c.ID] = c
	}
	a := byID[intStr(cartA)]
	assert.Equal(t, "cart-a", a.Slug)
	assert.Equal(t, "public", a.Visibility)
	assert.EqualValues(t, 2, a.Products) // X1, X2
	assert.EqualValues(t, 5, a.Views7d)  // out-of-window excluded
	assert.EqualValues(t, 3, a.Clicks7d) // out-of-window excluded
	assert.NotEmpty(t, a.CreatedAt)

	// The private cart shows up with zero analytics.
	var priv admin.AdminUserCartJSON
	for _, c := range carts {
		if c.Slug == "cart-b" {
			priv = c
		}
	}
	assert.Equal(t, "private", priv.Visibility)
	assert.EqualValues(t, 0, priv.Products)
	assert.EqualValues(t, 0, priv.Views7d)
	assert.EqualValues(t, 0, priv.Clicks7d)
}

func TestAdmin_NonAdmin_Forbidden(t *testing.T) {
	pool := setup(t)
	adminID, aliceID, _, _ := seed(t, pool)
	// alice is acting but only adminID is an admin.
	r := newRouter(pool, aliceID, adminID)

	for _, path := range []string{
		"/api/v1/admin/overview",
		"/api/v1/admin/users",
		"/api/v1/admin/users/" + intStr(adminID) + "/carts",
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusForbidden, rr.Code, "path %s should be 403 for non-admin", path)
	}
}

func TestAdmin_Admin_OK(t *testing.T) {
	pool := setup(t)
	adminID, _, _, _ := seed(t, pool)
	r := newRouter(pool, adminID, adminID)

	for _, path := range []string{
		"/api/v1/admin/overview",
		"/api/v1/admin/users",
		"/api/v1/admin/users/" + intStr(adminID) + "/carts",
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code, "path %s should be 200 for admin", path)
	}
}

// intStr mirrors the unexported helper for building request paths/expectations.
func intStr(i int64) string { return strconv.FormatInt(i, 10) }
