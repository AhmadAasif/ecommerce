INSERT INTO categories (name,description)
VALUES
('Men','Men clothing'),('Women','Women clothing'),('New Arrivals','Latest products'),('Sale','Discounted products')
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (name,description,price,discount,category_id,brand,status)
SELECT v.name,v.description,v.price,v.discount,c.id,'Client Brand','active'
FROM (VALUES
('Classic Denim Jacket','Classic denim jacket',2999,10,'Men'),
('Oversized Cotton T-Shirt','Comfortable cotton t-shirt',1499,0,'Men'),
('Slim Fit Jeans','Slim fit denim jeans',2499,15,'Men'),
('Relaxed Hoodie','Relaxed everyday hoodie',2299,10,'Men'),
('Oversized Denim Shirt','Oversized denim shirt',2199,5,'Women'),
('Premium Ribbed Top','Premium ribbed top',1299,0,'Women'),
('Wide Leg Trousers','Wide leg trousers',2799,10,'Women'),
('Classic Casual Dress','Classic casual dress',2499,15,'Women')
) AS v(name,description,price,discount,category)
JOIN categories c ON c.name=v.category
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.name=v.name);

INSERT INTO inventory (product_id,quantity)
SELECT id,25 FROM products WHERE name='Classic Denim Jacket'
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO inventory (product_id,quantity)
SELECT id,40 FROM products WHERE name='Oversized Cotton T-Shirt'
ON CONFLICT (product_id) DO NOTHING;

-- Classy test catalogue: 10 additional products with variants and images.
-- Safe to run again: product names and SKUs are unique.

INSERT INTO products (name, description, price, discount, category_id, brand, status)
SELECT v.name, v.description, v.price, v.discount, c.id, 'Client Brand', 'active'
FROM (VALUES
  ('Tailored Oxford Shirt', 'A refined cotton Oxford shirt with a clean tailored silhouette.', 2299, 5, 'Men'),
  ('Linen Overshirt', 'Lightweight linen-blend overshirt designed for effortless layering.', 3199, 10, 'Men'),
  ('Pleated Formal Trousers', 'Elegant pleated trousers with a relaxed tailored fit.', 2899, 0, 'Men'),
  ('Minimalist Blazer', 'Sharp single-breasted blazer for polished everyday dressing.', 5999, 15, 'Men'),
  ('Textured Knit Polo', 'Premium textured knit polo with a structured collar.', 2599, 5, 'Men'),
  ('Satin Midi Dress', 'Fluid satin midi dress with a sophisticated evening silhouette.', 3999, 10, 'Women'),
  ('Tailored Wide-Leg Pants', 'High-waisted wide-leg trousers with a clean tailored finish.', 2999, 5, 'Women'),
  ('Silk Blend Blouse', 'Soft silk-blend blouse with a minimal, elegant drape.', 2799, 0, 'Women'),
  ('Structured Midi Skirt', 'Structured midi skirt designed for a timeless polished look.', 2499, 10, 'Women'),
  ('Classic Trench Coat', 'A timeless double-breasted trench coat for a refined layered look.', 5499, 20, 'Women')
) AS v(name, description, price, discount, category)
JOIN categories c ON c.name = v.category
WHERE NOT EXISTS (
  SELECT 1 FROM products p WHERE p.name = v.name
);

INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, status)
SELECT p.id, v.sku, v.size, v.color, v.price, v.stock, 'active'
FROM (VALUES
  ('Tailored Oxford Shirt', 'OXF-WHT-M', 'M', 'White', 2299, 15),
  ('Tailored Oxford Shirt', 'OXF-WHT-L', 'L', 'White', 2299, 12),
  ('Tailored Oxford Shirt', 'OXF-BLU-M', 'M', 'Blue', 2299, 10),

  ('Linen Overshirt', 'LIN-BEI-M', 'M', 'Beige', 3199, 10),
  ('Linen Overshirt', 'LIN-BEI-L', 'L', 'Beige', 3199, 8),
  ('Linen Overshirt', 'LIN-OLV-M', 'M', 'Olive', 3199, 7),

  ('Pleated Formal Trousers', 'PLE-BLK-32', '32', 'Black', 2899, 12),
  ('Pleated Formal Trousers', 'PLE-BLK-34', '34', 'Black', 2899, 10),
  ('Pleated Formal Trousers', 'PLE-GRY-32', '32', 'Grey', 2899, 8),

  ('Minimalist Blazer', 'BLZ-BLK-M', 'M', 'Black', 5999, 7),
  ('Minimalist Blazer', 'BLZ-BLK-L', 'L', 'Black', 5999, 6),
  ('Minimalist Blazer', 'BLZ-CHA-M', 'M', 'Charcoal', 5999, 5),

  ('Textured Knit Polo', 'KPO-NAV-M', 'M', 'Navy', 2599, 10),
  ('Textured Knit Polo', 'KPO-NAV-L', 'L', 'Navy', 2599, 8),
  ('Textured Knit Polo', 'KPO-CRM-M', 'M', 'Cream', 2599, 7),

  ('Satin Midi Dress', 'SAT-IVO-S', 'S', 'Ivory', 3999, 8),
  ('Satin Midi Dress', 'SAT-IVO-M', 'M', 'Ivory', 3999, 6),
  ('Satin Midi Dress', 'SAT-BLK-S', 'S', 'Black', 3999, 7),

  ('Tailored Wide-Leg Pants', 'WLP-BEI-S', 'S', 'Beige', 2999, 9),
  ('Tailored Wide-Leg Pants', 'WLP-BEI-M', 'M', 'Beige', 2999, 8),
  ('Tailored Wide-Leg Pants', 'WLP-BLK-S', 'S', 'Black', 2999, 7),

  ('Silk Blend Blouse', 'SIL-CRM-S', 'S', 'Cream', 2799, 10),
  ('Silk Blend Blouse', 'SIL-CRM-M', 'M', 'Cream', 2799, 8),
  ('Silk Blend Blouse', 'SIL-BLK-S', 'S', 'Black', 2799, 7),

  ('Structured Midi Skirt', 'SKT-BLK-S', 'S', 'Black', 2499, 9),
  ('Structured Midi Skirt', 'SKT-BLK-M', 'M', 'Black', 2499, 7),
  ('Structured Midi Skirt', 'SKT-OLV-S', 'S', 'Olive', 2499, 6),

  ('Classic Trench Coat', 'TRN-BEI-S', 'S', 'Beige', 5499, 5),
  ('Classic Trench Coat', 'TRN-BEI-M', 'M', 'Beige', 5499, 4),
  ('Classic Trench Coat', 'TRN-BLK-S', 'S', 'Black', 5499, 4)
) AS v(product_name, sku, size, color, price, stock)
JOIN products p ON p.name = v.product_name
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants pv WHERE pv.sku = v.sku
);

INSERT INTO product_images (product_id, image_url, is_primary)
SELECT p.id, v.image_url, TRUE
FROM (VALUES
  ('Tailored Oxford Shirt', 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=1200&q=80'),
  ('Linen Overshirt', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80'),
  ('Pleated Formal Trousers', 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=1200&q=80'),
  ('Minimalist Blazer', 'https://images.unsplash.com/photo-1598808503746-f34c53b9323e?auto=format&fit=crop&w=1200&q=80'),
  ('Textured Knit Polo', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80'),
  ('Satin Midi Dress', 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80'),
  ('Tailored Wide-Leg Pants', 'https://images.unsplash.com/photo-1506629905607-d9c297d2d4c0?auto=format&fit=crop&w=1200&q=80'),
  ('Silk Blend Blouse', 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=1200&q=80'),
  ('Structured Midi Skirt', 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1200&q=80'),
  ('Classic Trench Coat', 'https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=1200&q=80')
) AS v(product_name, image_url)
JOIN products p ON p.name = v.product_name
WHERE NOT EXISTS (
  SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
);
