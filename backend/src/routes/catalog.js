const express = require("express");
const { searchCatalog } = require("../services/catalog");

const router = express.Router();

router.get("/api/catalog", (req, res) => {
  const { q, type, page, limit, sort } = req.query;
  const result = searchCatalog({
    q: typeof q === "string" ? q.trim() : "",
    type: typeof type === "string" ? type.trim() : "",
    page,
    limit,
    sort,
  });
  res.json(result);
});

module.exports = router;
