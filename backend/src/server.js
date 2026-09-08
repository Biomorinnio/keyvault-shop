const express = require("express");
const path = require("path");
const ordersRouter = require("./routes/orders");
const paymentRouter = require("./routes/payment");
const webhookRouter = require("./routes/webhook");
const adminRouter = require("./routes/admin");
const promoRouter = require("./routes/promo");
const eventsRouter = require("./routes/events");
const catalogRouter = require("./routes/catalog");
const reservationExpiry = require("./services/reservationExpiry");

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, "..", "..", "frontend")));

app.use(catalogRouter);
app.use(ordersRouter);
app.use(paymentRouter);
app.use(webhookRouter);
app.use(adminRouter);
app.use(promoRouter);
app.use(eventsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`keyvault-shop backend listening on http://localhost:${PORT}`);
  reservationExpiry.start();
});
