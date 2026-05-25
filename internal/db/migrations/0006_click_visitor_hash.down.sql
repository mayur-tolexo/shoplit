DROP INDEX IF EXISTS click_events_link_visitor;
ALTER TABLE click_events DROP COLUMN IF EXISTS visitor_hash;
