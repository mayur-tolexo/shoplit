package auth

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
)

// NewUserUpsertFn returns an UpsertFn that writes the Google profile into
// the `users` table. Handle is derived from the email local-part (e.g.
// "priya@example.com" → "priya"); collisions are tolerated by appending a
// short random suffix and retrying once.
func NewUserUpsertFn(q *sqlcgen.Queries) UpsertFn {
	return func(info GoogleUserInfo) (int64, error) {
		handle := sanitizeHandle(strings.Split(info.Email, "@")[0])

		params := sqlcgen.UpsertGoogleUserParams{
			GoogleSub:   pgtype.Text{String: info.Sub, Valid: true},
			Email:       pgtype.Text{String: info.Email, Valid: info.Email != ""},
			DisplayName: info.Name,
			AvatarUrl:   pgtype.Text{String: info.Picture, Valid: info.Picture != ""},
			Handle:      pgtype.Text{String: handle, Valid: handle != ""},
		}
		user, err := q.UpsertGoogleUser(context.Background(), params)
		if err != nil {
			// Handle collision (handle is UNIQUE) — try again with random suffix.
			suffix, _ := RandomString(4)
			handle = handle + "-" + suffix[:6]
			params.Handle = pgtype.Text{String: handle, Valid: true}
			user, err = q.UpsertGoogleUser(context.Background(), params)
			if err != nil {
				return 0, err
			}
		}
		return user.ID, nil
	}
}

func sanitizeHandle(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
