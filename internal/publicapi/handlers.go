// Package publicapi serves unauthenticated read endpoints at /api/public/*.
package publicapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/carts"
)

// RegisterRoutes mounts /carts/{slug} under the parent router (expected to
// be mounted at /api/public so the full path is /api/public/carts/{slug}).
func RegisterRoutes(r chi.Router, svc *carts.Service, sm *auth.SessionManager) {
	r.Get("/carts/{slug}", getPublicCart(svc, sm))
}

func getPublicCart(svc *carts.Service, sm *auth.SessionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")
		var viewerID int64
		if sm != nil {
			if id, err := sm.GetUser(r); err == nil {
				viewerID = id
			}
		}
		cart, items, user, err := svc.GetPublicCart(r.Context(), slug, viewerID)
		if errors.Is(err, pgx.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(carts.MarshalCart(cart, user, items, 0, 0, 0))
	}
}
