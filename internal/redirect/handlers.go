package redirect

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/mayur-tolexo/shoplit/internal/analytics"
	"github.com/mayur-tolexo/shoplit/internal/httpx"
)

// RegisterRoutes mounts /go/{slug} and /p/{slug} (both call the same handler).
func RegisterRoutes(r chi.Router, svc *Service) {
	h := redirectHandler(svc)
	r.Get("/go/{slug}", h)
	r.Get("/p/{slug}", h)
}

func redirectHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")
		link, target, err := svc.Resolve(r.Context(), slug)
		if errors.Is(err, pgx.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// Don't count the owner's own clicks on their own cart. Record a
		// salted visitor hash for unique-reach (raw IP is never stored).
		if svc.ViewerID(r) != link.UserID {
			vhash := analytics.VisitorHash(httpx.ClientIP(r), svc.Salt())
			go svc.LogClick(context.Background(), link, detectUAKind(r), refererHost(r), vhash)
		}
		http.Redirect(w, r, target, http.StatusFound)
	}
}

func detectUAKind(r *http.Request) string {
	ua := strings.ToLower(r.Header.Get("User-Agent"))
	switch {
	case strings.Contains(ua, "iphone"), strings.Contains(ua, "ipad"):
		return "ios"
	case strings.Contains(ua, "android"):
		return "android"
	case ua == "":
		return "other"
	default:
		return "desktop"
	}
}

func refererHost(r *http.Request) string {
	ref := r.Header.Get("Referer")
	if ref == "" {
		return ""
	}
	u, err := url.Parse(ref)
	if err != nil {
		return ""
	}
	return u.Host
}
