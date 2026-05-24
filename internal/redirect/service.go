package redirect

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mayur-tolexo/shoplit/internal/affiliate"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
)

type Service struct {
	q *sqlcgen.Queries
}

func NewService(q *sqlcgen.Queries) *Service {
	return &Service{q: q}
}

// Resolve returns the rewritten target URL for the given slug. Looks up
// the link, fetches the owning user (for the creator handle in affiliate
// rules), applies the affiliate rule, returns (link, rewritten URL, err).
func (s *Service) Resolve(ctx context.Context, slug string) (sqlcgen.Link, string, error) {
	link, err := s.q.GetLinkBySlug(ctx, slug)
	if err != nil {
		return sqlcgen.Link{}, "", err
	}
	owner, err := s.q.GetUserByID(ctx, link.UserID)
	if err != nil {
		return sqlcgen.Link{}, "", err
	}
	creatorHandle := ""
	if owner.Handle.Valid {
		creatorHandle = owner.Handle.String
	}
	rewritten, err := affiliate.Apply(link.OriginalUrl, link.Retailer, creatorHandle)
	if err != nil {
		return sqlcgen.Link{}, "", err
	}
	return link, rewritten, nil
}

// LogClick fires-and-forgets a click event. Best-effort; errors are
// swallowed because we don't want a click count failure to block the
// 302 response to the user.
func (s *Service) LogClick(ctx context.Context, link sqlcgen.Link, uaKind, refererHost string) {
	_ = s.q.InsertClickEvent(ctx, sqlcgen.InsertClickEventParams{
		LinkID:        link.ID,
		CountryCode:   pgtype.Text{},
		UserAgentKind: nullText(uaKind),
		RefererHost:   nullText(refererHost),
	})
	_ = s.q.BumpClickDaily(ctx, link.ID)
}

func nullText(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: s, Valid: true}
}
