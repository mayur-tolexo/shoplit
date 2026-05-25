package carts

import (
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
)

// CartJSON is the frontend-compatible JSON shape for a cart.
type CartJSON struct {
	ID               string        `json:"id"`
	Slug             string        `json:"slug"`
	OwnerHandle      string        `json:"ownerHandle"`
	OwnerDisplayName string        `json:"ownerDisplayName"`
	OwnerAvatarURL   string        `json:"ownerAvatarUrl"`
	Title            string        `json:"title"`
	Bio              string        `json:"bio,omitempty"`
	CoverImageURL    string        `json:"coverImageUrl"`
	AccentHex        string        `json:"accentHex"`
	Products         []ProductJSON `json:"products"`
	Visibility       string        `json:"visibility"`
	ViewsLast7d      int           `json:"viewsLast7d"`
	ClicksLast7d     int           `json:"clicksLast7d"`
	ReachLast7d      int           `json:"reachLast7d"`
	CreatedAt        string        `json:"createdAt"`
	UpdatedAt        string        `json:"updatedAt"`
}

// ProductJSON is the frontend-compatible JSON shape for a cart item.
type ProductJSON struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	ImageURL    string `json:"imageUrl"`
	PriceText   string `json:"priceText"`
	Retailer    string `json:"retailer"`
	Note        string `json:"note,omitempty"`
	OriginalURL string `json:"originalUrl"`
	GoSlug      string `json:"goSlug"`
}

// UserJSON is the frontend-compatible JSON shape for a user profile.
type UserJSON struct {
	ID          string `json:"id"`
	Handle      string `json:"handle"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl"`
}

// MarshalUser converts a sqlc User into the frontend UserJSON shape.
func MarshalUser(u sqlcgen.User) UserJSON {
	return UserJSON{
		ID:          intStr(u.ID),
		Handle:      pgTextStr(u.Handle),
		DisplayName: u.DisplayName,
		AvatarURL:   pgTextStr(u.AvatarUrl),
	}
}

// MarshalCart converts a sqlc Cart, its owner, and item rows into CartJSON.
// viewsLast7d/clicksLast7d/reachLast7d are the analytics counts (0 where not needed, e.g.
// the public page that doesn't display them).
func MarshalCart(c sqlcgen.Cart, owner sqlcgen.User, items []sqlcgen.ListCartItemsRow, viewsLast7d, clicksLast7d, reachLast7d int) CartJSON {
	out := CartJSON{
		ID:               intStr(c.ID),
		Slug:             c.Slug,
		OwnerHandle:      pgTextStr(owner.Handle),
		OwnerDisplayName: owner.DisplayName,
		OwnerAvatarURL:   pgTextStr(owner.AvatarUrl),
		Title:            c.Title,
		Bio:              pgTextStr(c.Description),
		CoverImageURL:    pgTextStr(c.CoverImageUrl),
		Visibility:       c.Visibility,
		AccentHex:        "#B5532A",
		ViewsLast7d:      viewsLast7d,
		ClicksLast7d:     clicksLast7d,
		ReachLast7d:      reachLast7d,
		CreatedAt:        c.CreatedAt.Time.Format(time.RFC3339),
		UpdatedAt:        c.UpdatedAt.Time.Format(time.RFC3339),
	}
	for _, it := range items {
		out.Products = append(out.Products, ProductJSON{
			ID:          intStr(it.ID),
			Title:       it.Title,
			ImageURL:    pgTextStr(it.ImageUrl),
			PriceText:   pgTextStr(it.PriceText),
			Retailer:    pgTextStr(it.Retailer),
			Note:        pgTextStr(it.Description),
			OriginalURL: it.OriginalUrl,
			GoSlug:      it.LinkSlug,
		})
	}
	if out.Products == nil {
		out.Products = []ProductJSON{}
	}
	return out
}

// DailyStatJSON is the frontend-compatible JSON shape for a single day's stats.
type DailyStatJSON struct {
	Date   string `json:"date"`
	Views  int    `json:"views"`
	Clicks int    `json:"clicks"`
}

// MarshalDailyStats converts a DailyStat series into JSON shapes, formatting the
// date as "YYYY-MM-DD". Always returns a non-nil slice so it serializes as [].
func MarshalDailyStats(stats []DailyStat) []DailyStatJSON {
	out := make([]DailyStatJSON, 0, len(stats))
	for _, s := range stats {
		out = append(out, DailyStatJSON{
			Date:   s.Date.Format("2006-01-02"),
			Views:  int(s.Views),
			Clicks: int(s.Clicks),
		})
	}
	return out
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
