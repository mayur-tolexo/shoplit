package auth_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/db"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
)

// fakeGoogleServer simulates Google's token + userinfo endpoints.
func fakeGoogleServer(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"fake-access","token_type":"Bearer","expires_in":3600}`))
	})
	mux.HandleFunc("/userinfo", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"sub":            "google-sub-12345",
			"email":          "priya@example.com",
			"email_verified": true,
			"name":           "Priya Sharma",
			"picture":        "https://example.com/avatar.jpg",
		})
	})
	return httptest.NewServer(mux)
}

func TestGoogleCallback_HappyPath(t *testing.T) {
	pool, dsn := testutil.NewPostgres(t)
	require.NoError(t, db.MigrateUp(dsn, "../db/migrations"))
	q := sqlcgen.New(pool)

	fake := fakeGoogleServer(t)
	defer fake.Close()

	sm := auth.NewSessionManager("test-secret")
	cfg := &oauth2.Config{
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		RedirectURL:  "http://localhost/callback",
		Endpoint: oauth2.Endpoint{
			AuthURL:  fake.URL + "/auth",
			TokenURL: fake.URL + "/token",
		},
		Scopes: []string{"openid", "email", "profile"},
	}
	userinfoURL := fake.URL + "/userinfo"

	upsert := auth.NewUserUpsertFn(q)
	handler := auth.HandleGoogleCallback(cfg, sm, upsert, "http://localhost:3000", userinfoURL)

	// Pre-set state cookie
	rrPre := httptest.NewRecorder()
	sm.SetTemp(rrPre, "oauth_state", "fixed-state-value")
	stateCookie := rrPre.Result().Cookies()[0]

	req := httptest.NewRequest("GET", "/api/v1/auth/google/callback?state=fixed-state-value&code=fake-code", nil)
	req.AddCookie(stateCookie)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusFound, rr.Code)
	assert.True(t, strings.HasPrefix(rr.Header().Get("Location"), "http://localhost:3000/dashboard"))

	// Should have set session cookie
	hasSession := false
	for _, c := range rr.Result().Cookies() {
		if c.Name == auth.SessionCookie && c.Value != "" {
			hasSession = true
		}
	}
	assert.True(t, hasSession, "expected session cookie to be set")

	// User should be in DB
	user, err := q.GetUserByGoogleSub(context.Background(), pgtype.Text{String: "google-sub-12345", Valid: true})
	require.NoError(t, err)
	assert.Equal(t, "Priya Sharma", user.DisplayName)
}

func TestGoogleCallback_RejectsBadState(t *testing.T) {
	sm := auth.NewSessionManager("test-secret")
	handler := auth.HandleGoogleCallback(&oauth2.Config{}, sm, nil, "http://x", "http://x")

	req := httptest.NewRequest("GET", "/callback?state=wrong&code=c", nil)
	rr := httptest.NewRecorder()
	// no state cookie — state mismatch
	handler.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandleLogout(t *testing.T) {
	sm := auth.NewSessionManager("test-secret")
	rr := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/v1/auth/logout", nil)
	auth.HandleLogout(sm).ServeHTTP(rr, req)
	assert.Equal(t, http.StatusNoContent, rr.Code)
}
