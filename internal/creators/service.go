// Package creators implements the discover & follow social layer: a public
// directory of creators (users with public carts), per-creator profiles, and
// authenticated follow/unfollow plus a personal following feed.
package creators

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/mayur-tolexo/shoplit/internal/carts"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
)

// Service wraps sqlc.Queries with creator/follow business logic. It reuses the
// carts marshalling helpers so the frontend Cart type stays shared.
type Service struct {
	q *sqlcgen.Queries
}

// NewService constructs a Service.
func NewService(q *sqlcgen.Queries) *Service {
	return &Service{q: q}
}

var (
	// ErrNotFound is returned when a handle is unknown or banned.
	ErrNotFound = pgx.ErrNoRows
	// ErrSelfFollow is returned when a user tries to follow themselves. The DB
	// also enforces this (no_self_follow CHECK); the service rejects it first so
	// the API gives a clean 400 before hitting the constraint.
	ErrSelfFollow = errors.New("cannot follow yourself")
)

// Pagination defaults: limit defaults to 24, clamped to [1,60]; offset to 0.
const (
	defaultLimit = 24
	maxLimit     = 60
)

// clampPage normalizes a requested limit/offset to sane bounds.
func clampPage(limit, offset int32) (int32, int32) {
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

// DiscoverCreators returns creators (users with >=1 public cart) ranked by
// 7-day cart views. isFollowing is left false here; the handler fills it in
// per viewer (or leaves it false for anonymous viewers).
func (s *Service) DiscoverCreators(ctx context.Context, limit, offset int32) ([]sqlcgen.DiscoverCreatorsRow, error) {
	limit, offset = clampPage(limit, offset)
	return s.q.DiscoverCreators(ctx, sqlcgen.DiscoverCreatorsParams{Limit: limit, Offset: offset})
}

// SearchCreators returns creators (users with >=1 public cart) whose handle or
// display name matches q, ranked prefix-first then by 7-day cart views. It
// mirrors DiscoverCreators' pagination and returns the same row type so the
// handler reuses one marshal path; isFollowing is filled per viewer there.
func (s *Service) SearchCreators(ctx context.Context, q string, limit, offset int32) ([]sqlcgen.DiscoverCreatorsRow, error) {
	limit, offset = clampPage(limit, offset)
	esc := escapeLike(strings.TrimSpace(q))
	rows, err := s.q.SearchCreators(ctx, sqlcgen.SearchCreatorsParams{
		Pattern: pgText("%" + esc + "%"),
		Prefix:  pgText(esc + "%"),
		Lim:     limit,
		Off:     offset,
	})
	if err != nil {
		return nil, err
	}
	// SearchCreatorsRow mirrors DiscoverCreatorsRow field-for-field; convert onto
	// the discover row so the handler's marshal loop stays DRY (one MarshalCreator
	// path). The structs are identical, so a direct conversion suffices.
	out := make([]sqlcgen.DiscoverCreatorsRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, sqlcgen.DiscoverCreatorsRow(r))
	}
	return out, nil
}

// escapeLike escapes LIKE/ILIKE wildcards in user input so a literal `%` or `_`
// in a query is matched literally rather than matching everything. Postgres
// ILIKE uses `\` as the default escape char, so the backslash is escaped first.
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// IsFollowing reports whether followerID follows creatorID. A zero followerID
// (anonymous viewer) is never following anyone.
func (s *Service) IsFollowing(ctx context.Context, followerID, creatorID int64) bool {
	if followerID == 0 {
		return false
	}
	ok, _ := s.q.IsFollowing(ctx, sqlcgen.IsFollowingParams{FollowerID: followerID, CreatorID: creatorID})
	return ok
}

