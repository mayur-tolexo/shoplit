ALTER TABLE click_events ADD COLUMN visitor_hash TEXT;
CREATE INDEX click_events_link_visitor ON click_events(link_id, occurred_at, visitor_hash);
