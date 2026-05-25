package creators

import (
	"time"

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
	// IsSelf is true only on the profile endpoint when the logged-in viewer is
	// the creator. It is always false for discover/search rows (the viewer is
	// excluded from those at the query level).
	IsSelf bool `json:"isSelf"`
}

// MarshalCreator converts a DiscoverCreators row into the frontend CreatorJSON
// shape. isFollowing is supplied by the handler (it depends on the viewer).
// isSelf is always false here: the viewer is excluded from discover/search at
// the query level, so a row can never be the viewer themselves.
func MarshalCreator(row sqlcgen.DiscoverCreatorsRow, isFollowing bool) CreatorJSON {
	return CreatorJSON{
		Handle:        pgTextStr(row.Handle),
		DisplayName:   row.DisplayName,
		AvatarURL:     pgTextStr(row.AvatarUrl),
		CartCount:     int(row.CartCount),
		FollowerCount: int(row.FollowerCount),
		IsFollowing:   isFollowing,
		IsSelf:        false,
	}
}

// MarshalCreatorProfile converts a user row plus its counts into CreatorJSON.
// Used by the profile endpoint, where cartCount/followerCount are computed
// alongside the carts rather than coming from the discover aggregate. isSelf is
// set when the viewer is the creator (the frontend then hides the Follow button).
func MarshalCreatorProfile(u sqlcgen.User, cartCount, followerCount int, isFollowing, isSelf bool) CreatorJSON {
	return CreatorJSON{
		Handle:        pgTextStr(u.Handle),
		DisplayName:   u.DisplayName,
		AvatarURL:     pgTextStr(u.AvatarUrl),
		CartCount:     cartCount,
		FollowerCount: followerCount,
		IsFollowing:   isFollowing,
		IsSelf:        isSelf,
	}
}

// NotificationItemJSON is the frontend-compatible JSON shape for one new-cart
// notification. Field names are normative (shared with the Next.js
// NotificationItem type).
type NotificationItemJSON struct {
	CartSlug           string `json:"cartSlug"`
	CartTitle          string `json:"cartTitle"`
	CreatorHandle      string `json:"creatorHandle"`
	CreatorDisplayName string `json:"creatorDisplayName"`
	CreatorAvatarURL   string `json:"creatorAvatarUrl"`
	CreatedAt          string `json:"createdAt"`
	Unread             bool   `json:"unread"`
}

// MarshalNotifications converts ListNotifications rows into the frontend
// NotificationItemJSON shape: null pg text → "", timestamps → RFC3339. The
// returned slice is non-nil (empty for no rows) so the handler can write [].
func MarshalNotifications(rows []sqlcgen.ListNotificationsRow) []NotificationItemJSON {
	out := make([]NotificationItemJSON, 0, len(rows))
	for _, r := range rows {
		out = append(out, NotificationItemJSON{
			CartSlug:           r.Slug,
			CartTitle:          r.Title,
			CreatorHandle:      pgTextStr(r.Handle),
			CreatorDisplayName: r.DisplayName,
			CreatorAvatarURL:   pgTextStr(r.AvatarUrl),
			CreatedAt:          r.CreatedAt.Time.Format(time.RFC3339),
			Unread:             r.Unread,
		})
	}
	return out
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
