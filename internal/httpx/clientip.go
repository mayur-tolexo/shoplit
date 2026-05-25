package httpx

import (
	"net"
	"net/http"
	"strings"
)

// ClientIP returns the best-effort client IP: the first hop of X-Forwarded-For
// (set by the Caddy reverse proxy in prod), else the RemoteAddr host.
func ClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
