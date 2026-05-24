package auth

import (
	"net/http"
	"strings"
)

// RequireUser is a middleware that authenticates the request via the session
// cookie and injects the user_id into context. Falls back to Bearer token if a
// BearerResolver is configured. 401 if neither succeeds.
func (s *SessionManager) RequireUser() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid, err := s.GetUser(r)
			if err != nil && s.bearer != nil {
				if tok := bearerToken(r); tok != "" {
					if id, berr := s.bearer(r.Context(), tok); berr == nil {
						uid, err = id, nil
					}
				}
			}
			if err != nil {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r.WithContext(userIDContext(r.Context(), uid)))
		})
	}
}

func bearerToken(r *http.Request) string {
	const p = "Bearer "
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, p) {
		return strings.TrimSpace(h[len(p):])
	}
	return ""
}
