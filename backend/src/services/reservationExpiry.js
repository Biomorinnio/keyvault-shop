const db = require("../db");
const { broadcast } = require("./realtime");
const { getStock } = require("./catalog");

const EXPIRY_SCAN_MS = Number(process.env.RESERVATION_SCAN_MS ?? 1000);

const expireDueReservations = db.immediateTransaction(() => {
  const ts = new Date().toISOString();
  const due = db
    .prepare("SELECT id, sku FROM orders WHERE status = 'created' AND reserved_until IS NOT NULL AND reserved_until < ?")
    .all(ts);

  const affectedSkus = new Set();
  for (const order of due) {
    db.prepare("UPDATE keys_pool SET status = 'available', order_id = NULL WHERE order_id = ? AND status = 'reserved'").run(
      order.id
    );
    db.prepare("UPDATE orders SET status = 'expired', updated_at = ? WHERE id = ?").run(ts, order.id);
    affectedSkus.add(order.sku);
  }

  return [...affectedSkus];
});

function start() {
  setInterval(() => {
    let affectedSkus;
    try {
      affectedSkus = expireDueReservations();
    } catch (err) {
      console.error("reservation expiry sweep failed:", err);
      return;
    }
    for (const sku of affectedSkus) {
      broadcast("stock_changed", { sku, stock: getStock(sku) });
    }
  }, EXPIRY_SCAN_MS);
}

module.exports = { start, expireDueReservations };
