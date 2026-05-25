// Package admin implements the read-only admin panel backend: platform-wide
// totals, a per-user table, and a per-user cart drill-down. All endpoints are
// gated by the RequireAdmin middleware (the same admin concept used by the
// feedback list endpoint).
package admin

import (
	"context"

	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
)

// Service wraps sqlc.Queries with the admin read aggregations.
type Service struct {
	q *sqlcgen.Queries
}

// NewService constructs a Service.
func NewService(q *sqlcgen.Queries) *Service {
	return &Service{q: q}
}

// Overview is the platform-wide totals view. PrivateCarts is derived from
// Carts - PublicCarts here in Go (the query only counts the public subset).
type Overview struct {
	Users        int64
	Carts        int64
	PublicCarts  int64
	PrivateCarts int64
	Products     int64
	Follows      int64
	Views7d      int64
	Clicks7d     int64
}

// Overview returns the platform-wide totals.
func (s *Service) Overview(ctx context.Context) (Overview, error) {
	row, err := s.q.AdminOverview(ctx)
	if err != nil {
		return Overview{}, err
	}
	return Overview{
		Users:        row.Users,
		Carts:        row.Carts,
		PublicCarts:  row.PublicCarts,
		PrivateCarts: row.Carts - row.PublicCarts,
		Products:     row.Products,
		Follows:      row.Follows,
		Views7d:      row.Views7d,
		Clicks7d:     row.Clicks7d,
	}, nil
}

// ListUsers returns all users (newest first, capped at 500) with their
// cart/follower/following counts.
func (s *Service) ListUsers(ctx context.Context) ([]sqlcgen.AdminListUsersRow, error) {
	return s.q.AdminListUsers(ctx)
}

// UserCarts returns one user's non-archived carts (newest first) with product
// counts and 7-day view/click totals.
func (s *Service) UserCarts(ctx context.Context, userID int64) ([]sqlcgen.AdminUserCartsRow, error) {
	return s.q.AdminUserCarts(ctx, userID)
}
