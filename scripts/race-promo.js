const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PROMO_CODE = "LIMIT3";
const ATTEMPTS = 10;

async function createOrder() {
  const res = await fetch(`${BASE_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku: "KEY-CS2-PRIME" }),
  });
  const { order } = await res.json();
  return order;
}

async function applyPromo(orderId) {
  const res = await fetch(`${BASE_URL}/promo/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId, promo_code: PROMO_CODE }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  console.log(`Создаём ${ATTEMPTS} заказов и применяем к ним промокод ${PROMO_CODE} (лимит 3) параллельно...`);

  const orders = await Promise.all(Array.from({ length: ATTEMPTS }, createOrder));

  const results = await Promise.all(orders.map((o) => applyPromo(o.id)));

  const succeeded = results.filter((r) => r.status === 200);
  const limitReached = results.filter((r) => r.status === 409 && r.body.error === "promo code usage limit reached");

  console.log(`Успешных применений: ${succeeded.length}`);
  console.log(`Отказов по лимиту: ${limitReached.length}`);

  const pass = succeeded.length === 3 && limitReached.length === ATTEMPTS - 3;

  console.log(pass ? "\n✅ PASS: лимит промокода соблюдён под параллельной нагрузкой" : "\n❌ FAIL");
  if (!pass) console.log(JSON.stringify(results, null, 2));
  process.exitCode = pass ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
