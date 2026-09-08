const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { getProduct } = require("../services/catalog");

const router = express.Router();

const SELF_BASE_URL = process.env.SELF_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

router.post("/payment/mock", (req, res) => {
  const { order_id } = req.body || {};
  if (!order_id) return res.status(400).json({ error: "order_id is required" });

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(order_id);
  if (!order) return res.status(404).json({ error: "order not found" });
  if (order.status !== "created") {
    return res.status(409).json({ error: `order is not payable from status ${order.status}` });
  }

  const product = getProduct(order.sku);
  const expected = product ? Math.max(product.price - order.discount_amount, 0) : order.amount;
  if (product && order.amount !== expected) {
    return res
      .status(409)
      .json({ error: "price_changed", current_price: product.price, order_amount: order.amount });
  }

  res.status(202).json({ status: "accepted", order_id });

  const eventId = `evt_${crypto.randomBytes(8).toString("hex")}`;
  const payload = {
    event_id: eventId,
    order_id,
    status: "paid",
    amount: order.amount,
    currency: order.currency,
    created_at: new Date().toISOString(),
  };

  setTimeout(() => {
    fetch(`${SELF_BASE_URL}/webhook/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error("mock payment webhook delivery failed:", err.message);
    });
  }, 300 + Math.random() * 500);
});

module.exports = router;
