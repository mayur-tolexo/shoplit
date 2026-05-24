-- 0004_extension_tokens.up.sql
-- Long-lived Bearer tokens for the browser extension. We store only the
-- SHA-256 hash of the token; the raw token is shown once at mint time.
CREATE TABLE extension_tokens (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX extension_tokens_user_idx ON extension_tokens(user_id);
