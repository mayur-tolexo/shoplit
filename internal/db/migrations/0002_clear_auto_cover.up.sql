-- Early carts were seeded with a random picsum.photos cover, which rendered
-- as an unrelated stock photo (e.g. a beach) on the cart page. We've stopped
-- auto-seeding covers; an empty cover now renders as a branded accent
-- gradient. Clear those auto-generated covers so existing carts pick up the
-- new look. Real creator-chosen covers (any non-picsum URL) are untouched.
UPDATE carts
SET cover_image_url = NULL
WHERE cover_image_url LIKE '%picsum.photos%';
