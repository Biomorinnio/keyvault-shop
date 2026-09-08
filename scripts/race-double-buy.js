const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SKU = process.env.SKU || "KEY-EFT";

async function postJson(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function deleteJson(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function resetStock(count) {
  await deleteJson(`/admin/products/${SKU}/keys`, { count: 10000 });
  const added = await postJson(`/admin/products/${SKU}/keys`, { count });
  return added.body.stock;
}

async function main() {
  const stock = await resetStock(5);
  console.log(`Эмулируем быстрый двойной клик "Купить" одним покупателем по ${SKU} (в наличии: ${stock})`);
  console.log("Отправляем 2 параллельных POST /orders без общего id (как это делает фронтенд сегодня)...\n");

  const [r1, r2] = await Promise.all([postJson("/orders", { sku: SKU }), postJson("/orders", { sku: SKU })]);

  console.log("Ответ 1:", r1.status, r1.body);
  console.log("Ответ 2:", r2.status, r2.body);

  const created = [r1, r2].filter((r) => r.status === 201);
  console.log(`\nСоздано заказов: ${created.length} из 2 параллельных запросов`);

  const reservedKeys = [];
  for (const r of created) {
    const keysRes = await fetch(`${BASE_URL}/admin/keys-for-order/${r.body.order.id}`);
    const { keys } = await keysRes.json();
    const reserved = keys.filter((k) => k.status === "reserved");
    reservedKeys.push(...reserved);
    console.log(`  заказ ${r.body.order.id}: ключей reserved — ${reserved.length}`);
  }

  const uniqueKeys = new Set(reservedKeys.map((k) => k.code));
  console.log(`\nВсего ключей ушло в reserved: ${reservedKeys.length} (уникальных кодов: ${uniqueKeys.size})`);

  const consistent = created.length === reservedKeys.length && uniqueKeys.size === reservedKeys.length;
  console.log(
    consistent
      ? "\n✅ Данные консистентны: на каждый созданный заказ — ровно один уникальный ключ, задвоения ключа нет"
      : "\n❌ FAIL: число заказов и число зарезервированных уникальных ключей не совпадает"
  );

  if (created.length > 1) {
    console.log(
      "\nИтог: оба запроса от 'одного пользователя' создали два отдельных заказа и заняли два разных ключа " +
        "(без общего id/сессии сервер не может отличить два клика одного человека от двух разных покупателей). " +
        "Обоснование и почему это не чинится на уровне брони — в README, раздел «Двойной клик «Купить» и параллельные заказы»."
    );
  }

  process.exitCode = consistent ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
