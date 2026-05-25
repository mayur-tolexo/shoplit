package admin

import (
	"net/http"

	"github.com/mayur-tolexo/shoplit/internal/auth"
)

// RequireAdmin gates a handler chain to admin users. It reads the user_id
// injected by auth.RequireUser (so it must be mounted inside the authenticated
// group) and returns 403 when the caller isn't present or isn't an admin.
//
// The unauthenticated case is already handled by auth.RequireUser (401); here a
// missing user_id can only mean a misconfiguration, so it fails closed as 403.
func RequireAdmin(isAdmin func(int64) bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid, ok := auth.UserIDFromContext(r.Context())
			if !ok || !isAdmin(uid) {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
