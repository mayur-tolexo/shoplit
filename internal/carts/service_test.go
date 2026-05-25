package carts_test

import (
	"context"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/carts"
	"github.com/mayur-tolexo/shoplit/internal/db"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupSvc(t *testing.T) (*carts.Service, int64) {
	pool, dsn := testutil.NewPostgres(t)
	require.NoError(t, db.MigrateUp(dsn, "../db/migrations"))
	q := sqlcgen.New(pool)

	upsert := auth.NewUserUpsertFn(q)
	uid, err := upsert(auth.GoogleUserInfo{
		Sub: "g-1", Email: "test@example.com", Name: "Test User", Picture: "https://example.com/a.jpg",
	})
	require.NoError(t, err)
	return carts.NewService(q), uid
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
