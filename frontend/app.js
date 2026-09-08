(() => {
  const catalogBtn = document.getElementById("catalogBtn");
  const catalogMenu = document.getElementById("catalogMenu");

  function isOpen() {
    return catalogMenu.classList.contains("catalog-menu_open");
  }

  function openCatalog() {
    catalogMenu.classList.add("catalog-menu_open");
    catalogBtn.setAttribute("aria-expanded", "true");
  }

  function closeCatalog() {
    catalogMenu.classList.remove("catalog-menu_open");
    catalogBtn.setAttribute("aria-expanded", "false");
  }

  catalogBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isOpen()) {
      closeCatalog();
    } else {
      openCatalog();
    }
  });

  document.addEventListener("click", (e) => {
    if (isOpen() && !catalogMenu.contains(e.target) && !catalogBtn.contains(e.target)) {
      closeCatalog();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) closeCatalog();
  });
})();

(() => {
  const track = document.getElementById("bannerTrack");
  const dotsWrap = document.getElementById("bannerDots");
  const prevBtn = document.getElementById("bannerPrev");
  const nextBtn = document.getElementById("bannerNext");
  const slides = Array.from(track.children);
  const AUTOPLAY_MS = 5000;

  let current = 0;
  let autoplayTimer = null;

  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "banner__dot";
    dot.setAttribute("aria-label", `Слайд ${i + 1}`);
    dot.addEventListener("click", () => goTo(i));
    dotsWrap.appendChild(dot);
  });
  const dots = Array.from(dotsWrap.children);

  function render() {
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((dot, i) => dot.classList.toggle("banner__dot_active", i === current));
  }

  function goTo(index) {
    current = (index + slides.length) % slides.length;
    render();
    restartAutoplay();
  }

  function next() {
    goTo(current + 1);
  }

  function prev() {
    goTo(current - 1);
  }

  function restartAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
    autoplayTimer = setInterval(next, AUTOPLAY_MS);
  }

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  render();
  restartAutoplay();
})();

const API_BASE = "";

function formatPrice(value) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function productCardHTML(p, { discount } = {}) {
  const oldPrice = discount ? Math.round(p.price / (1 - discount)) : null;
  const priceRow = oldPrice
    ? `<div class="product-card__price-row">
        <span class="product-card__price">${formatPrice(p.price)}</span>
        <span class="product-card__price-old">${formatPrice(oldPrice)}</span>
      </div>`
    : `<div class="product-card__price">${formatPrice(p.price)}</div>`;

  const inStock = p.stock > 0;
  const stockLine = inStock
    ? `<div class="product-card__stock">В наличии: ${p.stock}</div>`
    : `<div class="product-card__stock product-card__stock_out">Нет в наличии</div>`;

  return `
    <div class="product-card" data-sku="${p.sku}" data-discount="${discount || 0}">
      <img class="product-card__image" src="assets/products/pubg.png" alt="${p.name}" />
      <div class="product-card__body">
        <div class="product-card__title">${p.name}</div>
        ${priceRow}
        ${stockLine}
        <button class="product-card__buy" type="button" data-sku="${p.sku}"${inStock ? "" : " disabled"}>${
    inStock ? "Купить" : "Нет в наличии"
  }</button>
      </div>
    </div>
  `;
}

function renderGrid(elementId, products, options) {
  const grid = document.getElementById(elementId);
  if (!grid) return;
  grid.innerHTML = products.map((p) => productCardHTML(p, options)).join("");
}

async function loadCatalog() {
  const res = await fetch(`${API_BASE}/api/catalog`);
  if (!res.ok) throw new Error("Не удалось загрузить каталог");
  return (await res.json()).products;
}

function renderShelves(products) {
  renderGrid("productGrid", products.slice(0, 5), { discount: 0.5 });
  renderGrid("recommendedGrid", products.slice(5, 10), { discount: 0.3 });
  renderGrid("otherGrid", products.slice(10, 15), { discount: 0.2 });
}

async function syncCatalog() {
  try {
    renderShelves(await loadCatalog());
  } catch (err) {
    console.error(err);
  }
}

function cardsForSku(sku) {
  return document.querySelectorAll(`.product-card[data-sku="${CSS.escape(sku)}"]`);
}

function applyPriceChange(sku, price) {
  cardsForSku(sku).forEach((card) => {
    const discount = Number(card.dataset.discount) || 0;
    const priceEl = card.querySelector(".product-card__price");
    if (priceEl) priceEl.textContent = formatPrice(price);
    const oldEl = card.querySelector(".product-card__price-old");
    if (oldEl && discount > 0) oldEl.textContent = formatPrice(Math.round(price / (1 - discount)));
  });
}

