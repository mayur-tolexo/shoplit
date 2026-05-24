// Package ogfetch: server-side OG meta-tag fetcher. Returns a typed Result
// with title, image, price text, and the inferred retailer. Caches successful
// results in Redis for 24h.
package ogfetch

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	rediscli "github.com/mayur-tolexo/shoplit/internal/redis"
)

const (
	// A real Chrome UA. Retailer bot-protection (Akamai etc.) rejects
	// obviously-non-browser clients, so we present as Chrome on macOS.
	userAgent    = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
	cacheTTL     = 24 * time.Hour
	fetchTimeout = 8 * time.Second
)

type Result struct {
	OK        bool   `json:"ok"`
	Title     string `json:"title,omitempty"`
	ImageURL  string `json:"image_url,omitempty"`
	PriceText string `json:"price_text,omitempty"`
	Retailer  string `json:"retailer"`
	Reason    string `json:"reason,omitempty"`
}

type Fetcher struct {
	rc     *rediscli.Client
	client *http.Client
}

func New(rc *rediscli.Client) *Fetcher {
	// Force HTTP/1.1. Several retailer CDNs (Myntra/Akamai) abruptly reset
	// HTTP/2 streams for clients they flag as bots ("stream error ...
	// INTERNAL_ERROR; received from peer"). HTTP/1.1 sidesteps that class of
	// failure. TLSNextProto set to an empty (non-nil) map disables h2.
	tr := &http.Transport{
		ForceAttemptHTTP2: false,
		TLSNextProto:      map[string]func(string, *tls.Conn) http.RoundTripper{},
		MaxIdleConns:      10,
		IdleConnTimeout:   30 * time.Second,
	}
	return &Fetcher{
		rc:     rc,
		client: &http.Client{Timeout: fetchTimeout, Transport: tr},
	}
}

// Fetch GETs the URL and parses OG meta tags. Caches successful results in
// Redis. 404/timeouts are returned as OK=false (not errors); the caller's
// UI should prompt manual entry.
func (f *Fetcher) Fetch(ctx context.Context, rawURL string) (Result, error) {
	if cached, hit := f.cacheLookup(ctx, rawURL); hit {
		return cached, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return notOK(rawURL, "invalid URL"), nil
	}
	// Mimic a real browser request as closely as practical — bot-protection
	// looks at these headers.
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	// Deliberately NOT setting Accept-Encoding — letting Go's transport add it
	// and transparently decompress the response (goquery needs plain HTML).
	req.Header.Set("Sec-Fetch-Dest", "document")
	req.Header.Set("Sec-Fetch-Mode", "navigate")
	req.Header.Set("Sec-Fetch-Site", "none")
	req.Header.Set("Upgrade-Insecure-Requests", "1")

	resp, err := f.client.Do(req)
	if err != nil {
		return notOK(rawURL, fmt.Sprintf("fetch: %s", err)), nil
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return notOK(rawURL, fmt.Sprintf("server %d", resp.StatusCode)), nil
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return notOK(rawURL, "parse"), nil
	}
	out := Result{
		OK:       true,
		Title:    pickMeta(doc, "og:title", "twitter:title"),
		ImageURL: pickMeta(doc, "og:image", "twitter:image"),
		Retailer: RetailerFromURL(rawURL),
	}
	if out.Title == "" {
		out.Title = strings.TrimSpace(doc.Find("title").First().Text())
	}
	if price := pickMeta(doc, "product:price:amount", "og:price:amount"); price != "" {
		out.PriceText = "₹" + price
	}
	if out.Title == "" && out.ImageURL == "" {
		out = notOK(rawURL, "no metadata")
	}
	_ = f.cacheStore(ctx, rawURL, out)
	return out, nil
}

func notOK(rawURL, reason string) Result {
	return Result{OK: false, Retailer: RetailerFromURL(rawURL), Reason: reason}
}

func pickMeta(doc *goquery.Document, props ...string) string {
	for _, p := range props {
		var val string
		doc.Find(fmt.Sprintf(`meta[property=%q]`, p)).Each(func(_ int, s *goquery.Selection) {
			if val == "" {
				val, _ = s.Attr("content")
			}
		})
		if val == "" {
			doc.Find(fmt.Sprintf(`meta[name=%q]`, p)).Each(func(_ int, s *goquery.Selection) {
				if val == "" {
					val, _ = s.Attr("content")
				}
			})
		}
		if val != "" {
			return strings.TrimSpace(val)
		}
	}
	return ""
}

// RetailerFromURL infers the retailer from the hostname. "other" if unknown.
func RetailerFromURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return "other"
	}
	host := strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.")
	switch {
	case strings.HasSuffix(host, "nykaa.com"):
		return "nykaa.com"
	case strings.HasSuffix(host, "amazon.in"):
		return "amazon.in"
	case strings.HasSuffix(host, "amazon.com"):
		return "amazon.com"
	case strings.HasSuffix(host, "myntra.com"):
		return "myntra.com"
	case strings.HasSuffix(host, "flipkart.com"):
		return "flipkart.com"
	case strings.HasSuffix(host, "ajio.com"):
		return "ajio.com"
	default:
		return "other"
	}
}

func (f *Fetcher) cacheKey(rawURL string) string {
	h := sha256.Sum256([]byte(rawURL))
	return "og:" + hex.EncodeToString(h[:])
}

func (f *Fetcher) cacheLookup(ctx context.Context, rawURL string) (Result, bool) {
	raw, err := f.rc.Get(ctx, f.cacheKey(rawURL)).Result()
	if err != nil {
		return Result{}, false
	}
	var out Result
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return Result{}, false
	}
	return out, true
}

func (f *Fetcher) cacheStore(ctx context.Context, rawURL string, r Result) error {
	if !r.OK {
		return nil
	}
	b, _ := json.Marshal(r)
	return f.rc.Set(ctx, f.cacheKey(rawURL), b, cacheTTL).Err()
}
