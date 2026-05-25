package carts_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/carts"
	"github.com/mayur-tolexo/shoplit/internal/db"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupSvc(t *testing.T) (*carts.Service, int64) {
	svc, uid, _, _ := setupSvcWithPool(t)
	return svc, uid
}

// setupSvcWithPool is like setupSvc but also exposes the raw pool and Queries so
// tests can seed analytics tables (cart_views_daily / click_daily) on arbitrary
// days — the Bump* queries only ever write current_date.
func setupSvcWithPool(t *testing.T) (*carts.Service, int64, *pgxpool.Pool, *sqlcgen.Queries) {
	pool, dsn := testutil.NewPostgres(t)
	require.NoError(t, db.MigrateUp(dsn, "../db/migrations"))
	q := sqlcgen.New(pool)

	upsert := auth.NewUserUpsertFn(q)
	uid, err := upsert(auth.GoogleUserInfo{
		Sub: "g-1", Email: "test@example.com", Name: "Test User", Picture: "https://example.com/a.jpg",
	})
	require.NoError(t, err)
	return carts.NewService(q), uid, pool, q
}

func TestService_CreateAndListCart(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()

	cart, err := svc.CreateCart(ctx, uid, "My First Cart")
	require.NoError(t, err)
	assert.Equal(t, "My First Cart", cart.Title)
	assert.Equal(t, uid, cart.UserID)
	// Slug should be 8 chars (the nanoid output)
	assert.Equal(t, 8, len(cart.Slug))

	list, err := svc.ListMyCarts(ctx, uid)
	require.NoError(t, err)
	assert.Len(t, list, 1)
	assert.Equal(t, cart.ID, list[0].ID)
}

func TestService_AddAndRemoveProduct(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, _ := svc.CreateCart(ctx, uid, "Cart for items")

	item, err := svc.AddProduct(ctx, uid, cart.ID, carts.AddProductInput{
		OriginalURL: "https://www.nykaa.com/x",
		Retailer:    "nykaa.com",
		Title:       "Product 1",
		ImageURL:    "https://example.com/p1.jpg",
		PriceText:   "₹500",
	})
	require.NoError(t, err)
	assert.Equal(t, "Product 1", item.Title)
	assert.Equal(t, int32(0), item.Position)

	items, err := svc.ListCartItems(ctx, cart.ID)
	require.NoError(t, err)
	assert.Len(t, items, 1)

	require.NoError(t, svc.RemoveProduct(ctx, uid, cart.ID, item.ID))
	items, _ = svc.ListCartItems(ctx, cart.ID)
	assert.Len(t, items, 0)
}

func TestService_ForbidsCrossUser(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, _ := svc.CreateCart(ctx, uid, "private cart")

	const otherUserID = int64(99999)
	_, _, err := svc.GetCart(ctx, otherUserID, cart.ID)
	assert.ErrorIs(t, err, carts.ErrForbidden)
}

func TestService_UpdateCart(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, _ := svc.CreateCart(ctx, uid, "Original Title")

	newTitle := "Updated Title"
	updated, err := svc.UpdateCart(ctx, uid, cart.ID, carts.UpdatePatch{Title: &newTitle})
	require.NoError(t, err)
	assert.Equal(t, "Updated Title", updated.Title)
}

func TestService_GetPublicCart(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, _ := svc.CreateCart(ctx, uid, "Public Cart")

	gotCart, items, user, err := svc.GetPublicCart(ctx, cart.Slug, 0)
	require.NoError(t, err)
	assert.Equal(t, cart.ID, gotCart.ID)
	assert.Empty(t, items)
	assert.Equal(t, "Test User", user.DisplayName)
}

func TestService_NewCartDefaultsPublic(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, err := svc.CreateCart(ctx, uid, "Defaults")
	require.NoError(t, err)
	assert.Equal(t, "public", cart.Visibility)
}

func TestService_UpdateVisibility(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, _ := svc.CreateCart(ctx, uid, "Toggle me")

	priv := "private"
	updated, err := svc.UpdateCart(ctx, uid, cart.ID, carts.UpdatePatch{Visibility: &priv})
	require.NoError(t, err)
	assert.Equal(t, "private", updated.Visibility)

	pub := "public"
	updated, err = svc.UpdateCart(ctx, uid, cart.ID, carts.UpdatePatch{Visibility: &pub})
	require.NoError(t, err)
	assert.Equal(t, "public", updated.Visibility)
}

func TestService_GetPublicCart_PrivateGate(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, _ := svc.CreateCart(ctx, uid, "Secret")
	priv := "private"
	_, err := svc.UpdateCart(ctx, uid, cart.ID, carts.UpdatePatch{Visibility: &priv})
	require.NoError(t, err)

	// Owner sees their own private cart.
	got, _, _, err := svc.GetPublicCart(ctx, cart.Slug, uid)
	require.NoError(t, err)
	assert.Equal(t, cart.ID, got.ID)

	// Logged-out viewer (0) → not found.
	_, _, _, err = svc.GetPublicCart(ctx, cart.Slug, 0)
	assert.ErrorIs(t, err, carts.ErrNotFound)

	// A different user → not found.
	_, _, _, err = svc.GetPublicCart(ctx, cart.Slug, uid+99999)
	assert.ErrorIs(t, err, carts.ErrNotFound)
}

