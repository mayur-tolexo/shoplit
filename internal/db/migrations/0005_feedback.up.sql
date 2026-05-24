-- Feature requests / feedback submitted from the website. Stored durably so
-- nothing is lost even if the notification email fails.
CREATE TABLE feedback (
  id         BIGSERIAL PRIMARY KEY,
  message    TEXT NOT NULL,
  email      TEXT,
  name       TEXT,
  page       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
