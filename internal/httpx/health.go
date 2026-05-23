// Package httpx holds HTTP helpers shared by both Go services.
package httpx

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"
)

type healthResponse struct {
	Status string `json:"status"`
	DB     string `json:"db"`
	Redis  string `json:"redis"`
	Env    string `json:"env"`
}

// Health returns an http.Handler that pings the DB and Redis. Returns 200
// when both respond inside the timeout, 503 otherwise. The response body
// names each dependency so an operator can see which one is degraded.
func Health(pool *pgxpool.Pool, redis *goredis.Client, env string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		resp := healthResponse{Status: "ok", Env: env}
		code := http.StatusOK

		if err := pool.Ping(ctx); err != nil {
			resp.DB = "fail: " + err.Error()
			resp.Status = "degraded"
			code = http.StatusServiceUnavailable
		} else {
			resp.DB = "ok"
		}

		if err := redis.Ping(ctx).Err(); err != nil {
			resp.Redis = "fail: " + err.Error()
			resp.Status = "degraded"
			code = http.StatusServiceUnavailable
		} else {
			resp.Redis = "ok"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		_ = json.NewEncoder(w).Encode(resp)
	})
}
