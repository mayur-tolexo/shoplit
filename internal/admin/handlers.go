package admin

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts the read-only admin endpoints under /admin on the parent
// router. It is expected to be mounted inside the authenticated /api/v1 group
// (already behind auth.RequireUser), so the full paths are /api/v1/admin/...
// Every route is gated by RequireAdmin (403 for non-admins).
func RegisterRoutes(parent chi.Router, svc *Service, isAdmin func(int64) bool) {
	parent.Route("/admin", func(r chi.Router) {
		r.Use(RequireAdmin(isAdmin))
		r.Get("/overview", getOverview(svc))
		r.Get("/users", listUsers(svc))
		r.Get("/users/{id}/carts", userCarts(svc))
	})
}

func getOverview(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ov, err := svc.Overview(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, MarshalOverview(ov))
	}
}

func listUsers(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := svc.ListUsers(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out := make([]AdminUserJSON, 0, len(rows))
		for _, row := range rows {
			out = append(out, MarshalAdminUser(row))
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func userCarts(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			http.Error(w, "bad id", http.StatusBadRequest)
			return
		}
		rows, err := svc.UserCarts(r.Context(), id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out := make([]AdminUserCartJSON, 0, len(rows))
		for _, row := range rows {
			out = append(out, MarshalAdminUserCart(row))
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