// GetCreatorProfile resolves a creator by handle and returns their public,
// non-archived carts (marshalled with 0 analytics so another creator's
// view/click/reach numbers never leak), the creator's follower count, and
// whether viewerID follows them. ErrNotFound if the handle is unknown/banned.
func (s *Service) GetCreatorProfile(ctx context.Context, handle string, viewerID int64) (creator CreatorJSON, cartsJSON []carts.CartJSON, err error) {
	user, err := s.q.GetUserByHandle(ctx, pgText(handle))
	if err != nil {
		return CreatorJSON{}, nil, err
	}

	cartRows, err := s.q.ListPublicCartsByUser(ctx, user.ID)
	if err != nil {
		return CreatorJSON{}, nil, err
	}
	cartsJSON = make([]carts.CartJSON, 0, len(cartRows))
	for _, c := range cartRows {
		// Same N+1 item fetch as carts.listCarts. Public context → 0 analytics.
		items, err := s.q.ListCartItems(ctx, c.ID)
		if err != nil {
			return CreatorJSON{}, nil, err
		}
		cartsJSON = append(cartsJSON, carts.MarshalCart(c, user, items, 0, 0, 0))
	}

	followerCount, err := s.q.CountFollowers(ctx, user.ID)
	if err != nil {
		return CreatorJSON{}, nil, err
	}
	isFollowing := s.IsFollowing(ctx, viewerID, user.ID)

	creator = MarshalCreatorProfile(user, len(cartRows), int(followerCount), isFollowing)
	return creator, cartsJSON, nil
}

// Follow makes followerID follow the creator identified by handle and returns
// the resulting follower count. Idempotent (ON CONFLICT DO NOTHING). Rejects
// self-follow with ErrSelfFollow and unknown handles with ErrNotFound.
func (s *Service) Follow(ctx context.Context, followerID int64, handle string) (int64, error) {
	creatorID, err := s.resolveCreatorID(ctx, handle)
	if err != nil {
		return 0, err
	}
	if creatorID == followerID {
		return 0, ErrSelfFollow
	}
	if err := s.q.FollowCreator(ctx, sqlcgen.FollowCreatorParams{
		FollowerID: followerID, CreatorID: creatorID,
	}); err != nil {
		return 0, err
	}
	return s.q.CountFollowers(ctx, creatorID)
}

// Unfollow removes followerID's follow of the creator identified by handle and
// returns the resulting follower count. Idempotent (DELETE of nothing is fine).
func (s *Service) Unfollow(ctx context.Context, followerID int64, handle string) (int64, error) {
	creatorID, err := s.resolveCreatorID(ctx, handle)
	if err != nil {
		return 0, err
	}
	if err := s.q.UnfollowCreator(ctx, sqlcgen.UnfollowCreatorParams{
		FollowerID: followerID, CreatorID: creatorID,
	}); err != nil {
		return 0, err
	}
	return s.q.CountFollowers(ctx, creatorID)
}

// FollowingFeed returns the public, non-archived carts owned by creators that
// followerID follows, newest first. Marshalled with 0 analytics (the viewer
// must not see other creators' view/click/reach numbers).
func (s *Service) FollowingFeed(ctx context.Context, followerID int64, limit, offset int32) ([]carts.CartJSON, error) {
	limit, offset = clampPage(limit, offset)
	cartRows, err := s.q.ListFollowingCartIDs(ctx, sqlcgen.ListFollowingCartIDsParams{
		FollowerID: followerID, Limit: limit, Offset: offset,
	})
	if err != nil {
		return nil, err
	}
	out := make([]carts.CartJSON, 0, len(cartRows))
	for _, c := range cartRows {
		// Same N+1 pattern as carts.listCarts: fetch items + owner per cart.
		items, err := s.q.ListCartItems(ctx, c.ID)
		if err != nil {
			return nil, err
		}
		owner, err := s.q.GetUserByID(ctx, c.UserID)
		if err != nil {
			return nil, err
		}
		out = append(out, carts.MarshalCart(c, owner, items, 0, 0, 0))
	}
	return out, nil
}

// resolveCreatorID maps a handle to its user id, returning ErrNotFound if the
// handle is unknown or the user is banned.
func (s *Service) resolveCreatorID(ctx context.Context, handle string) (int64, error) {
	user, err := s.q.GetUserByHandle(ctx, pgText(handle))
	if err != nil {
		return 0, err
	}
	return user.ID, nil
}
