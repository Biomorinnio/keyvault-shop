const GENERATED_COUNT = 5000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20240917);

function pick(arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

const GAMES = [
  "Counter-Strike 2", "Dota 2", "GTA V", "Cyberpunk 2077", "Elden Ring",
  "The Witcher 3", "Red Dead Redemption 2", "Baldurs Gate 3", "Hogwarts Legacy",
  "Starfield", "Apex Legends", "Valorant", "Fortnite", "Minecraft", "Terraria",
  "Stardew Valley", "Hades", "Forza Horizon 5", "EA FC 25", "Call of Duty MW III",
  "Battlefield 2042", "Rainbow Six Siege", "PUBG Battlegrounds", "Rust", "ARK Survival",
  "Palworld", "Helldivers 2", "Escape from Tarkov", "Warframe", "Destiny 2",
  "Diablo IV", "Path of Exile 2", "Sea of Thieves", "Deep Rock Galactic",
  "Dead by Daylight", "Phasmophobia", "Lethal Company", "Satisfactory", "Factorio",
  "No Mans Sky", "Subnautica", "Dying Light 2", "Resident Evil 4", "Monster Hunter Wilds",
  "Final Fantasy XVI", "Persona 5 Royal", "Sekiro", "Dark Souls III", "Hollow Knight",
  "Celeste",
];

const EDITIONS = ["Standard", "Deluxe", "Ultimate", "Gold", "Complete", "Premium"];
const REGIONS = ["Global", "RU/CIS", "Europe", "Turkey", "Argentina"];

const TOPUP_PLATFORMS = ["Steam", "PlayStation Store", "Xbox", "Epic Games", "Riot", "Roblox", "Nintendo eShop"];
const TOPUP_AMOUNTS = [300, 500, 700, 1000, 1500, 2000, 2500, 3000, 5000];

const SUBSCRIPTIONS = [
  "Discord Nitro", "YouTube Premium", "Spotify Premium", "Xbox Game Pass Ultimate",
  "PlayStation Plus", "Netflix", "Apple Music", "ChatGPT Plus", "Yandex Plus",
  "VK Music", "Crunchyroll", "Twitch Turbo",
];
const SUB_DURATIONS = ["1 месяц", "3 месяца", "6 месяцев", "12 месяцев"];

const GIFTCARD_BRANDS = ["PlayStation Store", "Xbox", "Steam", "Google Play", "App Store", "Roblox", "Amazon", "Nintendo eShop"];
const GIFTCARD_AMOUNTS = [500, 800, 1000, 1500, 2000, 2500, 3000, 5000];

const TYPES = ["key", "topup", "subscription", "giftcard"];

function makeName(type) {
  if (type === "key") {
    return `${pick(GAMES)} ${pick(EDITIONS)} — ключ активации (${pick(REGIONS)})`;
  }
  if (type === "topup") {
    return `Пополнение ${pick(TOPUP_PLATFORMS)} ${pick(TOPUP_AMOUNTS)} ₽`;
  }
  if (type === "subscription") {
    return `${pick(SUBSCRIPTIONS)} ${pick(SUB_DURATIONS)}`;
  }
  return `${pick(GIFTCARD_BRANDS)} Gift Card ${pick(GIFTCARD_AMOUNTS)} ₽`;
}

function makePrice(type) {
  if (type === "key") return randInt(2, 50) * 100 - 10;
  if (type === "topup") return pick(TOPUP_AMOUNTS);
  if (type === "subscription") return randInt(2, 40) * 50 - 1;
  return pick(GIFTCARD_AMOUNTS);
}

const GENERATED_PRODUCTS = [];
const GENERATED_KEYS_SEED = [];

for (let i = 1; i <= GENERATED_COUNT; i++) {
  const sku = `GEN-${String(i).padStart(5, "0")}`;
  const type = pick(TYPES);
  GENERATED_PRODUCTS.push({
    sku,
    name: makeName(type),
    type,
    price: makePrice(type),
    currency: "RUB",
    image: null,
  });

  const keyCount = randInt(0, 5);
  for (let k = 1; k <= keyCount; k++) {
    GENERATED_KEYS_SEED.push({ code: `${sku}-K${String(k).padStart(2, "0")}`, sku });
  }
}

module.exports = { GENERATED_PRODUCTS, GENERATED_KEYS_SEED };
