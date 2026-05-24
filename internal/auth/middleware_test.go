// internal/auth/middleware_test.go
package auth_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/auth"
)

func TestRequireUser_BearerFallback(t *testing.T) {
	sm := auth.NewSessionManager("test-secret").WithBearerResolver(
		func(_ context.Context, token string) (int64, error) {
			if token == "good" {
				return 42, nil
			}
			return 0, http.ErrNoCookie
		},
	)
	var gotUID int64
	h := sm.RequireUser()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUID, _ = auth.UserIDFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	// Valid bearer → 200 + uid.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	req.Header.Set("Authorization", "Bearer good")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK || gotUID != 42 {
		t.Fatalf("bearer good: code=%d uid=%d", rr.Code, gotUID)
	}

	// Bad bearer + no cookie → 401.
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	req2.Header.Set("Authorization", "Bearer nope")
	rr2 := httptest.NewRecorder()
	h.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusUnauthorized {
		t.Fatalf("bearer bad: code=%d", rr2.Code)
	}
}
