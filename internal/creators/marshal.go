package creators

import (
	"github.com/jackc/pgx/v5/pgtype"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
)

// CreatorJSON is the frontend-compatible JSON shape for a creator. Field names
// are normative (shared with the Next.js `Creator` type).
type CreatorJSON struct {
	Handle        string `json:"handle"`
	DisplayName   string `json:"displayName"`
	AvatarURL     string `json:"avatarUrl"`
	CartCount     int    `json:"cartCount"`
	FollowerCount int    `json:"followerCount"`
	IsFollowing   bool   `json:"isFollowing"`
}

// MarshalCreator converts a DiscoverCreators row into the frontend CreatorJSON
// shape. isFollowing is supplied by the handler (it depends on the viewer).
func MarshalCreator(row sqlcgen.DiscoverCreatorsRow, isFollowing bool) CreatorJSON {
	return CreatorJSON{
		Handle:        pgTextStr(row.Handle),
		DisplayName:   row.DisplayName,
		AvatarURL:     pgTextStr(row.AvatarUrl),
		CartCount:     int(row.CartCount),
		FollowerCount: int(row.FollowerCount),
		IsFollowing:   isFollowing,
	}
}

// MarshalCreatorProfile converts a user row plus its counts into CreatorJSON.
// Used by the profile endpoint, where cartCount/followerCount are computed
// alongside the carts rather than coming from the discover aggregate.
func MarshalCreatorProfile(u sqlcgen.User, cartCount, followerCount int, isFollowing bool) CreatorJSON {
	return CreatorJSON{
		Handle:        pgTextStr(u.Handle),
		DisplayName:   u.DisplayName,
		AvatarURL:     pgTextStr(u.AvatarUrl),
		CartCount:     cartCount,
		FollowerCount: followerCount,
		IsFollowing:   isFollowing,
	}
}

func pgTextStr(t pgtype.Text) string {
	if !t.Valid {
		return ""
	}
	return t.String
}

// pgText wraps a non-empty string as a valid pgtype.Text (empty → invalid/NULL).
func pgText(s string) pgtype.Text {
	return pgtype.Text{String: s, Valid: s != ""}
}
