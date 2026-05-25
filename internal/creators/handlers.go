package creators

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/mayur-tolexo/shoplit/internal/auth"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
)

// RegisterPublicRoutes mounts the unauthenticated discover/profile endpoints
// (expected under /api/public, so the full paths are /api/public/creators[/...]).
// The optional viewer session is read via sm (nil-safe), so isFollowing
// reflects a logged-in viewer when present.
func RegisterPublicRoutes(r chi.Router, svc *Service, sm *auth.SessionManager) {
	r.Get("/creators", discoverCreators(svc, sm))
	r.Get("/creators/{handle}", getCreatorProfile(svc, sm))
}

// RegisterRoutes mounts the authenticated follow/unfollow + following feed
// endpoints (expected under /api/v1, already behind RequireUser).
func RegisterRoutes(r chi.Router, svc *Service) {
	r.Post("/creators/{handle}/follow", followCreator(svc))
	r.Delete("/creators/{handle}/follow", unfollowCreator(svc))
	r.Get("/following", followingFeed(svc))
}

func discoverCreators(svc *Service, sm *auth.SessionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := queryInt(r, "limit")
		offset := queryInt(r, "offset")
		// q present (after trim) → search; absent/empty → popularity-ranked discover.
		// Both return DiscoverCreatorsRow, so the marshal path below is shared.
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		var (
			rows []sqlcgen.DiscoverCreatorsRow
			err  error
		)
		if q != "" {
			rows, err = svc.SearchCreators(r.Context(), q, limit, offset)
		} else {
			rows, err = svc.DiscoverCreators(r.Context(), limit, offset)
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// Optional viewer session → fill isFollowing per row.
		var viewerID int64
		if sm != nil {
			if id, err := sm.GetUser(r); err == nil {
				viewerID = id
			}
		}
		out := make([]CreatorJSON, 0, len(rows))
		for _, row := range rows {
			out = append(out, MarshalCreator(row, svc.IsFollowing(r.Context(), viewerID, row.ID)))
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func getCreatorProfile(svc *Service, sm *auth.SessionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		handle := chi.URLParam(r, "handle")
		var viewerID int64
		if sm != nil {
			if id, err := sm.GetUser(r); err == nil {
				viewerID = id
			}
		}
		creator, cartsJSON, err := svc.GetCreatorProfile(r.Context(), handle, viewerID)
		if errors.Is(err, pgx.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"creator": creator,
			"carts":   cartsJSON,
		})
	}
}

func followCreator(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := auth.UserIDFromContext(r.Context())
		handle := chi.URLParam(r, "handle")
		count, err := svc.Follow(r.Context(), uid, handle)
		if errors.Is(err, pgx.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		if errors.Is(err, ErrSelfFollow) {
			http.Error(w, "cannot follow yourself", http.StatusBadRequest)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"following":     true,
			"followerCount": count,
		})
	}
}

func unfollowCreator(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := auth.UserIDFromContext(r.Context())
		handle := chi.URLParam(r, "handle")
		count, err := svc.Unfollow(r.Context(), uid, handle)
		if errors.Is(err, pgx.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"following":     false,
			"followerCount": count,
		})
	}
}

func followingFeed(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := auth.UserIDFromContext(r.Context())
		limit := queryInt(r, "limit")
		offset := queryInt(r, "offset")
		feed, err := svc.FollowingFeed(r.Context(), uid, limit, offset)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, feed)
	}
}

// queryInt parses an int32 query param, returning 0 when absent/invalid so the
// service applies its defaults (limit→24, offset→0).
func queryInt(r *http.Request, key string) int32 {
	v := r.URL.Query().Get(key)
	if v == "" {
		return 0
	}
	n, err := strconv.ParseInt(v, 10, 32)
	if err != nil {
		return 0
	}
	return int32(n)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
