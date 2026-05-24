package httpx

import "net/http"

// CORS returns a middleware that allows credentialed cross-origin requests
// from exactly `allowedOrigin`. We echo the specific origin (never "*",
// which is incompatible with credentials) and set Allow-Credentials so the
// browser includes and accepts the session cookie on XHR/fetch calls.
//
// In dev the frontend (http://localhost:3000) and API (http://localhost:8080)
// are different origins but the same site, so the SameSite=Lax session
// cookie is sent on these requests.
func CORS(allowedOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin == allowedOrigin {
				h := w.Header()
				h.Set("Access-Control-Allow-Origin", allowedOrigin)
				h.Set("Access-Control-Allow-Credentials", "true")
				h.Set("Vary", "Origin")
				h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "Content-Type")
				h.Set("Access-Control-Max-Age", "300")
			}
			// Short-circuit preflight.
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
