const TRANSITIONS = {
  created: ["paid", "payment_failed"],
  paid: ["delivering"],
  delivering: ["delivered", "out_of_stock", "delivery_failed"],
  out_of_stock: ["delivering"],
  delivery_failed: ["delivering"],
  delivered: [],
  payment_failed: [],
};

const FINAL_STATUSES = new Set(["delivered", "payment_failed"]);

function canTransition(from, to) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));
}

function isFinal(status) {
  return FINAL_STATUSES.has(status);
}

module.exports = { TRANSITIONS, canTransition, isFinal };
