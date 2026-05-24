-- Back-fill: products added before the OG fetcher learned to strip retailer
-- marketing noise still carry verbose titles like
-- "Buy X -  - Apparel for Men". Apply the same cleanup cleanTitle() now does
-- at fetch time, so existing carts read cleanly. Mirrors the Go logic: drop
-- the "Buy " prefix, cut at the first marketing separator, collapse
-- whitespace, and trim a trailing dash.
UPDATE cart_items
SET title = btrim(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(title, '^\s*Buy\s+', ''),
        '( \| | : | - - | - Buy | - Apparel for | Online at Best Price).*$', ''
      ),
      '\s+', ' ', 'g'
    ),
    '\s*-\s*$', ''
  )
)
WHERE title LIKE 'Buy %'
   OR title LIKE '% | %'
   OR title LIKE '% : %'
   OR title LIKE '% - - %'
   OR title LIKE '% - Buy %'
   OR title LIKE '% - Apparel for %'
   OR title LIKE '% Online at Best Price%';
