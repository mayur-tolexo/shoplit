CREATE TABLE follows (
  follower_id  BIGINT NOT NULL REFERENCES users(id),
  creator_id   BIGINT NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, creator_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> creator_id)
);
CREATE INDEX follows_creator_idx ON follows(creator_id);   -- follower counts / followers of X
CREATE INDEX follows_follower_idx ON follows(follower_id);  -- who I follow / feed
