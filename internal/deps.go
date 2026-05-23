//go:build tools
// +build tools

// Package internal contains internal dependencies.
package internal

import (
	_ "github.com/PuerkitoBio/goquery"
	_ "github.com/matoous/go-nanoid/v2"
	_ "golang.org/x/oauth2"
	_ "golang.org/x/oauth2/google"
)
