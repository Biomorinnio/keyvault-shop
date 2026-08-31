const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const { KEYS_POOL_SEED } = require("../data/keysPool");
const { PROMOCODES_SEED } = require("../data/promocodes");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "..", "data.sqlite");

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema);

function immediateTransaction(fn) {
  return (...args) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn(...args);
      db.exec("COMMIT");
      return result;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  };
}

function seedKeysPool() {
  const insert = db.prepare("INSERT OR IGNORE INTO keys_pool (code, sku, status, order_id) VALUES (?, ?, 'available', NULL)");
  immediateTransaction(() => {
    for (const { code, sku } of KEYS_POOL_SEED) insert.run(code, sku);
  })();
}

function seedPromocodes() {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO promocodes (code, type, value, max_uses, used) VALUES (?, ?, ?, ?, 0)"
  );
  immediateTransaction(() => {
    for (const { code, type, value, max_uses } of PROMOCODES_SEED) insert.run(code, type, value, max_uses);
  })();
}

seedKeysPool();
seedPromocodes();

module.exports = db;
module.exports.immediateTransaction = immediateTransaction;
