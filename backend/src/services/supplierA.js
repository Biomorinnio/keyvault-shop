const { createSupplier } = require("./createSupplier");

const failRate = Number(process.env.SUPPLIER_A_FAIL_RATE ?? 0.15);
const timeoutRate = Number(process.env.SUPPLIER_A_TIMEOUT_RATE ?? 0.15);

module.exports = createSupplier({
  name: "A",
  failRate,
  timeoutRate,
  timeoutDelayMs: Number(process.env.SUPPLIER_A_TIMEOUT_DELAY_MS ?? 8000),
});
