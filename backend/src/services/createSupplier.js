const crypto = require("crypto");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateCode() {
  return crypto.randomBytes(6).toString("hex").toUpperCase().match(/.{1,4}/g).join("-");
}

function createSupplier({ name, failRate = 0.2, timeoutRate = 0.2, timeoutDelayMs = 8000, latencyMs = [50, 300] }) {
  const committed = new Map(); // request_id -> code

  async function issue({ requestId, sku, orderId }) {
    if (committed.has(requestId)) {
      return { status: "ok", request_id: requestId, code: committed.get(requestId) };
    }

    const roll = Math.random();

    if (roll < failRate) {
      const [minLatency, maxLatency] = latencyMs;
      await sleep(minLatency + Math.random() * (maxLatency - minLatency));
      return { status: "error", reason: "supplier_error", supplier: name };
    }

    const code = generateCode();
    committed.set(requestId, code);

    if (roll < failRate + timeoutRate) {
      await sleep(timeoutDelayMs);
      return { status: "ok", request_id: requestId, code };
    }

    const [minLatency, maxLatency] = latencyMs;
    await sleep(minLatency + Math.random() * (maxLatency - minLatency));
    return { status: "ok", request_id: requestId, code };
  }

  return { name, issue };
}

module.exports = { createSupplier, sleep };
