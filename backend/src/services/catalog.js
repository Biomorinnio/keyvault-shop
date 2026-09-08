const db = require("../db");

function getProduct(sku) {
  return db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) || null;
}

function getStock(sku) {
  return db.prepare("SELECT COUNT(*) AS n FROM keys_pool WHERE sku = ? AND status = 'available'").get(sku).n;
}

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

const SORTS = {
  price_asc: "p.price ASC, p.rowid ASC",
  price_desc: "p.price DESC, p.rowid ASC",
  name_asc: "p.name COLLATE NOCASE ASC, p.rowid ASC",
};

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function searchCatalog({ q, type, page = 1, limit = DEFAULT_LIMIT, sort } = {}) {
  const conditions = [];
  const whereParams = [];

  if (type) {
    conditions.push("p.type = ?");
    whereParams.push(type);
  }
  if (q) {
    conditions.push("p.name LIKE ? ESCAPE '\\'");
    whereParams.push(`%${escapeLike(q)}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = db.prepare(`SELECT COUNT(*) AS n FROM products p ${where}`).get(...whereParams).n;

  const safeLimit = Math.min(Math.max(Math.trunc(Number(limit)) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const safePage = Math.max(Math.trunc(Number(page)) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  let orderBy = SORTS[sort];
  const orderParams = [];
  if (!orderBy) {
    if (q) {
      orderBy = "CASE WHEN p.name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, p.name COLLATE NOCASE ASC, p.rowid ASC";
      orderParams.push(`${escapeLike(q)}%`);
    } else {
      orderBy = "p.rowid ASC";
    }
  }

  const products = db
    .prepare(
      `SELECT p.*, (
         SELECT COUNT(*) FROM keys_pool k WHERE k.sku = p.sku AND k.status = 'available'
       ) AS stock
       FROM products p
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...whereParams, ...orderParams, safeLimit, offset);

  return { products, total, page: safePage, limit: safeLimit };
}

module.exports = { getProduct, getStock, searchCatalog };
