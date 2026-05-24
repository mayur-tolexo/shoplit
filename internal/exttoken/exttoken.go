// Package exttoken issues and resolves the long-lived Bearer tokens the
// browser extension uses to call the shoplit API. Only the SHA-256 hash of a
// token is stored; the raw token is returned once at mint time.
package exttoken

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/mayur-tolexo/shoplit/internal/auth"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
)

// Generate returns a new random token and its SHA-256 hex hash.
func Generate() (raw, hash string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", "", fmt.Errorf("exttoken: rand: %w", err)
	}
	raw = base64.RawURLEncoding.EncodeToString(b)
	return raw, HashToken(raw), nil
}

// HashToken returns the SHA-256 hex hash of a raw token.
func HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// Resolver returns an auth.BearerResolver backed by the extension_tokens table.
func Resolver(q *sqlcgen.Queries) auth.BearerResolver {
	return func(ctx context.Context, token string) (int64, error) {
		row, err := q.GetExtensionTokenByHash(ctx, HashToken(token))
		if err != nil {
			return 0, err
		}
		if row.RevokedAt.Valid {
			return 0, fmt.Errorf("exttoken: revoked")
		}
		_ = q.TouchExtensionToken(ctx, row.ID) // best-effort
		return row.UserID, nil
	}
}

// MintHandler issues a new token for the authenticated user (session cookie).
// Returns {"token":"..."} exactly once.
func MintHandler(q *sqlcgen.Queries) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		raw, hash, err := Generate()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if err := q.CreateExtensionToken(r.Context(), sqlcgen.CreateExtensionTokenParams{
			UserID:    uid,
			TokenHash: hash,
		}); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"token": raw})
	}
}

// BearerToken extracts the token from an "Authorization: Bearer <t>" header.
func BearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	const p = "Bearer "
	if strings.HasPrefix(h, p) {
		return strings.TrimSpace(h[len(p):])
	}
	return ""
}
