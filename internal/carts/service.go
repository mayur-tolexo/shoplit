package carts

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
)

// Service wraps sqlc.Queries with cart-level business logic.
type Service struct {
	q *sqlcgen.Queries
}

// NewService constructs a Service.
func NewService(q *sqlcgen.Queries) *Service {
	return &Service{q: q}
}

var (
	// ErrForbidden is returned when a user attempts an action on a cart they don't own.
	ErrForbidden = errors.New("forbidden")
	// ErrNotFound is returned when a requested resource does not exist.
	ErrNotFound = pgx.ErrNoRows
)

// CreateCart inserts a new cart for userID with the given title.
// It retries on slug collisions up to maxAttempts times.
func (s *Service) CreateCart(ctx context.Context, userID int64, title string) (sqlcgen.Cart, error) {
	const maxAttempts = 5
	for i := 0; i < maxAttempts; i++ {
		slug, err := NewSlug()
		if err != nil {
			return sqlcgen.Cart{}, err
		}
		cart, err := s.q.CreateCart(ctx, sqlcgen.CreateCartParams{
			UserID:   userID,
			Slug:     slug,
			Title:    title,
			IsPublic: true,
			// No default cover — an empty cover renders as a branded accent
			// gradient on the frontend (looks intentional, not like a random
			// stock photo). The creator can add a real cover in the editor.
			CoverImageUrl: pgtype.Text{Valid: false},
		})
		if err == nil {
			return cart, nil
		}
		if !isUniqueViolation(err) {
			return sqlcgen.Cart{}, err
		}
	}
	return sqlcgen.Cart{}, errors.New("slug collision after retries")
}

// ListMyCarts returns all non-archived carts owned by userID.
func (s *Service) ListMyCarts(ctx context.Context, userID int64) ([]sqlcgen.Cart, error) {
	return s.q.ListCartsByUser(ctx, userID)
}

// CartStats7d returns the cart's view, click, and reach counts over the last 7 days.
// Best-effort: any read error yields 0 rather than failing the request.
func (s *Service) CartStats7d(ctx context.Context, cartID int64) (views, clicks, reach int64) {
	views, _ = s.q.CartViews7d(ctx, cartID)
	cid := pgtype.Int8{Int64: cartID, Valid: true}
	clicks, _ = s.q.CartClicks7d(ctx, cid)
	reach, _ = s.q.CartReach7d(ctx, cid)
	return views, clicks, reach
}

// ListMyCoverImages returns the distinct cover image URLs the user has used
// across their carts, most-recent first — their "personal" cover library.
func (s *Service) ListMyCoverImages(ctx context.Context, userID int64) ([]string, error) {
	rows, err := s.q.ListUserCoverImages(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		if r.CoverImageUrl.Valid {
			out = append(out, r.CoverImageUrl.String)
		}
	}
	return out, nil
}

// GetCart returns the cart and its items if userID owns it, otherwise ErrForbidden.
func (s *Service) GetCart(ctx context.Context, userID, cartID int64) (sqlcgen.Cart, []sqlcgen.ListCartItemsRow, error) {
	cart, err := s.q.GetCartByID(ctx, cartID)
	if err != nil {
		return sqlcgen.Cart{}, nil, err
	}
	if cart.UserID != userID {
		return sqlcgen.Cart{}, nil, ErrForbidden
	}
	items, err := s.q.ListCartItems(ctx, cartID)
	if err != nil {
		return sqlcgen.Cart{}, nil, err
	}
	return cart, items, nil
}

