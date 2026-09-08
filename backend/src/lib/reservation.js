const RESERVATION_TTL_MS = Number(process.env.RESERVATION_TTL_MS ?? 3 * 60 * 1000);

function reservedUntilFrom(nowMs) {
  return new Date(nowMs + RESERVATION_TTL_MS).toISOString();
}

module.exports = { RESERVATION_TTL_MS, reservedUntilFrom };
