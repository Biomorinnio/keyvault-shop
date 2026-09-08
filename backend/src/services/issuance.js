const db = require("../db");
const { canTransition } = require("./orderStateMachine");
const supplierA = require("./supplierA");
const supplierB = require("./supplierB");

const CLIENT_TIMEOUT_MS = Number(process.env.SUPPLIER_CLIENT_TIMEOUT_MS ?? 2000);

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve({ status: "timeout" }), ms))]);
}

function now() {
  return new Date().toISOString();
}

function getOrder(orderId) {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
}

const claimForDelivery = db.immediateTransaction((id) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!order) return { outcome: "not_found" };
  if (order.status === "delivered") return { outcome: "already_delivered", order };

  if (!canTransition(order.status, "delivering")) {
    if (order.status === "delivering") {
      const keyRow = db
        .prepare("SELECT * FROM keys_pool WHERE order_id = ? AND status IN ('reserved','issued')")
        .get(id);
      return { outcome: "in_progress", order, keyRow };
    }
    return { outcome: "invalid_state", order };
  }

  const keyRow = db
    .prepare("SELECT * FROM keys_pool WHERE order_id = ? AND status IN ('reserved','issued')")
    .get(id);

  if (!keyRow) {
    db.prepare("UPDATE orders SET status = 'out_of_stock', updated_at = ? WHERE id = ?").run(now(), id);
    return { outcome: "out_of_stock", order: { ...order, status: "out_of_stock" } };
  }

  db.prepare("UPDATE orders SET status = 'delivering', updated_at = ? WHERE id = ?").run(now(), id);
  return { outcome: "claimed", order: { ...order, status: "delivering" }, keyRow };
});

const finalizeDelivered = db.immediateTransaction((orderId, keyCode, code) => {
  db.prepare("UPDATE keys_pool SET status = 'issued' WHERE code = ? AND order_id = ?").run(keyCode, orderId);
  db.prepare("UPDATE orders SET status = 'delivered', issued_code = ?, updated_at = ? WHERE id = ?").run(
    code,
    now(),
    orderId
  );
});

const finalizeFailed = db.immediateTransaction((orderId, status) => {
  db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), orderId);
});

function getIssuanceRequest(requestId) {
  return db.prepare("SELECT * FROM issuance_requests WHERE request_id = ?").get(requestId);
}

function upsertIssuanceRequest(requestId, orderId, supplier, status, code) {
  db.prepare(
    `INSERT INTO issuance_requests (request_id, order_id, supplier, code, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(request_id) DO UPDATE SET status = excluded.status, code = excluded.code`
  ).run(requestId, orderId, supplier, code || null, status, now());
}

async function callSupplier(supplier, requestId, sku, orderId) {
  const existing = getIssuanceRequest(requestId);
  if (existing && existing.status === "ok" && existing.code) {
    return { status: "ok", code: existing.code };
  }
  if (!existing) {
    upsertIssuanceRequest(requestId, orderId, supplier.name, "pending", null);
  }

  const result = await withTimeout(supplier.issue({ requestId, sku, orderId }), CLIENT_TIMEOUT_MS);

  if (result.status === "ok") {
    upsertIssuanceRequest(requestId, orderId, supplier.name, "ok", result.code);
    return { status: "ok", code: result.code };
  }
  if (result.status === "error") {
    upsertIssuanceRequest(requestId, orderId, supplier.name, "error", null);
    return { status: "error" };
  }
  return { status: "timeout" };
}

function abandonAfterSupplierTimeout(orderId, order) {
  finalizeFailed(orderId, "delivery_failed");
  return { ok: false, order: { ...order, status: "delivery_failed" }, reason: "supplier_timeout" };
}

async function attemptFallbackSupplier(order, orderId, keyRow) {
  const requestIdB = `${orderId}:B`;
  const result = await callSupplier(supplierB, requestIdB, order.sku, orderId);

  if (result.status === "ok") {
    finalizeDelivered(orderId, keyRow.code, result.code);
    return { ok: true, order: { ...order, status: "delivered", issued_code: result.code } };
  }

  finalizeFailed(orderId, "delivery_failed");
  return {
    ok: false,
    order: { ...order, status: "delivery_failed" },
    reason: result.status === "timeout" ? "supplier_timeout" : "both_suppliers_failed",
  };
}

async function attemptIssue(orderId) {
  const claim = claimForDelivery(orderId);

  if (claim.outcome === "not_found") return { ok: false, reason: "order_not_found" };
  if (claim.outcome === "already_delivered") return { ok: true, order: claim.order };
  if (claim.outcome === "out_of_stock") return { ok: false, order: claim.order, reason: "out_of_stock" };
  if (claim.outcome === "invalid_state") return { ok: false, order: claim.order, reason: "invalid_state" };
  if (claim.outcome === "in_progress") return { ok: false, order: claim.order, reason: "in_progress" };

  const { order, keyRow } = claim;
  const requestIdA = `${orderId}:A`;

  const result = await callSupplier(supplierA, requestIdA, order.sku, orderId);

  if (result.status === "ok") {
    finalizeDelivered(orderId, keyRow.code, result.code);
    return { ok: true, order: { ...order, status: "delivered", issued_code: result.code } };
  }

  if (result.status === "timeout") {
    return abandonAfterSupplierTimeout(orderId, order);
  }

  return attemptFallbackSupplier(order, orderId, keyRow);
}

module.exports = { attemptIssue, getOrder };
