package httpx_test

import (
	"net/http/httptest"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/httpx"
)

func TestClientIP(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("X-Forwarded-For", "203.0.113.7, 10.0.0.1")
	if got := httpx.ClientIP(r); got != "203.0.113.7" {
		t.Fatalf("XFF first hop: got %q", got)
	}
	r2 := httptest.NewRequest("GET", "/", nil)
	r2.RemoteAddr = "198.51.100.9:54321"
	if got := httpx.ClientIP(r2); got != "198.51.100.9" {
		t.Fatalf("RemoteAddr host: got %q", got)
	}
}
