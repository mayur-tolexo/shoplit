// Package mailer sends transactional email via the Resend HTTP API.
package mailer

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// ErrNotConfigured is returned when no API key is set (email is a no-op).
var ErrNotConfigured = errors.New("mailer: not configured")

type Resend struct {
	key, from string
	client    *http.Client
}

func NewResend(key, from string) *Resend {
	return &Resend{key: key, from: from, client: &http.Client{Timeout: 10 * time.Second}}
}

// Send delivers a plain-text email. No-op error if not configured.
func (r *Resend) Send(ctx context.Context, to, subject, text string) error {
	if r.key == "" {
		return ErrNotConfigured
	}
	payload, _ := json.Marshal(map[string]any{
		"from": r.from, "to": []string{to}, "subject": subject, "text": text,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("mailer: resend status %d", resp.StatusCode)
	}
	return nil
}
