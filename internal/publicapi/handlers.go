// Package publicapi serves unauthenticated read endpoints at /api/public/*.
package publicapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/mayur-tolexo/shoplit/internal/carts"
)

// RegisterRoutes mounts /carts/{slug} under the parent router (expected to
// be mounted at /api/public so the full path is /api/public/carts/{slug}).
func RegisterRoutes(r chi.Router, svc *carts.Service) {
	r.Get("/carts/{slug}", getPublicCart(svc))
}

func getPublicCart(svc *carts.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")
		cart, items, user, err := svc.GetPublicCart(r.Context(), slug)
		if errors.Is(err, pgx.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(carts.MarshalCart(cart, user, items))
	}
}
