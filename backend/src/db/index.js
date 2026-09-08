const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const { KEYS_POOL_SEED } = require("../data/keysPool");
const { PROMOCODES_SEED } = require("../data/promocodes");
const { PRODUCTS } = require("../data/catalog");
const { GENERATED_PRODUCTS, GENERATED_KEYS_SEED } = require("../data/generateProducts");

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

function seedProducts() {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO products (sku, name, type, price, currency, image, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const ts = new Date().toISOString();
  immediateTransaction(() => {
    for (const p of PRODUCTS) insert.run(p.sku, p.name, p.type, p.price, p.currency, p.image ?? null, ts);
    for (const p of GENERATED_PRODUCTS) insert.run(p.sku, p.name, p.type, p.price, p.currency, p.image ?? null, ts);
  })();
}

function seedKeysPool() {
  const insert = db.prepare("INSERT OR IGNORE INTO keys_pool (code, sku, status, order_id) VALUES (?, ?, 'available', NULL)");
  immediateTransaction(() => {
    // Исходные 12 товаров получают заранее заготовленный пул ключей...
    for (const { code, sku } of KEYS_POOL_SEED) insert.run(code, sku);
    // ...а сгенерированные — свои 0..5 ключей из генератора каталога.
    for (const { code, sku } of GENERATED_KEYS_SEED) insert.run(code, sku);
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

seedProducts();
seedKeysPool();
seedPromocodes();

module.exports = db;
module.exports.immediateTransaction = immediateTransaction;
