const express = require("express");
const db = require("../db");
const { attemptIssue } = require("../services/issuance");

const router = express.Router();

router.get("/admin/orders", (req, res) => {
  const { status } = req.query;
  const orders = status
    ? db.prepare("SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC").all(status)
    : db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  res.json({ orders });
});

router.post("/admin/orders/:id/retry-issue", async (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "order not found" });

  if (order.status !== "out_of_stock" && order.status !== "delivery_failed" && order.status !== "delivering") {
    return res.status(409).json({ error: `order in status ${order.status} is not retryable` });
  }

  const result = await attemptIssue(req.params.id);
  res.json(result);
});

router.get("/admin/keys-for-order/:orderId", (req, res) => {
  const keys = db.prepare("SELECT * FROM keys_pool WHERE order_id = ?").all(req.params.orderId);
  res.json({ keys });
});

module.exports = router;
