const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const CONCURRENCY = 50;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const createRes = await fetch(`${BASE_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku: "KEY-GTA5" }),
  });
  const { order } = await createRes.json();
  console.log(`Заказ создан: ${order.id} (${order.status})`);

  const eventId = `evt_race_${Date.now()}`;
  const payload = {
    event_id: eventId,
    order_id: order.id,
    status: "paid",
    amount: order.amount,
    currency: order.currency,
    created_at: new Date().toISOString(),
  };

  console.log(`Отправляем ${CONCURRENCY} параллельных вебхуков с event_id=${eventId}...`);

  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      fetch(`${BASE_URL}/webhook/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json())
    )
  );

  const statusCounts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  console.log("Ответы вебхука:", statusCounts);

  await sleep(4000);

  const finalOrderRes = await fetch(`${BASE_URL}/orders/${order.id}`);
  const { order: finalOrder } = await finalOrderRes.json();
  console.log("Финальный заказ:", finalOrder);

  const keysRes = await fetch(`${BASE_URL}/admin/keys-for-order/${order.id}`);
  const { keys } = await keysRes.json();
  console.log("Ключи, привязанные к заказу:", keys);

  const issuedKeys = keys.filter((k) => k.status === "issued");

  const pass =
    statusCounts.accepted === 1 &&
    (statusCounts.duplicate_ignored || 0) === CONCURRENCY - 1 &&
    issuedKeys.length <= 1 &&
    (finalOrder.status !== "delivered" || issuedKeys.length === 1);

  console.log(pass ? "\n✅ PASS: ключ выдан не более одного раза, дубликаты вебхука проигнорированы" : "\n❌ FAIL");
  process.exitCode = pass ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
