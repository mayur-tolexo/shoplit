package auth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSession_SetAndGetUser(t *testing.T) {
	sm := auth.NewSessionManager("test-secret-12345")
	rr := httptest.NewRecorder()
	sm.SetUser(rr, 42)

	cookies := rr.Result().Cookies()
	require.Len(t, cookies, 1)
	c := cookies[0]
	assert.Equal(t, "shoplit_session", c.Name)
	assert.True(t, c.HttpOnly)

	req := httptest.NewRequest("GET", "/", nil)
	req.AddCookie(c)
	uid, err := sm.GetUser(req)
	require.NoError(t, err)
	assert.Equal(t, int64(42), uid)
}

func TestSession_RejectsTampered(t *testing.T) {
	sm := auth.NewSessionManager("test-secret-12345")
	req := httptest.NewRequest("GET", "/", nil)
	req.AddCookie(&http.Cookie{Name: "shoplit_session", Value: "tampered.signature"})
	_, err := sm.GetUser(req)
	require.Error(t, err)
}

func TestSession_RejectsWrongSecret(t *testing.T) {
	sm1 := auth.NewSessionManager("secret-a")
	sm2 := auth.NewSessionManager("secret-b")
	rr := httptest.NewRecorder()
	sm1.SetUser(rr, 99)
	c := rr.Result().Cookies()[0]
	req := httptest.NewRequest("GET", "/", nil)
	req.AddCookie(c)
	_, err := sm2.GetUser(req)
	require.Error(t, err)
}

func TestSession_TempValueRoundtrip(t *testing.T) {
	sm := auth.NewSessionManager("test-secret-12345")
	rr := httptest.NewRecorder()
	sm.SetTemp(rr, "oauth_state", "abc123")
	c := rr.Result().Cookies()[0]
	assert.Equal(t, "shoplit_temp_oauth_state", c.Name)

	req := httptest.NewRequest("GET", "/", nil)
	req.AddCookie(c)
	got, err := sm.GetTemp(req, "oauth_state")
	require.NoError(t, err)
	assert.Equal(t, "abc123", got)
}

func TestSession_Logout(t *testing.T) {
	sm := auth.NewSessionManager("test-secret-12345")
	rr := httptest.NewRecorder()
	sm.Logout(rr)
	c := rr.Result().Cookies()[0]
	assert.Equal(t, "shoplit_session", c.Name)
	assert.Equal(t, "", c.Value)
	assert.Equal(t, -1, c.MaxAge)
}

func TestSession_RandomString(t *testing.T) {
	s, err := auth.RandomString(16)
	require.NoError(t, err)
	assert.NotEmpty(t, s)
}
