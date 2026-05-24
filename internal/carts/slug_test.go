package carts_test

import (
	"strings"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/carts"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewSlug_DefaultLengthAndAlphabet(t *testing.T) {
	const alphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz"
	for i := 0; i < 100; i++ {
		s, err := carts.NewSlug()
		require.NoError(t, err)
		assert.Len(t, s, 8)
		for _, r := range s {
			assert.True(t, strings.ContainsRune(alphabet, r),
				"slug %q has out-of-alphabet rune %q", s, r)
		}
	}
}

func TestNewSlug_UniquePerCall(t *testing.T) {
	seen := make(map[string]bool, 200)
	for i := 0; i < 200; i++ {
		s, err := carts.NewSlug()
		require.NoError(t, err)
		assert.False(t, seen[s], "duplicate slug: %q", s)
		seen[s] = true
	}
}
