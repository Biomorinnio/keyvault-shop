const express = require("express");
const { addClient, removeClient } = require("../services/realtime");

const router = express.Router();

const HEARTBEAT_MS = 25000;

router.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(":connected\n\n");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  addClient(res);

  const heartbeat = setInterval(() => {
    res.write(":ping\n\n");
  }, HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeClient(res);
  });
});

module.exports = router;