// GetPublicCart resolves a public cart by slug, returning the cart, its items,
// and the owning user. It also bumps the view counter in the background,
// unless the viewer is the cart owner (to avoid counting self-views).
func (s *Service) GetPublicCart(ctx context.Context, slug string, viewerUserID int64) (sqlcgen.Cart, []sqlcgen.ListCartItemsRow, sqlcgen.User, error) {
	cart, err := s.q.GetCartBySlug(ctx, slug)
	if err != nil {
		return sqlcgen.Cart{}, nil, sqlcgen.User{}, err
	}
	// Private carts are visible only to their owner; everyone else gets a
	// not-found (same as a nonexistent cart — no "this is private" leak).
	if cart.Visibility == "private" && viewerUserID != cart.UserID {
		return sqlcgen.Cart{}, nil, sqlcgen.User{}, ErrNotFound
	}
	items, err := s.q.ListCartItems(ctx, cart.ID)
	if err != nil {
		return sqlcgen.Cart{}, nil, sqlcgen.User{}, err
	}
	user, err := s.q.GetUserByID(ctx, cart.UserID)
	if err != nil {
		return sqlcgen.Cart{}, nil, sqlcgen.User{}, err
	}
	// Fire-and-forget view bump (best effort) — but never count the owner's
	// own views of their own cart.
	if viewerUserID != cart.UserID {
		go func() {
			_ = s.q.BumpCartViewsDaily(context.Background(), cart.ID)
		}()
	}
	return cart, items, user, nil
}

// ListCartItems returns all items in the cart ordered by position.
func (s *Service) ListCartItems(ctx context.Context, cartID int64) ([]sqlcgen.ListCartItemsRow, error) {
	return s.q.ListCartItems(ctx, cartID)
}

// UpdatePatch carries optional fields to update on a cart.
// A nil pointer means "leave unchanged".
type UpdatePatch struct {
	Title         *string
	Description   *string
	CoverImageURL *string
	IsPublic      *bool
	Visibility    *string
}

// UpdateCart applies a partial patch to an owned cart and returns the updated row.
func (s *Service) UpdateCart(ctx context.Context, userID, cartID int64, patch UpdatePatch) (sqlcgen.Cart, error) {
	cart, err := s.q.GetCartByID(ctx, cartID)
	if err != nil {
		return sqlcgen.Cart{}, err
	}
	if cart.UserID != userID {
		return sqlcgen.Cart{}, ErrForbidden
	}

	// UpdateCartParams uses COALESCE on nullable columns but Title/IsPublic are
	// non-nullable in the schema. Seed params from the current cart values so
	// that unset fields in the patch leave the DB row unchanged.
	params := sqlcgen.UpdateCartParams{
		ID:            cartID,
		Title:         cart.Title,
		Description:   cart.Description,
		CoverImageUrl: cart.CoverImageUrl,
		IsPublic:      cart.IsPublic,
		Visibility:    cart.Visibility,
	}
	if patch.Title != nil {
		params.Title = *patch.Title
	}
	if patch.Description != nil {
		params.Description = pgtype.Text{String: *patch.Description, Valid: true}
	}
	if patch.CoverImageURL != nil {
		params.CoverImageUrl = pgtype.Text{String: *patch.CoverImageURL, Valid: true}
	}
	if patch.IsPublic != nil {
		params.IsPublic = *patch.IsPublic
	}
	if patch.Visibility != nil {
		params.Visibility = *patch.Visibility
	}
	return s.q.UpdateCart(ctx, params)
}

// AddProductInput contains all data required to add a product to a cart.
type AddProductInput struct {
	OriginalURL string
	Retailer    string
	Title       string
	ImageURL    string
	PriceText   string
	Note        string
}

// AddProduct creates a short link and a cart item, returning the new item.
func (s *Service) AddProduct(ctx context.Context, userID, cartID int64, in AddProductInput) (sqlcgen.CartItem, error) {
	cart, err := s.q.GetCartByID(ctx, cartID)
	if err != nil {
		return sqlcgen.CartItem{}, err
	}
	if cart.UserID != userID {
		return sqlcgen.CartItem{}, ErrForbidden
	}

	linkSlug, err := NewSlug()
	if err != nil {
		return sqlcgen.CartItem{}, err
	}
	link, err := s.q.CreateLink(ctx, sqlcgen.CreateLinkParams{
		Slug:        linkSlug,
		UserID:      userID,
		OriginalUrl: in.OriginalURL,
		Retailer:    in.Retailer,
		LinkType:    "in_cart",
		CartID:      pgtype.Int8{Int64: cartID, Valid: true},
	})
	if err != nil {
		return sqlcgen.CartItem{}, err
	}

	nextPos, err := s.q.NextCartItemPosition(ctx, cartID)
	if err != nil {
		return sqlcgen.CartItem{}, err
	}

	return s.q.AddCartItem(ctx, sqlcgen.AddCartItemParams{
		CartID:      cartID,
		Position:    nextPos,
		LinkID:      link.ID,
		Title:       in.Title,
		Description: pgtype.Text{String: in.Note, Valid: in.Note != ""},
		ImageUrl:    pgtype.Text{String: in.ImageURL, Valid: in.ImageURL != ""},
		PriceText:   pgtype.Text{String: in.PriceText, Valid: in.PriceText != ""},
		Retailer:    pgtype.Text{String: in.Retailer, Valid: true},
	})
}

