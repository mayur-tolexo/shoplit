// Package auth: HMAC-signed cookie session manager + (in middleware.go) the
// RequireUser middleware. Real OAuth flow lives in google.go.
//
// The cookie value format is `base64(user_id_string).hex(hmac-sha256)`. A
// wrong secret or tampered payload fails verification.
package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

const (
	SessionCookie    = "shoplit_session"
	tempCookiePrefix = "shoplit_temp_"
	sessionMaxAge    = 60 * 60 * 24 * 30 // 30 days
	tempMaxAge       = 600               // 10 minutes for OAuth state
)

type ctxKey struct{}

var userIDKey = ctxKey{}

// BearerResolver resolves a raw Bearer token to a user_id. Returns an error if
// the token is unknown or revoked. Wired in by main via WithBearerResolver.
type BearerResolver func(ctx context.Context, token string) (int64, error)

// SessionManager signs cookies with HMAC-SHA256 using a server secret.
type SessionManager struct {
	secret []byte
	// secure marks issued cookies Secure (HTTPS-only). Off in local dev
	// (plain http); MUST be on in production (served over HTTPS).
	secure bool
}

func NewSessionManager(secret string) *SessionManager {
	return &SessionManager{secret: []byte(secret)}
}

// WithSecure toggles the Secure attribute on issued cookies and returns the
// manager for chaining. Production (HTTPS) should pass true.
func (s *SessionManager) WithSecure(secure bool) *SessionManager {
	s.secure = secure
	return s
}

// SetUser sets the session cookie containing the authenticated user_id.
func (s *SessionManager) SetUser(w http.ResponseWriter, userID int64) {
	val := s.sign(strconv.FormatInt(userID, 10))
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    val,
		Path:     "/",
		MaxAge:   sessionMaxAge,
		HttpOnly: true,
		Secure:   s.secure,
		SameSite: http.SameSiteLaxMode,
	})
}

// GetUser returns the authenticated user_id from the session cookie, or an
// error if missing / tampered / wrong secret.
func (s *SessionManager) GetUser(r *http.Request) (int64, error) {
	c, err := r.Cookie(SessionCookie)
	if err != nil {
		return 0, fmt.Errorf("session: no cookie: %w", err)
	}
	raw, err := s.verify(c.Value)
	if err != nil {
		return 0, err
	}
	return strconv.ParseInt(raw, 10, 64)
}

// Logout clears the session cookie.
func (s *SessionManager) Logout(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})
}

// SetTemp stores a short-lived value under a derived cookie name. Used for
// OAuth state between /auth/google and the callback.
func (s *SessionManager) SetTemp(w http.ResponseWriter, key, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     tempCookiePrefix + key,
		Value:    s.sign(value),
		Path:     "/",
		MaxAge:   tempMaxAge,
		HttpOnly: true,
		Secure:   s.secure,
		SameSite: http.SameSiteLaxMode,
	})
}

// GetTemp reads a previously-stored temp value.
func (s *SessionManager) GetTemp(r *http.Request, key string) (string, error) {
	c, err := r.Cookie(tempCookiePrefix + key)
	if err != nil {
		return "", fmt.Errorf("session: no temp cookie %s: %w", key, err)
	}
	return s.verify(c.Value)
}

// ClearTemp removes a previously-stored temp value.
func (s *SessionManager) ClearTemp(w http.ResponseWriter, key string) {
	http.SetCookie(w, &http.Cookie{
		Name:     tempCookiePrefix + key,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})
}

// UserIDFromContext returns the user_id injected by the RequireUser middleware.
func UserIDFromContext(ctx context.Context) (int64, bool) {
	v, ok := ctx.Value(userIDKey).(int64)
	return v, ok
}

// RandomString returns N url-safe random characters. Used for OAuth state.
func RandomString(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (s *SessionManager) sign(value string) string {
	h := hmac.New(sha256.New, s.secret)
	h.Write([]byte(value))
	sig := hex.EncodeToString(h.Sum(nil))
	// RawURLEncoding (no "=" padding) so the cookie value contains only
	// [A-Za-z0-9_-]. Padded base64's "=" survives a direct request but gets
	// URL-encoded to %3D when the value round-trips through Next.js
	// cookies().toString() during SSR, breaking the decode on the backend.
	return base64.RawURLEncoding.EncodeToString([]byte(value)) + "." + sig
}

func (s *SessionManager) verify(cookieValue string) (string, error) {
	parts := strings.Split(cookieValue, ".")
	if len(parts) != 2 {
		return "", errors.New("session: bad cookie format")
	}
	valBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", fmt.Errorf("session: base64 decode: %w", err)
	}
	h := hmac.New(sha256.New, s.secret)
	h.Write(valBytes)
	expectSig := hex.EncodeToString(h.Sum(nil))
	if !hmac.Equal([]byte(parts[1]), []byte(expectSig)) {
		return "", errors.New("session: bad signature")
	}
	return string(valBytes), nil
}

// userIDContext is used by RequireUser middleware (in middleware.go) to inject
// the authenticated user_id into request context.
func userIDContext(ctx context.Context, userID int64) context.Context {
	return context.WithValue(ctx, userIDKey, userID)
}

// WithUserID is exported for tests that need to inject a user_id directly
// (bypassing the cookie + middleware flow). Production code should use
// RequireUser middleware.
func WithUserID(ctx context.Context, userID int64) context.Context {
	return userIDContext(ctx, userID)
}
