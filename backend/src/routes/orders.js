const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { getProduct, getStock } = require("../services/catalog");
const { applyPendingEventsForOrder } = require("../services/webhookProcessor");
const { broadcast } = require("../services/realtime");
const { reservedUntilFrom } = require("../lib/reservation");

const router = express.Router();

function now() {
  return new Date().toISOString();
}

class OrderCreateError extends Error {
  constructor(status, body) {
    super("order_create_error");
    this.status = status;
    this.body = body;
  }
}

const createOrderWithReservation = db.immediateTransaction((id, sku, product) => {
  if (db.prepare("SELECT 1 FROM orders WHERE id = ?").get(id)) {
    throw new OrderCreateError(409, { error: "order with this id already exists" });
  }

  const reserve = db
    .prepare(
      `UPDATE keys_pool SET status = 'reserved', order_id = ?
       WHERE code = (SELECT code FROM keys_pool WHERE sku = ? AND status = 'available' LIMIT 1)`
    )
    .run(id, sku);

  if (reserve.changes !== 1) {
    throw new OrderCreateError(409, { error: "out_of_stock", message: "Товар только что раскупили" });
  }

  const ts = now();
  db.prepare(
    `INSERT INTO orders (id, sku, status, amount, currency, promo_code, discount_amount, issued_code, reserved_until, created_at, updated_at)
     VALUES (?, ?, 'created', ?, ?, NULL, 0, NULL, ?, ?, ?)`
  ).run(id, sku, product.price, product.currency, reservedUntilFrom(Date.now()), ts, ts);

  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
});

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

  let order;
  try {
    order = createOrderWithReservation(id, sku, product);
  } catch (err) {
    if (err instanceof OrderCreateError) return res.status(err.status).json(err.body);
    throw err;
  }

  broadcast("stock_changed", { sku, stock: getStock(sku) });

  applyPendingEventsForOrder(id);

  const finalOrder = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  res.status(201).json({ order: finalOrder, product, reserved_until: order.reserved_until });
});

router.post("/orders/:id/accept-price", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "order not found" });
  if (order.status !== "created") {
    return res.status(409).json({ error: `price can only be accepted while order is created, not ${order.status}` });
  }

  const product = getProduct(order.sku);
  if (!product) return res.status(404).json({ error: "unknown sku" });

  const expected = Math.max(product.price - order.discount_amount, 0);
  db.prepare("UPDATE orders SET amount = ?, updated_at = ? WHERE id = ?").run(expected, now(), order.id);

  res.json({ order: db.prepare("SELECT * FROM orders WHERE id = ?").get(order.id) });
});

router.get("/orders/:id", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "order not found" });
  res.json({ order, product: getProduct(order.sku) });
});

module.exports = router;
