// Package uploads handles creator image uploads (product/cover photos) — most
// importantly for mobile, where there's no easy way to paste an image URL.
// Files are written to a configured directory and served back under /uploads.
package uploads

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
)

const (
	maxUploadBytes = 15 << 20 // 15 MiB — generous for a full-res phone photo.
	sniffLen       = 512      // bytes http.DetectContentType needs.
)

// extByType maps the sniffed content type to a safe, server-chosen extension.
// Only these image types are accepted; anything else is rejected. The user
// never controls the stored filename or extension.
var extByType = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

// Handler returns an http.HandlerFunc that accepts a multipart "file" field,
// validates it is an allowed image, hands it to the Store with a random name,
// and responds {"url":"<public url>"}. Mount it behind auth.
func Handler(store Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Cap the whole request body before reading anything.
		r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes+1024)
		if err := r.ParseMultipartForm(maxUploadBytes + 1024); err != nil {
			http.Error(w, "file too large or malformed (max 15MB)", http.StatusRequestEntityTooLarge)
			return
		}
		file, _, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "missing file field", http.StatusBadRequest)
			return
		}
		defer file.Close()

		data, err := io.ReadAll(io.LimitReader(file, maxUploadBytes+1))
		if err != nil {
			http.Error(w, "read failed", http.StatusInternalServerError)
			return
		}
		if len(data) > maxUploadBytes {
			http.Error(w, "image too large (max 15MB)", http.StatusRequestEntityTooLarge)
			return
		}

		// Sniff the real content type from the bytes, not the client's claim.
		sniff := data
		if len(sniff) > sniffLen {
			sniff = sniff[:sniffLen]
		}
		contentType := http.DetectContentType(sniff)
		ext, ok := extByType[contentType]
		if !ok {
			http.Error(w, "only JPEG, PNG, WebP or GIF images are allowed", http.StatusUnsupportedMediaType)
			return
		}

		name, err := randomName()
		if err != nil {
			http.Error(w, "could not generate name", http.StatusInternalServerError)
			return
		}
		name += ext

		url, err := store.Put(r.Context(), name, contentType, data)
		if err != nil {
			http.Error(w, "could not store image", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"url": url})
	}
}

func randomName() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// FileServer serves uploaded images from dir for public GETs, but never lists
// directory contents (so the upload directory can't be enumerated) and sends
// X-Content-Type-Options: nosniff so a file is never interpreted as anything
// other than its declared type.
func FileServer(dir string) http.Handler {
	fs := http.FileServer(noListFS{http.Dir(dir)})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		fs.ServeHTTP(w, r)
	})
}

// noListFS wraps an http.FileSystem and reports directories as "not found",
// which makes http.FileServer 404 instead of rendering a directory listing.
type noListFS struct{ fs http.FileSystem }

func (n noListFS) Open(name string) (http.File, error) {
	f, err := n.fs.Open(name)
	if err != nil {
		return nil, err
	}
	info, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	if info.IsDir() {
		f.Close()
		return nil, os.ErrNotExist
	}
	return f, nil
}
