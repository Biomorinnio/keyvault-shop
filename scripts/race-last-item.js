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

async function setStockToOne() {
  await deleteJson(`/admin/products/${SKU}/keys`, { count: 10000 });
  const added = await postJson(`/admin/products/${SKU}/keys`, { count: 1 });
  return added.body.stock;
}

async function runScenario(n) {
  const stock = await setStockToOne();
  console.log(`\n── Сценарий: ${n} параллельных POST /orders на ${SKU} (в наличии: ${stock}) ──`);

  const results = await Promise.all(
    Array.from({ length: n }, () => postJson("/orders", { sku: SKU }))
  );

  const created = results.filter((r) => r.status === 201);
  const rejected = results.filter((r) => r.status === 409 && r.body.error === "out_of_stock");
  const other = results.filter((r) => r.status !== 201 && !(r.status === 409 && r.body.error === "out_of_stock"));

  console.log(`  201 Created:        ${created.length}`);
  console.log(`  409 out_of_stock:   ${rejected.length}`);
  console.log(`  прочие ответы:      ${other.length}`);
  if (created.length === 1) console.log(`  победитель:         ${created[0].body.order.id}`);
  if (other.length) console.log("  НЕОЖИДАННЫЕ:", other.map((r) => ({ status: r.status, body: r.body })));

  let reservedForWinner = [];
  if (created.length === 1) {
    const winnerId = created[0].body.order.id;
    const keysRes = await fetch(`${BASE_URL}/admin/keys-for-order/${winnerId}`);
    const { keys } = await keysRes.json();
    reservedForWinner = keys.filter((k) => k.status === "reserved");
    console.log(`  ключей reserved у победителя: ${reservedForWinner.length}`);
  }

  const followUp = await postJson("/orders", { sku: SKU });
  const soldOut = followUp.status === 409 && followUp.body.error === "out_of_stock";
  console.log(`  повторный POST /orders после гонки: ${followUp.status} ${followUp.body.error || ""} (ожидаем out_of_stock)`);

  const pass =
    created.length === 1 &&
    rejected.length === n - 1 &&
    other.length === 0 &&
    reservedForWinner.length === 1 &&
    soldOut;

  console.log(pass ? `  ✅ PASS` : `  ❌ FAIL`);
  return pass;
}

async function main() {
  const a = await runScenario(2);
  const b = await runScenario(50);

  const pass = a && b;
  console.log(
    pass
      ? "\n✅ PASS: последнюю единицу получает ровно один покупатель, остальные — честный отказ, без оплаченных заказов без товара"
      : "\n❌ FAIL"
  );
  process.exitCode = pass ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
