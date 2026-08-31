const crypto = require("crypto");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const orderId = `ord_ooo_${crypto.randomBytes(6).toString("hex")}`;
  const eventId = `evt_ooo_${Date.now()}`;

  console.log(`Заранее известный id заказа: ${orderId} (заказ ещё не создан)`);

  const webhookRes = await fetch(`${BASE_URL}/webhook/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_id: eventId,
      order_id: orderId,
      status: "paid",
      amount: 1990,
      currency: "RUB",
      created_at: new Date().toISOString(),
    }),
  });
  const webhookBody = await webhookRes.json();
  console.log("Ответ вебхука (заказ ещё не существует):", webhookRes.status, webhookBody);

  const pass1 = webhookRes.status === 200 && webhookBody.status === "accepted_pending_order";

  console.log("Теперь создаём заказ с тем же id...");
  const createRes = await fetch(`${BASE_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku: "KEY-GTA5", id: orderId }),
  });
  const { order } = await createRes.json();
  console.log("Заказ создан:", order);

  await sleep(4000);

  const finalOrderRes = await fetch(`${BASE_URL}/orders/${orderId}`);
  const { order: finalOrder } = await finalOrderRes.json();
  console.log("Финальный заказ:", finalOrder);

  const pass2 = ["paid", "delivering", "delivered", "out_of_stock", "delivery_failed"].includes(finalOrder.status);

  const pass = pass1 && pass2;
  console.log(pass ? "\n✅ PASS: отложенное событие применилось после создания заказа" : "\n❌ FAIL");
  process.exitCode = pass ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
