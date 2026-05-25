package admin

import (
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
)

// OverviewJSON is the normative JSON shape for GET /admin/overview.
type OverviewJSON struct {
	Users        int64 `json:"users"`
	Carts        int64 `json:"carts"`
	PublicCarts  int64 `json:"publicCarts"`
	PrivateCarts int64 `json:"privateCarts"`
	Products     int64 `json:"products"`
	Follows      int64 `json:"follows"`
	Views7d      int64 `json:"views7d"`
	Clicks7d     int64 `json:"clicks7d"`
}

// MarshalOverview converts an Overview into its JSON shape. The two structs are
// field-for-field identical, so a direct conversion suffices (the JSON tags live
// on OverviewJSON).
func MarshalOverview(o Overview) OverviewJSON {
	return OverviewJSON(o)
}

// AdminUserJSON is the normative JSON shape for one row of GET /admin/users.
type AdminUserJSON struct {
	ID          string `json:"id"`
	Handle      string `json:"handle"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl"`
	Email       string `json:"email"`
	CreatedAt   string `json:"createdAt"`
	Carts       int64  `json:"carts"`
	Followers   int64  `json:"followers"`
	Following   int64  `json:"following"`
}

// MarshalAdminUser converts an AdminListUsers row into its JSON shape.
func MarshalAdminUser(row sqlcgen.AdminListUsersRow) AdminUserJSON {
	return AdminUserJSON{
		ID:          intStr(row.ID),
		Handle:      pgTextStr(row.Handle),
		DisplayName: row.DisplayName,
		AvatarURL:   pgTextStr(row.AvatarUrl),
		Email:       pgTextStr(row.Email),
		CreatedAt:   row.CreatedAt.Time.Format(time.RFC3339),
		Carts:       row.CartCount,
		Followers:   row.FollowerCount,
		Following:   row.FollowingCount,
	}
}

// AdminUserCartJSON is the normative JSON shape for one row of
// GET /admin/users/{id}/carts.
type AdminUserCartJSON struct {
	ID         string `json:"id"`
	Slug       string `json:"slug"`
	Title      string `json:"title"`
	Visibility string `json:"visibility"`
	Products   int64  `json:"products"`
	Views7d    int64  `json:"views7d"`
	Clicks7d   int64  `json:"clicks7d"`
	CreatedAt  string `json:"createdAt"`
}

// MarshalAdminUserCart converts an AdminUserCarts row into its JSON shape.
func MarshalAdminUserCart(row sqlcgen.AdminUserCartsRow) AdminUserCartJSON {
	return AdminUserCartJSON{
		ID:         intStr(row.ID),
		Slug:       row.Slug,
		Title:      row.Title,
		Visibility: row.Visibility,
		Products:   row.ProductCount,
		Views7d:    row.Views7d,
		Clicks7d:   row.Clicks7d,
		CreatedAt:  row.CreatedAt.Time.Format(time.RFC3339),
	}
}

func intStr(i int64) string {
	return strconv.FormatInt(i, 10)
}

func pgTextStr(t pgtype.Text) string {
	if !t.Valid {
		return ""
	}
	return t.String
}
