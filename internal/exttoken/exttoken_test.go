// internal/exttoken/exttoken_test.go
package exttoken

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestGenerate_TokenHashesToStoredHash(t *testing.T) {
	raw, hash, err := Generate()
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if len(raw) < 32 {
		t.Fatalf("raw token too short: %q", raw)
	}
	sum := sha256.Sum256([]byte(raw))
	if want := hex.EncodeToString(sum[:]); want != hash {
		t.Fatalf("hash mismatch: got %s want %s", hash, want)
	}
	// Two calls produce different tokens.
	raw2, _, _ := Generate()
	if raw == raw2 {
		t.Fatal("expected unique tokens")
	}
}

func TestHashToken_MatchesGenerate(t *testing.T) {
	raw, hash, _ := Generate()
	if HashToken(raw) != hash {
		t.Fatal("HashToken should equal the hash from Generate")
	}
}