function applyStockChange(sku, stock) {
  const inStock = stock > 0;
  cardsForSku(sku).forEach((card) => {
    const stockEl = card.querySelector(".product-card__stock");
    if (stockEl) {
      stockEl.textContent = inStock ? `В наличии: ${stock}` : "Нет в наличии";
      stockEl.classList.toggle("product-card__stock_out", !inStock);
    }
    const buyEl = card.querySelector(".product-card__buy");
    if (buyEl) {
      buyEl.disabled = !inStock;
      buyEl.textContent = inStock ? "Купить" : "Нет в наличии";
    }
  });
}

function setConnStatus(online) {
  const el = document.getElementById("connStatus");
  if (!el) return;
  el.classList.toggle("conn-status_online", online);
  el.classList.toggle("conn-status_reconnecting", !online);
  el.textContent = online ? "онлайн" : "переподключение…";
}

function connectRealtime() {
  let firstOpen = true;
  const es = new EventSource(`${API_BASE}/api/events`);

  es.addEventListener("open", () => {
    setConnStatus(true);
    if (firstOpen) {
      firstOpen = false;
    } else {
      syncCatalog();
    }
  });

  es.addEventListener("error", () => setConnStatus(false));

  es.addEventListener("price_changed", (e) => {
    const { sku, price } = JSON.parse(e.data);
    applyPriceChange(sku, price);
    document.dispatchEvent(new CustomEvent("realtime:price_changed", { detail: { sku, price } }));
  });

  es.addEventListener("stock_changed", (e) => {
    const { sku, stock } = JSON.parse(e.data);
    applyStockChange(sku, stock);
  });
}

syncCatalog();
connectRealtime();

function showSoldOut(sku) {
  applyStockChange(sku, 0);
  const modal = document.getElementById("soldout");
  if (modal) modal.hidden = false;
}

(() => {
  const closeBtn = document.getElementById("soldoutClose");
  if (closeBtn) closeBtn.addEventListener("click", () => (document.getElementById("soldout").hidden = true));
})();

async function startCheckout(sku, button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Оформляем...";
  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku }),
    });
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      if (body.error === "out_of_stock") {
        showSoldOut(sku);
        button.disabled = false;
        button.textContent = original;
        return;
      }
    }
    if (!res.ok) throw new Error("Не удалось оформить заказ");
    const { order } = await res.json();
    location.href = `/?order=${encodeURIComponent(order.id)}`;
  } catch (err) {
    console.error(err);
    button.disabled = false;
    button.textContent = original;
  }
}

document.addEventListener("click", (e) => {
  const buyBtn = e.target.closest(".product-card__buy");
  if (buyBtn && buyBtn.dataset.sku) {
    startCheckout(buyBtn.dataset.sku, buyBtn);
    return;
  }

  const payBtn = e.target.closest(".topup-form__submit");
  if (payBtn) {
    startCheckout("STEAM-TOPUP-500", payBtn);
  }
});

const CHECKOUT_TERMINAL = new Set(["delivered", "payment_failed", "out_of_stock", "delivery_failed", "expired"]);

