package config

import (
	"fmt"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	Env      string `env:"SHOPLIT_ENV" envDefault:"dev"`
	LogLevel string `env:"SHOPLIT_LOG_LEVEL" envDefault:"info"`

	DBDSN         string `env:"SHOPLIT_DB_DSN,required"`
	DBDSNReadOnly string `env:"SHOPLIT_DB_DSN_READONLY"`
	RedisURL      string `env:"SHOPLIT_REDIS_URL,required"`

	APIAddr      string `env:"SHOPLIT_API_ADDR" envDefault:":8080"`
	RedirectAddr string `env:"SHOPLIT_REDIRECT_ADDR" envDefault:":8081"`
}

func Load() (*Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}
	return &c, nil
}
