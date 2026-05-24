package ogfetch_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/mayur-tolexo/shoplit/internal/ogfetch"
	rediscli "github.com/mayur-tolexo/shoplit/internal/redis"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFetch_ParsesOGTags(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<html><head>
<meta property="og:title" content="Product Title">
<meta property="og:image" content="https://example.com/a.jpg">
<meta property="product:price:amount" content="999">
</head></html>`))
	}))
	defer srv.Close()

	mr := miniredis.RunT(t)
	rc, err := rediscli.Open(context.Background(), "redis://"+mr.Addr()+"/0")
	require.NoError(t, err)
	f := ogfetch.New(rc)

	res, err := f.Fetch(context.Background(), srv.URL)
	require.NoError(t, err)
	assert.True(t, res.OK)
	assert.Equal(t, "Product Title", res.Title)
	assert.Equal(t, "https://example.com/a.jpg", res.ImageURL)
	assert.Contains(t, res.PriceText, "999")
}

func TestFetch_404IsNotOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusNotFound)
	}))
	defer srv.Close()
	mr := miniredis.RunT(t)
	rc, _ := rediscli.Open(context.Background(), "redis://"+mr.Addr()+"/0")
	res, err := ogfetch.New(rc).Fetch(context.Background(), srv.URL)
	require.NoError(t, err)
	assert.False(t, res.OK)
}

func TestRetailerFromURL(t *testing.T) {
	assert.Equal(t, "nykaa.com", ogfetch.RetailerFromURL("https://www.nykaa.com/x"))
	assert.Equal(t, "amazon.in", ogfetch.RetailerFromURL("https://www.amazon.in/dp/abc"))
	assert.Equal(t, "myntra.com", ogfetch.RetailerFromURL("https://www.myntra.com/x"))
	assert.Equal(t, "flipkart.com", ogfetch.RetailerFromURL("https://www.flipkart.com/x"))
	assert.Equal(t, "ajio.com", ogfetch.RetailerFromURL("https://www.ajio.com/x"))
	assert.Equal(t, "other", ogfetch.RetailerFromURL("https://other.com/x"))
	// Amazon short links classify correctly even if the fetch fails before
	// the redirect is followed.
	assert.Equal(t, "amazon.in", ogfetch.RetailerFromURL("https://amzn.in/d/04rgYT8z"))
	assert.Equal(t, "amazon.com", ogfetch.RetailerFromURL("https://amzn.to/abc"))
	assert.Equal(t, "amazon.com", ogfetch.RetailerFromURL("https://a.co/d/abc"))
}

func TestFetch_CacheHitSkipsSecondNetwork(t *testing.T) {
	callCount := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<html><head><meta property="og:title" content="Cached"><meta property="og:image" content="x"></head></html>`))
	}))
	defer srv.Close()

	mr := miniredis.RunT(t)
	rc, _ := rediscli.Open(context.Background(), "redis://"+mr.Addr()+"/0")
	f := ogfetch.New(rc)

	_, _ = f.Fetch(context.Background(), srv.URL)
	_, _ = f.Fetch(context.Background(), srv.URL)
	assert.Equal(t, 1, callCount, "second fetch should hit cache, not network")
}
