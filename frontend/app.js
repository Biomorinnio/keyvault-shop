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

function productCardHTML(p, { discount } = {}) {
  const oldPrice = discount ? Math.round(p.price / (1 - discount)) : null;
  const priceRow = oldPrice
    ? `<div class="product-card__price-row">
        <span class="product-card__price">${p.price.toLocaleString("ru-RU")} ₽</span>
        <span class="product-card__price-old">${oldPrice.toLocaleString("ru-RU")} ₽</span>
      </div>`
    : `<div class="product-card__price">${p.price.toLocaleString("ru-RU")} ₽</div>`;

  const inStock = p.stock > 0;
  const stockLine = inStock
    ? `<div class="product-card__stock">В наличии: ${p.stock}</div>`
    : `<div class="product-card__stock product-card__stock_out">Нет в наличии</div>`;

  return `
    <div class="product-card">
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

// Три витринные полки заполняются срезами реального каталога из БД. Скидка —
// чисто визуальная (старая зачёркнутая цена), как и на первом этапе.
loadCatalog()
  .then((products) => {
    renderGrid("productGrid", products.slice(0, 5), { discount: 0.5 });
    renderGrid("recommendedGrid", products.slice(5, 10), { discount: 0.3 });
    renderGrid("otherGrid", products.slice(10, 15), { discount: 0.2 });
  })
  .catch((err) => console.error(err));

const TERMINAL_STATUSES = new Set(["delivered", "payment_failed", "out_of_stock", "delivery_failed"]);

const STATUS_LABEL = {
  created: "Создаём заказ...",
  paid: "Оплата подтверждена, выдаём...",
  delivering: "Получаем код у поставщика...",
  delivered: "Готово!",
  payment_failed: "Оплата не прошла",
  out_of_stock: "Нет в наличии",
  delivery_failed: "Не удалось выдать код",
};

async function pollOrder(orderId, { intervalMs = 1000, timeoutMs = 20000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const res = await fetch(`${API_BASE}/orders/${orderId}`);
    const { order } = await res.json();
    if (TERMINAL_STATUSES.has(order.status)) return order;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const res = await fetch(`${API_BASE}/orders/${orderId}`);
  return (await res.json()).order;
}

async function purchase(sku, button) {
  const originalLabel = button.textContent;
  button.disabled = true;

  try {
    button.textContent = "Создаём заказ...";
    const createRes = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku }),
    });
    if (!createRes.ok) throw new Error((await createRes.json()).error || "Не удалось создать заказ");
    const { order } = await createRes.json();

    button.textContent = "Оплата...";
    const payRes = await fetch(`${API_BASE}/payment/mock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id }),
    });
    if (!payRes.ok) throw new Error((await payRes.json()).error || "Оплата не прошла");

    const finalOrder = await pollOrder(order.id);
    button.textContent = STATUS_LABEL[finalOrder.status] || finalOrder.status;

    if (finalOrder.status === "delivered") {
      window.alert(`Заказ ${finalOrder.id} доставлен!\nВаш код: ${finalOrder.issued_code}`);
    } else if (finalOrder.status === "out_of_stock" || finalOrder.status === "delivery_failed") {
      window.alert(
        `Заказ ${finalOrder.id}: ${STATUS_LABEL[finalOrder.status]}.\nМы попробуем выдать код повторно чуть позже.`
      );
    }

    setTimeout(() => {
      button.textContent = originalLabel;
      button.disabled = false;
    }, 3000);
  } catch (err) {
    console.error(err);
    button.textContent = "Ошибка, повторить?";
    setTimeout(() => {
      button.textContent = originalLabel;
      button.disabled = false;
    }, 2000);
  }
}

document.addEventListener("click", (e) => {
  const buyBtn = e.target.closest(".product-card__buy");
  if (buyBtn && buyBtn.dataset.sku) {
    purchase(buyBtn.dataset.sku, buyBtn);
    return;
  }

  const payBtn = e.target.closest(".topup-form__submit");
  if (payBtn) {
    purchase("STEAM-TOPUP-500", payBtn);
  }
});

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
