CREATE TABLE IF NOT EXISTS products (
  sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  price INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  image TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_type ON products (type);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  promo_code TEXT,
  discount_amount INTEGER DEFAULT 0,
  issued_code TEXT,
  reserved_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS keys_pool (
  code TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  order_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_keys_pool_sku_status ON keys_pool (sku, status);

CREATE TABLE IF NOT EXISTS issuance_requests (
  request_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  supplier TEXT NOT NULL,
  code TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promocodes (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  value INTEGER NOT NULL,
  max_uses INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS promo_usages (
  order_id TEXT NOT NULL,
  promo_code TEXT NOT NULL,
  PRIMARY KEY (order_id, promo_code)
);