function initCheckout(orderId) {
  const view = document.getElementById("checkout");
  const elProduct = document.getElementById("coProduct");
  const elAmount = document.getElementById("coAmount");
  const elTimer = document.getElementById("coTimer");
  const elNotice = document.getElementById("coNotice");
  const elStatus = document.getElementById("coStatus");
  const elPay = document.getElementById("coPay");
  const elCode = document.getElementById("coCode");
  if (!view) return;

  document.body.classList.add("checkout-active");
  view.hidden = false;

  let order = null;
  let product = null;
  let ticker = null;
  let poller = null;
  let payAttempted = false;

  function expectedAmount() {
    if (!product || !order) return order ? order.amount : 0;
    return Math.max(product.price - (order.discount_amount || 0), 0);
  }

  function priceChanged() {
    return Boolean(product && order && order.status === "created" && expectedAmount() !== order.amount);
  }

  function remainingMs() {
    if (!order || !order.reserved_until) return 0;
    return new Date(order.reserved_until).getTime() - Date.now();
  }

  function fmt(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function stopTimers() {
    if (ticker) clearInterval(ticker);
    if (poller) clearInterval(poller);
    ticker = null;
    poller = null;
  }

  function renderTimer() {
    if (!order) return;
    if (order.status === "created" && remainingMs() > 0) {
      elTimer.hidden = false;
      elTimer.classList.remove("checkout__timer_expired");
      elTimer.textContent = `Бронь действует ещё ${fmt(remainingMs())}`;
    } else if (order.status === "created") {
      elTimer.hidden = false;
      elTimer.classList.add("checkout__timer_expired");
      elTimer.textContent = "Бронь истекла";
    } else {
      elTimer.hidden = true;
    }
  }

  function render() {
    if (!order) return;
    elProduct.textContent = product ? product.name : order.sku;

    if (priceChanged()) {
      elAmount.innerHTML = `<s>${formatPrice(order.amount)}</s> ${formatPrice(expectedAmount())}`;
    } else {
      elAmount.textContent = formatPrice(order.amount);
    }

    elNotice.hidden = true;
    elCode.hidden = true;
    elPay.hidden = false;
    elPay.disabled = payAttempted;

    const expired = order.status === "expired" || (order.status === "created" && remainingMs() <= 0);

    if (order.status === "created" && !expired) {
      elStatus.textContent = "Ключ забронирован. Завершите оплату до конца отсчёта.";
      if (priceChanged()) {
        elNotice.hidden = false;
        elNotice.textContent = `Цена изменилась, подтвердите новую сумму: было ${formatPrice(
          order.amount
        )}, стало ${formatPrice(expectedAmount())}.`;
        elPay.textContent = "Подтвердить новую цену и оплатить";
      } else {
        elPay.textContent = "Оплатить";
      }
    } else if (expired) {
      elStatus.textContent = "Бронь истекла — ключ вернулся в продажу. Вернитесь к товару.";
      elPay.hidden = true;
    } else if (order.status === "paid" || order.status === "delivering") {
      elStatus.textContent = "Оплата подтверждена, выдаём код...";
      elPay.hidden = true;
    } else if (order.status === "delivered") {
      elStatus.textContent = "Готово! Заказ выдан.";
      elPay.hidden = true;
      if (order.issued_code) {
        elCode.hidden = false;
        elCode.textContent = `Ваш код: ${order.issued_code}`;
      }
    } else if (order.status === "payment_failed") {
      elStatus.textContent = "Оплата не прошла. Вернитесь к товару.";
      elPay.hidden = true;
    } else {
      elStatus.textContent = "Не удалось выдать код. Мы попробуем повторно чуть позже.";
      elPay.hidden = true;
    }

    renderTimer();
  }

  async function refresh() {
    const res = await fetch(`${API_BASE}/orders/${orderId}`);
    if (res.status === 404) {
      stopTimers();
      elStatus.textContent = "Заказ не найден.";
      elTimer.hidden = true;
      elPay.hidden = true;
      return;
    }
    const data = await res.json();
    order = data.order;
    product = data.product;
    render();
    if (CHECKOUT_TERMINAL.has(order.status)) stopTimers();
  }

  async function pay() {
    payAttempted = true;
    elPay.disabled = true;
    try {
      if (priceChanged()) {
        await fetch(`${API_BASE}/orders/${orderId}/accept-price`, { method: "POST" });
        await refresh();
      }
      const res = await fetch(`${API_BASE}/payment/mock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        payAttempted = false;
        if (body.error === "price_changed") {
          elNotice.hidden = false;
          elNotice.textContent = `Цена изменилась, подтвердите новую сумму: стало ${formatPrice(
            body.current_price
          )}.`;
        }
        await refresh();
        return;
      }
      await refresh();
    } catch (err) {
      console.error(err);
      payAttempted = false;
      elPay.disabled = false;
    }
  }

  function onRealtimePriceChanged(e) {
    if (!order || !product || e.detail.sku !== order.sku) return;
    product.price = e.detail.price;
    render();
  }

  elPay.addEventListener("click", pay);
  document.addEventListener("realtime:price_changed", onRealtimePriceChanged);

  ticker = setInterval(renderTimer, 1000);
  poller = setInterval(refresh, 2000);
  refresh();
}

(() => {
  const switcher = document.getElementById("currencySwitch");
  if (!switcher) return;

  switcher.addEventListener("click", (e) => {
    const btn = e.target.closest(".topup-form__currency-btn");
    if (!btn) return;
    switcher
      .querySelectorAll(".topup-form__currency-btn")
      .forEach((b) => b.classList.remove("topup-form__currency-btn_active"));
    btn.classList.add("topup-form__currency-btn_active");
  });
})();

(() => {
  const orderId = new URLSearchParams(location.search).get("order");
  if (orderId) initCheckout(orderId);
})();
