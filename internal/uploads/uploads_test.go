package uploads_test

import (
	"bytes"
	"encoding/json"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/uploads"
)

func multipartBody(t *testing.T, field, filename string, data []byte) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, err := w.CreateFormFile(field, filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := fw.Write(data); err != nil {
		t.Fatal(err)
	}
	w.Close()
	return &buf, w.FormDataContentType()
}

func pngBytes(t *testing.T) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 4, 4))); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestUpload_StoresImageAndReturnsURL(t *testing.T) {
	dir := t.TempDir()
	body, ct := multipartBody(t, "file", "photo.png", pngBytes(t))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads", body)
	req.Header.Set("Content-Type", ct)
	rr := httptest.NewRecorder()

	uploads.Handler(uploads.NewDiskStore(dir)).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", rr.Code, rr.Body.String())
	}
	var resp struct{ URL string }
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(resp.URL, "/uploads/") || !strings.HasSuffix(resp.URL, ".png") {
		t.Fatalf("unexpected url %q", resp.URL)
	}
	// The file actually exists on disk.
	name := strings.TrimPrefix(resp.URL, "/uploads/")
	if _, err := os.Stat(dir + "/" + name); err != nil {
		t.Fatalf("file not written: %v", err)
	}
}

func TestUpload_RejectsNonImage(t *testing.T) {
	dir := t.TempDir()
	body, ct := multipartBody(t, "file", "evil.html", []byte("<html><script>alert(1)</script></html>"))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads", body)
	req.Header.Set("Content-Type", ct)
	rr := httptest.NewRecorder()

	uploads.Handler(uploads.NewDiskStore(dir)).ServeHTTP(rr, req)

	if rr.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("want 415 for non-image, got %d", rr.Code)
	}
}

func TestUpload_MissingFile(t *testing.T) {
	dir := t.TempDir()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	w.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	rr := httptest.NewRecorder()

	uploads.Handler(uploads.NewDiskStore(dir)).ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for missing file, got %d", rr.Code)
	}
}
