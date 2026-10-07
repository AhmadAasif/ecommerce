ALTER TABLE products
ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

UPDATE products
SET gender = CASE
  WHEN LOWER(c.name) = 'men' THEN 'men'
  WHEN LOWER(c.name) = 'women' THEN 'women'
  ELSE NULL
END
FROM categories c
WHERE products.category_id = c.id
  AND products.gender IS NULL;

ALTER TABLE products
ADD CONSTRAINT products_gender_check
CHECK (gender IS NULL OR gender IN ('men', 'women'));

CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);