func TestService_GetPublicCart_PublicVisibleToAnon(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, _ := svc.CreateCart(ctx, uid, "Open")
	got, _, _, err := svc.GetPublicCart(ctx, cart.Slug, 0)
	require.NoError(t, err)
	assert.Equal(t, cart.ID, got.ID)
}

func TestService_AccountDailyStats(t *testing.T) {
	svc, uid, pool, _ := setupSvcWithPool(t)
	ctx := context.Background()

	// The viewer's cart, with a link to attribute clicks to.
	cart, err := svc.CreateCart(ctx, uid, "Mine")
	require.NoError(t, err)
	item, err := svc.AddProduct(ctx, uid, cart.ID, carts.AddProductInput{
		OriginalURL: "https://example.com/x", Retailer: "other", Title: "P1",
	})
	require.NoError(t, err)
	// The link backing the item is what click_daily references.
	var linkID int64
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT link_id FROM cart_items WHERE id = $1`, item.ID).Scan(&linkID))

	// Another user with their own cart + analytics — must NOT leak into uid's series.
	q := sqlcgen.New(pool)
	other, err := auth.NewUserUpsertFn(q)(auth.GoogleUserInfo{
		Sub: "g-other", Email: "other@example.com", Name: "Other", Picture: "",
	})
	require.NoError(t, err)
	otherSvc := carts.NewService(q)
	otherCart, err := otherSvc.CreateCart(ctx, other, "Theirs")
	require.NoError(t, err)
	otherItem, err := otherSvc.AddProduct(ctx, other, otherCart.ID, carts.AddProductInput{
		OriginalURL: "https://example.com/y", Retailer: "other", Title: "P2",
	})
	require.NoError(t, err)
	var otherLinkID int64
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT link_id FROM cart_items WHERE id = $1`, otherItem.ID).Scan(&otherLinkID))

	// Seed views on day offsets 0, 3, 13 (gap on day 1, 2, etc.) for the viewer.
	// Offsets are relative to current_date (UTC date in Postgres).
	seedViews := func(cartID int64, offset, n int32) {
		_, e := pool.Exec(ctx,
			`INSERT INTO cart_views_daily (cart_id, day, views) VALUES ($1, current_date - ($2)::int, $3)`,
			cartID, offset, n)
		require.NoError(t, e)
	}
	seedClicks := func(linkID int64, offset, n int32) {
		_, e := pool.Exec(ctx,
			`INSERT INTO click_daily (link_id, day, clicks) VALUES ($1, current_date - ($2)::int, $3)`,
			linkID, offset, n)
		require.NoError(t, e)
	}

	seedViews(cart.ID, 13, 5) // oldest day in window
	seedViews(cart.ID, 3, 7)
	seedViews(cart.ID, 0, 11) // today
	seedClicks(linkID, 3, 2)
	seedClicks(linkID, 0, 4)

	// Out-of-window view (14 days ago) must be excluded.
	seedViews(cart.ID, 14, 99)
	// Another user's activity on day 0 must be excluded.
	seedViews(otherCart.ID, 0, 1000)
	seedClicks(otherLinkID, 0, 1000)

	stats, err := svc.AccountDailyStats(ctx, uid)
	require.NoError(t, err)

	// Exactly 14 entries, ascending by date, ending today.
	require.Len(t, stats, 14)
	today := time.Now().UTC().Truncate(24 * time.Hour)
	for i, s := range stats {
		want := today.AddDate(0, 0, -(13 - i))
		assert.Equal(t, want.Format("2006-01-02"), s.Date.Format("2006-01-02"),
			"entry %d should be ascending", i)
	}

	// Zero-filled on the gap days; correct sums on the seeded days.
	// index 0 == today-13, index 10 == today-3, index 13 == today.
	assert.EqualValues(t, 5, stats[0].Views)
	assert.EqualValues(t, 0, stats[0].Clicks)
	assert.EqualValues(t, 0, stats[1].Views, "gap day must be zero-filled")
	assert.EqualValues(t, 0, stats[1].Clicks)
	assert.EqualValues(t, 7, stats[10].Views)
	assert.EqualValues(t, 2, stats[10].Clicks)
	assert.EqualValues(t, 11, stats[13].Views)
	assert.EqualValues(t, 4, stats[13].Clicks)

	// Totals reflect only the viewer's carts (other user's 1000s excluded).
	var totalViews, totalClicks int64
	for _, s := range stats {
		totalViews += s.Views
		totalClicks += s.Clicks
	}
	assert.EqualValues(t, 5+7+11, totalViews)
	assert.EqualValues(t, 2+4, totalClicks)
}
