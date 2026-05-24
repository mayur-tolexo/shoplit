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
// and the owning user. It also bumps the view counter in the background.
func (s *Service) GetPublicCart(ctx context.Context, slug string) (sqlcgen.Cart, []sqlcgen.ListCartItemsRow, sqlcgen.User, error) {
	cart, err := s.q.GetCartBySlug(ctx, slug)
	if err != nil {
		return sqlcgen.Cart{}, nil, sqlcgen.User{}, err
	}
	items, err := s.q.ListCartItems(ctx, cart.ID)
	if err != nil {
		return sqlcgen.Cart{}, nil, sqlcgen.User{}, err
	}
	user, err := s.q.GetUserByID(ctx, cart.UserID)
	if err != nil {
		return sqlcgen.Cart{}, nil, sqlcgen.User{}, err
	}
	// Fire-and-forget view bump (best effort).
	go func() {
		_ = s.q.BumpCartViewsDaily(context.Background(), cart.ID)
	}()
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

// ReorderProducts sets the positions of the given item IDs in order.
func (s *Service) ReorderProducts(ctx context.Context, userID, cartID int64, itemIDs []int64) error {
	cart, err := s.q.GetCartByID(ctx, cartID)
	if err != nil {
		return err
	}
	if cart.UserID != userID {
		return ErrForbidden
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
