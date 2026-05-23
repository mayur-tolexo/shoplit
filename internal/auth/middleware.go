package auth

import "net/http"

// RequireUser is a middleware that authenticates the request via the session
// cookie and injects the user_id into context. 401 if no/invalid cookie.
func (s *SessionManager) RequireUser() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid, err := s.GetUser(r)
			if err != nil {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r.WithContext(userIDContext(r.Context(), uid)))
		})
	}
}
