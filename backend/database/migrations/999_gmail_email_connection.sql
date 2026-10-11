CREATE TABLE IF NOT EXISTS store_email_connection (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  email TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expiry TIMESTAMPTZ,
  connected_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
