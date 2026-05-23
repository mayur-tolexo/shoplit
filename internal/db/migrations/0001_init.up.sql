-- internal/db/migrations/0001_init.up.sql

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  email           CITEXT UNIQUE,
  phone           TEXT UNIQUE,
  google_sub      TEXT UNIQUE,
  display_name    TEXT NOT NULL,
  avatar_url      TEXT,
  handle          CITEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  banned_at       TIMESTAMPTZ
);

CREATE TABLE carts (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  slug            CITEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT,
  cover_image_url TEXT,
  is_public       BOOLEAN NOT NULL DEFAULT true,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX carts_user_idx ON carts(user_id) WHERE archived_at IS NULL;

CREATE TABLE links (
  id              BIGSERIAL PRIMARY KEY,
  slug            CITEXT NOT NULL UNIQUE,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  original_url    TEXT NOT NULL,
  retailer        TEXT NOT NULL,
  link_type       TEXT NOT NULL,
  cart_id         BIGINT REFERENCES carts(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at     TIMESTAMPTZ,
  CONSTRAINT cart_required_for_in_cart CHECK (
    (link_type = 'single' AND cart_id IS NULL) OR
    (link_type = 'in_cart' AND cart_id IS NOT NULL)
  )
);
CREATE INDEX links_user_idx ON links(user_id);
CREATE INDEX links_cart_idx ON links(cart_id);

CREATE TABLE cart_items (
  id              BIGSERIAL PRIMARY KEY,
  cart_id         BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  position        INT NOT NULL,
  link_id         BIGINT NOT NULL REFERENCES links(id),
  title           TEXT NOT NULL,
  description     TEXT,
  image_url       TEXT,
  price_text      TEXT,
  retailer        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cart_id, position)
);
CREATE INDEX cart_items_cart_idx ON cart_items(cart_id);

CREATE TABLE click_events (
  id              BIGSERIAL PRIMARY KEY,
  link_id         BIGINT NOT NULL REFERENCES links(id),
  occurred_at     TIMESTAMPTZ NOT NULL,
  country_code    TEXT,
  user_agent_kind TEXT,
  referer_host    TEXT
);
CREATE INDEX click_events_link_time ON click_events(link_id, occurred_at);

CREATE TABLE click_daily (
  link_id         BIGINT NOT NULL REFERENCES links(id),
  day             DATE NOT NULL,
  clicks          INT NOT NULL,
  PRIMARY KEY (link_id, day)
);

CREATE TABLE cart_views_daily (
  cart_id         BIGINT NOT NULL REFERENCES carts(id),
  day             DATE NOT NULL,
  views           INT NOT NULL,
  PRIMARY KEY (cart_id, day)
);

CREATE TABLE otp_attempts (
  id              BIGSERIAL PRIMARY KEY,
  phone           TEXT NOT NULL,
  ip              INET NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at     TIMESTAMPTZ
);
CREATE INDEX otp_attempts_phone_time ON otp_attempts(phone, sent_at DESC);
