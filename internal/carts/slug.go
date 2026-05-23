// Package carts holds cart business logic and helpers.
package carts

import (
	gonanoid "github.com/matoous/go-nanoid/v2"
)

const (
	slugAlphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz"
	slugLength   = 8
)

// NewSlug generates a random URL-safe slug using an unambiguous alphabet
// (no 0/O/1/I/L). 8 chars → ~2.2e14 possible slugs.
func NewSlug() (string, error) {
	return gonanoid.Generate(slugAlphabet, slugLength)
}
