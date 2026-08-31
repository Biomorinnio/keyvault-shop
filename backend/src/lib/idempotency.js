function recordWebhookEvent(db, { eventId, orderId, status, rawPayload }) {
  try {
    const info = db
      .prepare(
        `INSERT INTO webhook_events (event_id, order_id, status, raw_payload, received_at, processed)
         VALUES (?, ?, ?, ?, ?, 0)`
      )
      .run(eventId, orderId, status, JSON.stringify(rawPayload), new Date().toISOString());
    return { inserted: info.changes === 1 };
  } catch (err) {
    if (/UNIQUE constraint failed/.test(err.message)) {
      return { inserted: false };
    }
    throw err;
  }
}

function markWebhookProcessed(db, eventId) {
  db.prepare("UPDATE webhook_events SET processed = 1 WHERE event_id = ?").run(eventId);
}

module.exports = { recordWebhookEvent, markWebhookProcessed };
