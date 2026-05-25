package redirect

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mayur-tolexo/shoplit/internal/affiliate"
	"github.com/mayur-tolexo/shoplit/internal/auth"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
)

type Service struct {
	q    *sqlcgen.Queries
	sm   *auth.SessionManager
	salt string
}

func NewService(q *sqlcgen.Queries, sm *auth.SessionManager, salt string) *Service {
	return &Service{q: q, sm: sm, salt: salt}
}

// ViewerID returns the logged-in user id from the request, or 0 if anonymous.
func (s *Service) ViewerID(r *http.Request) int64 {
	if s.sm == nil {
		return 0
	}
	id, err := s.sm.GetUser(r)
	if err != nil {
		return 0
	}
	return id
}

// Salt exposes the hashing salt for the handler.
func (s *Service) Salt() string { return s.salt }

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
func (s *Service) LogClick(ctx context.Context, link sqlcgen.Link, uaKind, refererHost, visitorHash string) {
	_ = s.q.InsertClickEvent(ctx, sqlcgen.InsertClickEventParams{
		LinkID:        link.ID,
		CountryCode:   pgtype.Text{},
		UserAgentKind: nullText(uaKind),
		RefererHost:   nullText(refererHost),
		VisitorHash:   nullText(visitorHash),
	})
	_ = s.q.BumpClickDaily(ctx, link.ID)
}

func nullText(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: s, Valid: true}
}
