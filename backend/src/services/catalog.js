const db = require("../db");

function getProduct(sku) {
  return db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) || null;
}

function getStock(sku) {
  return db.prepare("SELECT COUNT(*) AS n FROM keys_pool WHERE sku = ? AND status = 'available'").get(sku).n;
}

function listCatalog(limit = 50) {
  return db
    .prepare(
      `SELECT p.*, (
         SELECT COUNT(*) FROM keys_pool k WHERE k.sku = p.sku AND k.status = 'available'
       ) AS stock
       FROM products p
       ORDER BY p.rowid
       LIMIT ?`
    )
    .all(limit);
}

module.exports = { getProduct, getStock, listCatalog };
