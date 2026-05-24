// Package feedback handles feature-request and feedback submissions.
package feedback

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mayur-tolexo/shoplit/internal/mailer"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
)

// Mailer is the interface used to send notification emails.
type Mailer interface {
	Send(ctx context.Context, to, subject, text string) error
}

// Service stores feedback and fires notification emails.
type Service struct {
	q      *sqlcgen.Queries
	mailer Mailer
	to     string
}

// NewService constructs a Service.
func NewService(q *sqlcgen.Queries, m Mailer, to string) *Service {
	return &Service{q: q, mailer: m, to: to}
}

type feedbackRequest struct {
	Message string `json:"message"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Page    string `json:"page"`
	HP      string `json:"hp"`
}

// Handler returns an http.HandlerFunc that accepts feedback submissions.
func (s *Service) Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req feedbackRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		// Honeypot — silently drop bots.
		if req.HP != "" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		req.Message = strings.TrimSpace(req.Message)
		if req.Message == "" {
			http.Error(w, "message required", http.StatusBadRequest)
			return
		}
		const maxLen = 4000
		if len(req.Message) > maxLen {
			req.Message = req.Message[:maxLen]
		}

		toText := func(v string) pgtype.Text {
			return pgtype.Text{String: v, Valid: v != ""}
		}

		if err := s.q.InsertFeedback(r.Context(), sqlcgen.InsertFeedbackParams{
			Message: req.Message,
			Email:   toText(req.Email),
			Name:    toText(req.Name),
			Page:    toText(req.Page),
		}); err != nil {
			slog.Error("feedback: insert", "err", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Best-effort email — run in background so a Resend hiccup never fails the user.
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
			defer cancel()

			var parts []string
			parts = append(parts, "Message:\n"+req.Message)
			if req.Name != "" {
				parts = append(parts, "From: "+req.Name)
			}
			if req.Email != "" {
				parts = append(parts, "Email: "+req.Email)
			}
			if req.Page != "" {
				parts = append(parts, "Page: "+req.Page)
			}
			body := strings.Join(parts, "\n\n")

			if err := s.mailer.Send(ctx, s.to, "shoplit feature request", body); err != nil {
				if err != mailer.ErrNotConfigured {
					slog.Error("feedback: send email", "err", err)
				}
			}
		}()

		w.WriteHeader(http.StatusNoContent)
	}
}
