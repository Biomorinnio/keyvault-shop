const express = require("express");
const db = require("../db");
const { recordWebhookEvent } = require("../lib/idempotency");
const { applyWebhookEvent } = require("../services/webhookProcessor");

const router = express.Router();

router.post("/webhook/payment", (req, res) => {
  const { event_id, order_id, status } = req.body || {};

  if (!event_id || !order_id || !status) {
    return res.status(400).json({ error: "event_id, order_id and status are required" });
  }
  if (status !== "paid" && status !== "failed") {
    return res.status(400).json({ error: "status must be 'paid' or 'failed'" });
  }

  const { inserted } = recordWebhookEvent(db, { eventId: event_id, orderId: order_id, status, rawPayload: req.body });

  if (!inserted) {
    return res.status(200).json({ status: "duplicate_ignored" });
  }

  const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(order_id);

  if (!order) {
    return res.status(200).json({ status: "accepted_pending_order" });
  }

  applyWebhookEvent({ eventId: event_id, orderId: order_id, status });
  res.status(200).json({ status: "accepted" });
});

module.exports = router;
