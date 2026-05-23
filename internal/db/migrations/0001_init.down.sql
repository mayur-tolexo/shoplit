-- internal/db/migrations/0001_init.down.sql

DROP TABLE IF EXISTS otp_attempts;
DROP TABLE IF EXISTS cart_views_daily;
DROP TABLE IF EXISTS click_daily;
DROP TABLE IF EXISTS click_events;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS links;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS users;
DROP EXTENSION IF EXISTS citext;
