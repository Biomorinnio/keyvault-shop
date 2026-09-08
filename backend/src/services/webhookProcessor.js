const db = require("../db");
const { canTransition } = require("./orderStateMachine");
const { markWebhookProcessed } = require("../lib/idempotency");
const { attemptIssue } = require("./issuance");
const { broadcast } = require("./realtime");
const { getStock } = require("./catalog");

function now() {
  return new Date().toISOString();
}

const applyWebhookEventTxn = db.immediateTransaction((ev) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(ev.orderId);
  if (!order) return { applied: false, reason: "order_not_found" };

  if (ev.status === "failed") {
    let stockChangedSku = null;
    if (canTransition(order.status, "payment_failed")) {
      const released = db
        .prepare("UPDATE keys_pool SET status = 'available', order_id = NULL WHERE order_id = ? AND status = 'reserved'")
        .run(ev.orderId);
      if (released.changes > 0) stockChangedSku = order.sku;
      db.prepare("UPDATE orders SET status = 'payment_failed', updated_at = ? WHERE id = ?").run(now(), ev.orderId);
    }
    markWebhookProcessed(db, ev.eventId);
    return { applied: true, shouldIssue: false, stockChangedSku };
  }

  if (ev.status === "paid") {
    if (canTransition(order.status, "paid")) {
      db.prepare("UPDATE orders SET status = 'paid', updated_at = ? WHERE id = ?").run(now(), ev.orderId);
      markWebhookProcessed(db, ev.eventId);
      return { applied: true, shouldIssue: true };
    }
    markWebhookProcessed(db, ev.eventId);
    return { applied: true, shouldIssue: false };
  }

  markWebhookProcessed(db, ev.eventId);
  return { applied: true, shouldIssue: false };
});

function applyWebhookEvent(event) {
  const result = applyWebhookEventTxn(event);

  if (result.stockChangedSku) {
    broadcast("stock_changed", { sku: result.stockChangedSku, stock: getStock(result.stockChangedSku) });
  }

  if (result.shouldIssue) {
    attemptIssue(event.orderId).catch((err) => {
      console.error(`issuance failed for order ${event.orderId}:`, err);
    });
  }

  return result;
}

function applyPendingEventsForOrder(orderId) {
  const pending = db
    .prepare("SELECT * FROM webhook_events WHERE order_id = ? AND processed = 0 ORDER BY received_at ASC")
    .all(orderId);

  for (const row of pending) {
    applyWebhookEvent({ eventId: row.event_id, orderId: row.order_id, status: row.status });
  }
}

module.exports = { applyWebhookEvent, applyPendingEventsForOrder };
