package uploads

import (
	"context"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

// Limiter decides whether a user may upload again right now.
type Limiter interface {
	Allow(ctx context.Context, userID int64) (bool, error)
}

// RedisLimiter is a fixed-window per-user counter: at most `max` uploads per
// `window`. Survives API restarts (unlike an in-memory map) and is shared if
// the API ever runs more than one instance.
type RedisLimiter struct {
	rc     *goredis.Client
	max    int
	window time.Duration
}

func NewRedisLimiter(rc *goredis.Client, max int, window time.Duration) *RedisLimiter {
	return &RedisLimiter{rc: rc, max: max, window: window}
}

func (l *RedisLimiter) Allow(ctx context.Context, userID int64) (bool, error) {
	key := fmt.Sprintf("upload_rate:%d", userID)
	n, err := l.rc.Incr(ctx, key).Result()
	if err != nil {
		// Fail open: a Redis hiccup shouldn't block creators from uploading.
		return true, err
	}
	if n == 1 {
		// First hit in this window — start the TTL.
		_ = l.rc.Expire(ctx, key, l.window).Err()
	}
	return n <= int64(l.max), nil
}