// RemoveProduct deletes a cart item after verifying ownership.
func (s *Service) RemoveProduct(ctx context.Context, userID, cartID, itemID int64) error {
	cart, err := s.q.GetCartByID(ctx, cartID)
	if err != nil {
		return err
	}
	if cart.UserID != userID {
		return ErrForbidden
	}
	return s.q.RemoveCartItem(ctx, sqlcgen.RemoveCartItemParams{ID: itemID, CartID: cartID})
}

// UpdateProductInput holds the editable display fields of a cart item.
type UpdateProductInput struct {
	Title     string
	Note      string
	ImageURL  string
	PriceText string
}

// UpdateProduct edits a product's display fields after verifying ownership.
func (s *Service) UpdateProduct(ctx context.Context, userID, cartID, itemID int64, in UpdateProductInput) (sqlcgen.CartItem, error) {
	cart, err := s.q.GetCartByID(ctx, cartID)
	if err != nil {
		return sqlcgen.CartItem{}, err
	}
	if cart.UserID != userID {
		return sqlcgen.CartItem{}, ErrForbidden
	}
	return s.q.UpdateCartItem(ctx, sqlcgen.UpdateCartItemParams{
		ID:          itemID,
		CartID:      cartID,
		Title:       in.Title,
		Description: pgtype.Text{String: in.Note, Valid: in.Note != ""},
		ImageUrl:    pgtype.Text{String: in.ImageURL, Valid: in.ImageURL != ""},
		PriceText:   pgtype.Text{String: in.PriceText, Valid: in.PriceText != ""},
	})
}

// DeleteCart soft-deletes a cart (sets archived_at) after verifying ownership.
// Archived carts drop out of the dashboard list and stop resolving publicly.
func (s *Service) DeleteCart(ctx context.Context, userID, cartID int64) error {
	cart, err := s.q.GetCartByID(ctx, cartID)
	if err != nil {
		return err
	}
	if cart.UserID != userID {
		return ErrForbidden
	}
	return s.q.ArchiveCart(ctx, cartID)
}

// ReorderProducts sets the positions of the given item IDs in order.
func (s *Service) ReorderProducts(ctx context.Context, userID, cartID int64, itemIDs []int64) error {
	cart, err := s.q.GetCartByID(ctx, cartID)
	if err != nil {
		return err
	}
	if cart.UserID != userID {
		return ErrForbidden
	}
	// cart_items has UNIQUE(cart_id, position), checked per row. Assigning final
	// positions directly collides mid-reorder (e.g. setting A→1 while B still
	// holds 1). Two-phase: first park every item at a distinct negative
	// position (can't collide with the 0..n-1 range or each other), then set
	// the final positions onto the now-cleared range.
	for i, id := range itemIDs {
		if err := s.q.ReorderCartItem(ctx, sqlcgen.ReorderCartItemParams{
			ID: id, CartID: cartID, Position: int32(-(i + 1)),
		}); err != nil {
			return err
		}
	}
	for i, id := range itemIDs {
		if err := s.q.ReorderCartItem(ctx, sqlcgen.ReorderCartItemParams{
			ID: id, CartID: cartID, Position: int32(i),
		}); err != nil {
			return err
		}
	}
	return nil
}

// GetUser fetches a user by ID.
func (s *Service) GetUser(ctx context.Context, userID int64) (sqlcgen.User, error) {
	return s.q.GetUserByID(ctx, userID)
}

// isUniqueViolation reports whether err is a PostgreSQL unique-constraint violation (23505).
func isUniqueViolation(err error) bool {
	type sqlStater interface{ SQLState() string }
	var s sqlStater
	if errors.As(err, &s) {
		return s.SQLState() == "23505"
	}
	return false
}
