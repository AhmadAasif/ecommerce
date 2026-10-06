CREATE TABLE IF NOT EXISTS order_inventory_reservations (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'released', 'consumed')),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  released_at TIMESTAMP,
  consumed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_variant_status
  ON order_inventory_reservations(variant_id, status);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order
  ON order_inventory_reservations(order_id);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expiry
  ON order_inventory_reservations(status, expires_at);
