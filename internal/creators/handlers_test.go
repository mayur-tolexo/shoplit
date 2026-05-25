package creators_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/creators"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// hEnv holds the wired router and the two seeded user ids the handler tests use.
type hEnv struct {
	r       http.Handler
	viewer  int64 // the injected authed user for /api/v1 routes
	creator int64
}

func setupHandlers(t *testing.T) hEnv {
	t.Helper()
	env := setupSvc(t)

	viewer := newUser(t, env.q, "g-viewer", "viewer@example.com", "Viewer")
	creator := newUser(t, env.q, "g-creator", "creator@example.com", "Creator")
	// Creator needs a public cart to appear in discover/profile.
	publicCart(t, env.cartsSvc, creator, "Creator Cart")

	r := chi.NewRouter()
	// Authed routes: inject the viewer as the fixed user (bypasses RequireUser).
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(injectFixedUser(viewer))
		creators.RegisterRoutes(r, env.svc)
	})
	// Public routes: nil SessionManager → anonymous viewer (isFollowing=false).
	r.Route("/api/public", func(r chi.Router) {
		creators.RegisterPublicRoutes(r, env.svc, nil)
	})
	return hEnv{r: r, viewer: viewer, creator: creator}
}

// injectFixedUser bypasses RequireUser to inject a fixed user_id into context —
// keeps these tests focused on handlers, not auth (mirrors carts/handlers_test).
func injectFixedUser(uid int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := auth.WithUserID(r.Context(), uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func do(t *testing.T, r http.Handler, method, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

func TestPOSTFollow_ReturnsBody(t *testing.T) {
	env := setupHandlers(t)
	rr := do(t, env.r, http.MethodPost, "/api/v1/creators/creator/follow")
	assert.Equal(t, http.StatusOK, rr.Code)
	var out map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &out))
	assert.Equal(t, true, out["following"])
	assert.Equal(t, float64(1), out["followerCount"])
}

func TestDELETEFollow_ReturnsBody(t *testing.T) {
	env := setupHandlers(t)
	// Follow first, then unfollow.
	do(t, env.r, http.MethodPost, "/api/v1/creators/creator/follow")
	rr := do(t, env.r, http.MethodDelete, "/api/v1/creators/creator/follow")
	assert.Equal(t, http.StatusOK, rr.Code)
	var out map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &out))
	assert.Equal(t, false, out["following"])
	assert.Equal(t, float64(0), out["followerCount"])
}

func TestPOSTFollow_SelfFollow400(t *testing.T) {
	env := setupHandlers(t)
	// The injected user is `viewer`; following @viewer is a self-follow.
	rr := do(t, env.r, http.MethodPost, "/api/v1/creators/viewer/follow")
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestPOSTFollow_UnknownHandle404(t *testing.T) {
	env := setupHandlers(t)
	rr := do(t, env.r, http.MethodPost, "/api/v1/creators/ghost/follow")
	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestGETDiscover_ReturnsCreators(t *testing.T) {
	env := setupHandlers(t)
	rr := do(t, env.r, http.MethodGet, "/api/public/creators")
	assert.Equal(t, http.StatusOK, rr.Code)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &list))
	require.Len(t, list, 1)
	assert.Equal(t, "creator", list[0]["handle"])
	assert.Equal(t, float64(1), list[0]["cartCount"])
	assert.Equal(t, false, list[0]["isFollowing"], "anonymous viewer is never following")
}

func TestGETDiscover_WithQueryFiltersSubset(t *testing.T) {
	env := setupSvc(t)

	// Two discoverable creators; handles are derived from the email local-part.
	zelda := newUser(t, env.q, "g-zelda", "zelda@example.com", "Zelda")
	frank := newUser(t, env.q, "g-frank", "frank@example.com", "Frank")
	publicCart(t, env.cartsSvc, zelda, "Z Cart")
	publicCart(t, env.cartsSvc, frank, "F Cart")

	r := chi.NewRouter()
	r.Route("/api/public", func(r chi.Router) {
		creators.RegisterPublicRoutes(r, env.svc, nil)
	})

	// No q → both creators.
	all := do(t, r, http.MethodGet, "/api/public/creators")
	assert.Equal(t, http.StatusOK, all.Code)
	var allList []map[string]any
	require.NoError(t, json.Unmarshal(all.Body.Bytes(), &allList))
	require.Len(t, allList, 2)

	// q=zel → only the matching creator.
	rr := do(t, r, http.MethodGet, "/api/public/creators?q=zel")
	assert.Equal(t, http.StatusOK, rr.Code)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &list))
	require.Len(t, list, 1)
	assert.Equal(t, "zelda", list[0]["handle"])
	assert.Equal(t, false, list[0]["isFollowing"], "anonymous viewer is never following")
}

func TestGETDiscover_BlankQueryUnchanged(t *testing.T) {
	env := setupHandlers(t)
	// A q of only whitespace trims to empty → identical to no-q discover.
	rr := do(t, env.r, http.MethodGet, "/api/public/creators?q=%20%20")
	assert.Equal(t, http.StatusOK, rr.Code)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &list))
	require.Len(t, list, 1)
	assert.Equal(t, "creator", list[0]["handle"])
}

func TestGETProfile_ReturnsCreatorAndCarts(t *testing.T) {
	env := setupHandlers(t)
	rr := do(t, env.r, http.MethodGet, "/api/public/creators/creator")
	assert.Equal(t, http.StatusOK, rr.Code)
	var out struct {
		Creator map[string]any   `json:"creator"`
		Carts   []map[string]any `json:"carts"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &out))
	assert.Equal(t, "creator", out.Creator["handle"])
	require.Len(t, out.Carts, 1)
	assert.Equal(t, "Creator Cart", out.Carts[0]["title"])
}

func TestGETProfile_UnknownHandle404(t *testing.T) {
	env := setupHandlers(t)
	rr := do(t, env.r, http.MethodGet, "/api/public/creators/ghost")
	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestGETFollowing_ReturnsArray(t *testing.T) {
	env := setupHandlers(t)
	// Follow the creator so their public cart shows in the feed.
	do(t, env.r, http.MethodPost, "/api/v1/creators/creator/follow")
	rr := do(t, env.r, http.MethodGet, "/api/v1/following")
	assert.Equal(t, http.StatusOK, rr.Code)
	var feed []map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &feed))
	require.Len(t, feed, 1)
	assert.Equal(t, "Creator Cart", feed[0]["title"])
}

func TestGETFollowing_EmptyForNoFollows(t *testing.T) {
	env := setupHandlers(t)
	rr := do(t, env.r, http.MethodGet, "/api/v1/following")
	assert.Equal(t, http.StatusOK, rr.Code)
	var feed []map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &feed))
	assert.Empty(t, feed)
}
