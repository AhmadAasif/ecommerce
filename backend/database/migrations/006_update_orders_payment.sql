ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_order_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_orders_payment_order_id ON orders(payment_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);