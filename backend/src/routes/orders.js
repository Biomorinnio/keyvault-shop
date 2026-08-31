const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { getProduct } = require("../data/catalog");
const { applyPendingEventsForOrder } = require("../services/webhookProcessor");

const router = express.Router();

function now() {
  return new Date().toISOString();
}

router.post("/orders", (req, res) => {
  const { sku, id: clientId } = req.body || {};
  if (!sku || typeof sku !== "string") {
    return res.status(400).json({ error: "sku is required" });
  }

  const product = getProduct(sku);
  if (!product) {
    return res.status(404).json({ error: "unknown sku" });
  }

  const id = clientId || `ord_${crypto.randomBytes(6).toString("hex")}`;

  if (db.prepare("SELECT 1 FROM orders WHERE id = ?").get(id)) {
    return res.status(409).json({ error: "order with this id already exists" });
  }

  const ts = now();

  db.prepare(
    `INSERT INTO orders (id, sku, status, amount, currency, promo_code, discount_amount, issued_code, created_at, updated_at)
     VALUES (?, ?, 'created', ?, ?, NULL, 0, NULL, ?, ?)`
  ).run(id, sku, product.price, product.currency, ts, ts);

  applyPendingEventsForOrder(id);

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  res.status(201).json({ order, product });
});

router.get("/orders/:id", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "order not found" });
  res.json({ order });
});

module.exports = router;
