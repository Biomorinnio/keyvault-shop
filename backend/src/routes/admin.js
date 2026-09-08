const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { attemptIssue } = require("../services/issuance");
const { getStock } = require("../services/catalog");

const router = express.Router();

function now() {
  return new Date().toISOString();
}

function parseCount(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10000) return null;
  return n;
}

router.get("/admin/orders", (req, res) => {
  const { status } = req.query;
  const orders = status
    ? db.prepare("SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC").all(status)
    : db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  res.json({ orders });
});

router.post("/admin/orders/:id/retry-issue", async (req, res) => {
  try {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
    if (!order) return res.status(404).json({ error: "order not found" });

    if (order.status !== "out_of_stock" && order.status !== "delivery_failed" && order.status !== "delivering") {
      return res.status(409).json({ error: `order in status ${order.status} is not retryable` });
    }

    const result = await attemptIssue(req.params.id);
    res.json(result);
  } catch (err) {
    console.error(`retry-issue failed for order ${req.params.id}:`, err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/admin/keys-for-order/:orderId", (req, res) => {
  const keys = db.prepare("SELECT * FROM keys_pool WHERE order_id = ?").all(req.params.orderId);
  res.json({ keys });
});

router.patch("/admin/products/:sku", (req, res) => {
  const { sku } = req.params;
  const { price } = req.body || {};
  if (!Number.isInteger(price) || price < 0) {
    return res.status(400).json({ error: "price must be a non-negative integer" });
  }

  const info = db.prepare("UPDATE products SET price = ?, updated_at = ? WHERE sku = ?").run(price, now(), sku);
  if (info.changes === 0) return res.status(404).json({ error: "unknown sku" });

  const product = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku);
  res.json({ product: { ...product, stock: getStock(sku) } });
});

router.post("/admin/products/:sku/keys", (req, res) => {
  const { sku } = req.params;
  const count = parseCount(req.body && req.body.count);
  if (count === null) return res.status(400).json({ error: "count must be an integer between 1 and 10000" });
  if (!db.prepare("SELECT 1 FROM products WHERE sku = ?").get(sku)) {
    return res.status(404).json({ error: "unknown sku" });
  }

  const insert = db.prepare("INSERT INTO keys_pool (code, sku, status, order_id) VALUES (?, ?, 'available', NULL)");
  db.immediateTransaction(() => {
    for (let i = 0; i < count; i++) {
      insert.run(`${sku}-ADM-${crypto.randomBytes(5).toString("hex").toUpperCase()}`, sku);
    }
  })();

  res.json({ sku, added: count, stock: getStock(sku) });
});

router.delete("/admin/products/:sku/keys", (req, res) => {
  const { sku } = req.params;
  const count = parseCount(req.body && req.body.count);
  if (count === null) return res.status(400).json({ error: "count must be an integer between 1 and 10000" });
  if (!db.prepare("SELECT 1 FROM products WHERE sku = ?").get(sku)) {
    return res.status(404).json({ error: "unknown sku" });
  }

  const info = db
    .prepare(
      `DELETE FROM keys_pool
       WHERE code IN (SELECT code FROM keys_pool WHERE sku = ? AND status = 'available' LIMIT ?)`
    )
    .run(sku, count);

  res.json({ sku, removed: info.changes, stock: getStock(sku) });
});

module.exports = router;
