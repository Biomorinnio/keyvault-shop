const db = require("../db");

// Источник истины по товарам в рантайме — таблица products в БД, а не
// data/catalog.js (тот остался только сид-данными). Цена берётся отсюда при
// создании заказа и применении промокода.

function getProduct(sku) {
  return db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) || null;
}

// Остаток не материализуется в отдельное поле — считается по запросу.
// Опирается на индекс idx_keys_pool_sku_status (sku, status).
function getStock(sku) {
  return db.prepare("SELECT COUNT(*) AS n FROM keys_pool WHERE sku = ? AND status = 'available'").get(sku).n;
}

// Первые N товаров каталога с остатком у каждого. Полноценный поиск/пагинация —
// отдельный шаг; здесь важно не тянуть все 5000 записей на витрину сразу.
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
