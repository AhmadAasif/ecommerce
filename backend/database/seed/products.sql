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