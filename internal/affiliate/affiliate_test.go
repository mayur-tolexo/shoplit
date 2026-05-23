// internal/affiliate/affiliate_test.go
package affiliate_test

import (
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/affiliate"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApply_NoRulePassthrough(t *testing.T) {
	got, err := affiliate.Apply("https://www.nykaa.com/x", "nykaa.com", "anyone")
	require.NoError(t, err)
	assert.Equal(t, "https://www.nykaa.com/x", got)
}

func TestApply_UnknownRetailerPassthrough(t *testing.T) {
	got, err := affiliate.Apply("https://example.com/x", "other", "")
	require.NoError(t, err)
	assert.Equal(t, "https://example.com/x", got)
}
