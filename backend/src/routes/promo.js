const express = require("express");
const db = require("../db");
const { getProduct } = require("../data/catalog");

const router = express.Router();

function now() {
  return new Date().toISOString();
}

function computeDiscount(product, promo) {
  if (promo.type === "percent") {
    return Math.round((product.price * promo.value) / 100);
  }
  return Math.min(promo.value, product.price);
}

class PromoOutcomeError extends Error {
  constructor(outcome) {
    super("promo_outcome");
    this.outcome = outcome;
  }
}

router.post("/promo/apply", (req, res) => {
  const { order_id, promo_code } = req.body || {};
  if (!order_id || !promo_code) {
    return res.status(400).json({ error: "order_id and promo_code are required" });
  }

  let outcome;
  try {
    outcome = db.immediateTransaction(() => {
        const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(order_id);
        if (!order) throw new PromoOutcomeError({ error: 404, message: "order not found" });
        if (order.status !== "created") {
          throw new PromoOutcomeError({ error: 409, message: "promo code can only be applied before payment" });
        }
        if (order.promo_code === promo_code) {
          return { alreadyApplied: true, order };
        }
        if (order.promo_code) {
          throw new PromoOutcomeError({ error: 409, message: "order already has a different promo code applied" });
        }

        const promo = db.prepare("SELECT * FROM promocodes WHERE code = ?").get(promo_code);
        if (!promo) throw new PromoOutcomeError({ error: 404, message: "unknown promo code" });

        try {
          db.prepare("INSERT INTO promo_usages (order_id, promo_code) VALUES (?, ?)").run(order_id, promo_code);
        } catch (err) {
          if (/UNIQUE constraint failed/.test(err.message)) {
            return { alreadyApplied: true, order };
          }
          throw err;
        }

        const inc = db
          .prepare("UPDATE promocodes SET used = used + 1 WHERE code = ? AND used < max_uses")
          .run(promo_code);

        if (inc.changes === 0) {
          throw new PromoOutcomeError({ error: 409, message: "promo code usage limit reached" });
        }

        const product = getProduct(order.sku);
        const discount = computeDiscount(product, promo);
        const newAmount = Math.max(product.price - discount, 0);

        db.prepare(
          "UPDATE orders SET promo_code = ?, discount_amount = ?, amount = ?, updated_at = ? WHERE id = ?"
        ).run(promo_code, discount, newAmount, now(), order_id);

        return { order: db.prepare("SELECT * FROM orders WHERE id = ?").get(order_id) };
    })();
  } catch (err) {
    if (err instanceof PromoOutcomeError) {
      return res.status(err.outcome.error).json({ error: err.outcome.message });
    }
    throw err;
  }

  res.json({ order: outcome.order });
});

module.exports = router;
