package analytics_test

import (
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/analytics"
)

func TestVisitorHash(t *testing.T) {
	a := analytics.VisitorHash("1.2.3.4", "salt")
	b := analytics.VisitorHash("1.2.3.4", "salt")
	if a == "" || a != b {
		t.Fatalf("hash must be deterministic and non-empty: %q %q", a, b)
	}
	if len(a) != 16 {
		t.Fatalf("want 16 hex chars, got %d", len(a))
	}
	if analytics.VisitorHash("1.2.3.4", "other") == a {
		t.Fatalf("different salt must give a different hash")
	}
	if analytics.VisitorHash("5.6.7.8", "salt") == a {
		t.Fatalf("different ip must give a different hash")
	}
	if analytics.VisitorHash("", "salt") != "" {
		t.Fatalf("empty ip must hash to empty string")
	}
}
