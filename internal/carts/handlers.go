package carts

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/ogfetch"
)

// RegisterRoutes mounts /carts/*, /me, /og-fetch under the parent router.
func RegisterRoutes(r chi.Router, svc *Service, fetcher *ogfetch.Fetcher) {
	r.Get("/me", getMe(svc))
	r.Get("/cover-images", listCoverImages(svc))
	r.Get("/carts", listCarts(svc))
	r.Post("/carts", createCart(svc))
	r.Get("/carts/{id}", getCart(svc))
	r.Patch("/carts/{id}", updateCart(svc))
	r.Post("/carts/{id}/items", addItem(svc, fetcher))
	r.Delete("/carts/{id}/items/{itemID}", removeItem(svc))
	r.Patch("/carts/{id}/items/reorder", reorderItems(svc))
	r.Get("/og-fetch", ogFetchHandler(fetcher))
}

func getMe(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := auth.UserIDFromContext(r.Context())
		u, err := svc.GetUser(r.Context(), uid)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, MarshalUser(u))
	}
}

func listCoverImages(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := auth.UserIDFromContext(r.Context())
		covers, err := svc.ListMyCoverImages(r.Context(), uid)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string][]string{"covers": covers})
	}
}

func listCarts(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := auth.UserIDFromContext(r.Context())
		list, err := svc.ListMyCarts(r.Context(), uid)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out := make([]CartJSON, 0, len(list))
		owner, _ := svc.GetUser(r.Context(), uid)
		for _, c := range list {
			items, _ := svc.ListCartItems(r.Context(), c.ID)
			out = append(out, MarshalCart(c, owner, items))
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func createCart(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := auth.UserIDFromContext(r.Context())
		var body struct {
			Title string `json:"title"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Title == "" {
			http.Error(w, "title required", http.StatusBadRequest)
			return
		}
		cart, err := svc.CreateCart(r.Context(), uid, body.Title)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		owner, _ := svc.GetUser(r.Context(), uid)
		writeJSON(w, http.StatusCreated, MarshalCart(cart, owner, nil))
	}
}

func getCart(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := auth.UserIDFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			http.Error(w, "bad id", http.StatusBadRequest)
			return
		}
		cart, items, err := svc.GetCart(r.Context(), uid, id)
		if errors.Is(err, pgx.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		if errors.Is(err, ErrForbidden) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		owner, _ := svc.GetUser(r.Context(), uid)
		writeJSON(w, http.StatusOK, MarshalCart(cart, owner, items))
	}
}

func updateCart(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := auth.UserIDFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			http.Error(w, "bad id", http.StatusBadRequest)
			return
		}
		var body struct {
			Title         *string `json:"title,omitempty"`
			Description   *string `json:"description,omitempty"`
			CoverImageURL *string `json:"cover_image_url,omitempty"`
			IsPublic      *bool   `json:"is_public,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad body", http.StatusBadRequest)
			return
		}
		cart, err := svc.UpdateCart(r.Context(), uid, id, UpdatePatch{
			Title: body.Title, Description: body.Description,
			CoverImageURL: body.CoverImageURL, IsPublic: body.IsPublic,
		})
		if errors.Is(err, ErrForbidden) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		owner, _ := svc.GetUser(r.Context(), uid)
		writeJSON(w, http.StatusOK, MarshalCart(cart, owner, nil))
	}
}

func addItem(svc *Service, fetcher *ogfetch.Fetcher) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := auth.UserIDFromContext(r.Context())
		cartID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			http.Error(w, "bad id", http.StatusBadRequest)
			return
		}
		var body struct {
			PasteURL    string `json:"paste_url,omitempty"`
			Title       string `json:"title,omitempty"`
			ImageURL    string `json:"image_url,omitempty"`
			PriceText   string `json:"price_text,omitempty"`
			OriginalURL string `json:"original_url,omitempty"`
			Retailer    string `json:"retailer,omitempty"`
			Note        string `json:"note,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad body", http.StatusBadRequest)
			return
		}

		// If paste_url provided and no explicit title, run OG fetch.
		if body.PasteURL != "" && body.Title == "" {
			og, err := fetcher.Fetch(r.Context(), body.PasteURL)
			if err == nil && og.OK {
				body.Title = og.Title
				body.ImageURL = og.ImageURL
				body.PriceText = og.PriceText
				body.OriginalURL = body.PasteURL
				body.Retailer = og.Retailer
			}
		}
		if body.OriginalURL == "" && body.PasteURL != "" {
			body.OriginalURL = body.PasteURL
		}
		if body.Retailer == "" {
			body.Retailer = ogfetch.RetailerFromURL(body.OriginalURL)
		}
		if body.Title == "" {
			http.Error(w, "title required (either via paste_url OG fetch or explicit field)", http.StatusBadRequest)
			return
		}

		item, err := svc.AddProduct(r.Context(), uid, cartID, AddProductInput{
			OriginalURL: body.OriginalURL,
			Retailer:    body.Retailer,
			Title:       body.Title,
			ImageURL:    body.ImageURL,
			PriceText:   body.PriceText,
			Note:        body.Note,
		})
		if errors.Is(err, ErrForbidden) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"id":       strconv.FormatInt(item.ID, 10),
			"title":    item.Title,
			"position": item.Position,
		})
	}
}

func removeItem(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := auth.UserIDFromContext(r.Context())
		cartID, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		itemID, _ := strconv.ParseInt(chi.URLParam(r, "itemID"), 10, 64)
		err := svc.RemoveProduct(r.Context(), uid, cartID, itemID)
		if errors.Is(err, ErrForbidden) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func reorderItems(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := auth.UserIDFromContext(r.Context())
		cartID, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		var body struct {
			ItemIDs []int64 `json:"item_ids"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad body", http.StatusBadRequest)
			return
		}
		err := svc.ReorderProducts(r.Context(), uid, cartID, body.ItemIDs)
		if errors.Is(err, ErrForbidden) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func ogFetchHandler(fetcher *ogfetch.Fetcher) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := r.URL.Query().Get("url")
		if u == "" {
			http.Error(w, "url query param required", http.StatusBadRequest)
			return
		}
		res, err := fetcher.Fetch(r.Context(), u)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, res)
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
