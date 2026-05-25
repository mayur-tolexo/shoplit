// Package feedback handles feature-request and feedback submissions.
package feedback

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mayur-tolexo/shoplit/internal/auth"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/mayur-tolexo/shoplit/internal/mailer"
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
	admins map[int64]bool
}

// NewService constructs a Service.
func NewService(q *sqlcgen.Queries, m Mailer, to string, adminIDs []int64) *Service {
	admins := make(map[int64]bool, len(adminIDs))
	for _, id := range adminIDs {
		admins[id] = true
	}
	return &Service{q: q, mailer: m, to: to, admins: admins}
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

type feedbackItem struct {
	ID        string `json:"id"`
	Message   string `json:"message"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Page      string `json:"page"`
	CreatedAt string `json:"createdAt"`
}

// ListHandler returns an http.HandlerFunc for admin-only listing of feedback.
// It must be registered under the authenticated /api/v1 group.
func (s *Service) ListHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, ok := auth.UserIDFromContext(r.Context())
		if !ok || !s.admins[uid] {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}

		rows, err := s.q.ListFeedback(r.Context())
		if err != nil {
			slog.Error("feedback: list", "err", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		items := make([]feedbackItem, 0, len(rows))
		for _, row := range rows {
			items = append(items, feedbackItem{
				ID:        strconv.FormatInt(row.ID, 10),
				Message:   row.Message,
				Email:     row.Email.String,
				Name:      row.Name.String,
				Page:      row.Page.String,
				CreatedAt: row.CreatedAt.Time.Format(time.RFC3339),
			})
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(items); err != nil {
			slog.Error("feedback: encode list", "err", err)
		}
	}
}
