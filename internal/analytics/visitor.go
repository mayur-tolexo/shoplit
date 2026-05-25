// Package analytics holds shared analytics helpers (visitor identity, etc.).
package analytics

import (
	"crypto/sha256"
	"encoding/hex"
)

// VisitorHash returns a short, salted, one-way hash of a visitor IP. The raw IP
// is never stored — only this hash, so distinct visitors can be counted
// (reach) without retaining PII. Empty ip → empty hash (not counted).
func VisitorHash(ip, salt string) string {
	if ip == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(salt + "|" + ip))
	return hex.EncodeToString(sum[:])[:16]
}
