const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await fetch(`${BASE_URL}/admin/products/KEY-EFT/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count: 1 }),
  });

  const createRes = await fetch(`${BASE_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku: "KEY-EFT" }),
  });
  const { order } = await createRes.json();
  console.log(`Заказ создан: ${order.id} (${order.status})`);

  console.log("Отправляем 2 параллельных POST /payment/mock...");
  const [r1, r2] = await Promise.all([
    fetch(`${BASE_URL}/payment/mock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id }),
    }).then((r) => r.json()),
    fetch(`${BASE_URL}/payment/mock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id }),
    }).then((r) => r.json()),
  ]);
  console.log("Ответы:", r1, r2);

  await sleep(4000);

  const finalOrderRes = await fetch(`${BASE_URL}/orders/${order.id}`);
  const { order: finalOrder } = await finalOrderRes.json();
  console.log("Финальный заказ:", finalOrder);

  const keysRes = await fetch(`${BASE_URL}/admin/keys-for-order/${order.id}`);
  const { keys } = await keysRes.json();
  console.log("Ключи, привязанные к заказу:", keys);

  const issuedKeys = keys.filter((k) => k.status === "issued");
  const pass = issuedKeys.length <= 1 && (finalOrder.status !== "delivered" || issuedKeys.length === 1);

  console.log(pass ? "\n✅ PASS: двойной клик не привёл к двойной выдаче" : "\n❌ FAIL");
  process.exitCode = pass ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
