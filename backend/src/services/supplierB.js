const { createSupplier } = require("./createSupplier");

const failRate = Number(process.env.SUPPLIER_B_FAIL_RATE ?? 0.1);
const timeoutRate = Number(process.env.SUPPLIER_B_TIMEOUT_RATE ?? 0.1);

module.exports = createSupplier({
  name: "B",
  failRate,
  timeoutRate,
  timeoutDelayMs: Number(process.env.SUPPLIER_B_TIMEOUT_DELAY_MS ?? 8000),
});
