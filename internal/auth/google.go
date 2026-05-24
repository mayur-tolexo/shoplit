package auth

import (
	"encoding/json"
	"net/http"
	"strings"

	"golang.org/x/oauth2"
)

// safeNextPath returns p only if it is a safe same-site relative path
// (begins with a single "/", no scheme, no protocol-relative "//"). Otherwise "".
func safeNextPath(p string) string {
	if p == "" || p[0] != '/' {
		return ""
	}
	if strings.HasPrefix(p, "//") {
		return ""
	}
	if strings.Contains(p, "://") {
		return ""
	}
	return p
}

// GoogleUserInfo matches the response from https://www.googleapis.com/oauth2/v3/userinfo.
type GoogleUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

// GoogleConfig builds the oauth2.Config for Google sign-in.
func GoogleConfig(clientID, clientSecret, redirectURL string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     googleEndpoint,
	}
}

// googleEndpoint is a var (not const) so tests can swap it with a fake.
var googleEndpoint = oauth2.Endpoint{
	AuthURL:  "https://accounts.google.com/o/oauth2/v2/auth",
	TokenURL: "https://oauth2.googleapis.com/token",
}

// GoogleUserInfoURL is also a var so tests can swap.
var GoogleUserInfoURL = "https://www.googleapis.com/oauth2/v3/userinfo"

// UpsertFn is called with the userinfo response. It should insert/update the
// row in `users` and return the local user_id.
type UpsertFn func(GoogleUserInfo) (int64, error)

// HandleGoogleStart kicks off the OAuth flow.
func HandleGoogleStart(cfg *oauth2.Config, sm *SessionManager) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		state, err := RandomString(24)
		if err != nil {
			http.Error(w, "state gen", http.StatusInternalServerError)
			return
		}
		sm.SetTemp(w, "oauth_state", state)
		if next := safeNextPath(r.URL.Query().Get("next")); next != "" {
			sm.SetTemp(w, "oauth_next", next)
		}
		http.Redirect(w, r, cfg.AuthCodeURL(state, oauth2.AccessTypeOnline), http.StatusFound)
	})
}

// HandleGoogleCallback validates state, exchanges code → token, fetches
// userinfo, upserts the user, sets the session cookie, redirects to the
// frontend.
func HandleGoogleCallback(cfg *oauth2.Config, sm *SessionManager, upsert UpsertFn, frontendURL, userinfoURL string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		want, err := sm.GetTemp(r, "oauth_state")
		if err != nil || r.URL.Query().Get("state") != want {
			http.Error(w, "invalid oauth state", http.StatusBadRequest)
			return
		}
		sm.ClearTemp(w, "oauth_state")

		token, err := cfg.Exchange(r.Context(), r.URL.Query().Get("code"))
		if err != nil {
			http.Error(w, "token exchange failed: "+err.Error(), http.StatusInternalServerError)
			return
		}

		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, userinfoURL, nil)
		if err != nil {
			http.Error(w, "userinfo req: "+err.Error(), http.StatusInternalServerError)
			return
		}
		req.Header.Set("Authorization", "Bearer "+token.AccessToken)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			http.Error(w, "userinfo fetch: "+err.Error(), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		var info GoogleUserInfo
		if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
			http.Error(w, "userinfo decode: "+err.Error(), http.StatusInternalServerError)
			return
		}
		if info.Sub == "" {
			http.Error(w, "google: missing sub claim", http.StatusBadGateway)
			return
		}

		uid, err := upsert(info)
		if err != nil {
			http.Error(w, "upsert: "+err.Error(), http.StatusInternalServerError)
			return
		}

		sm.SetUser(w, uid)

		dest := "/dashboard"
		if next, err := sm.GetTemp(r, "oauth_next"); err == nil {
			if safe := safeNextPath(next); safe != "" {
				dest = safe
			}
		}
		sm.ClearTemp(w, "oauth_next")
		http.Redirect(w, r, frontendURL+dest, http.StatusFound)
	})
}

// HandleLogout clears the session and 204s.
func HandleLogout(sm *SessionManager) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sm.Logout(w)
		w.WriteHeader(http.StatusNoContent)
	})
}
