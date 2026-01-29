'use strict';

const ICON_TYPE_BY_ICON = new Map([
  // Ant Design icon names (legacy) -> UI iconType (for Phosphor mapping on client)
  ['HomeOutlined', 'home'],
  ['CarOutlined', 'transport'],
  ['ShoppingOutlined', 'shopping'],
  ['ShoppingCartOutlined', 'shopping'],
  ['CoffeeOutlined', 'food'],
  ['AppleOutlined', 'food'],
  ['MedicineBoxOutlined', 'health'],
  ['GiftOutlined', 'gift'],
  ['BankOutlined', 'finance'],
  ['CreditCardOutlined', 'finance'],
  ['WalletOutlined', 'finance'],
  ['DollarOutlined', 'finance'],
  ['TrophyOutlined', 'trophy'],
  ['BookOutlined', 'education'],
  ['HeartOutlined', 'health'],
  ['StarOutlined', 'default'],
  ['FireOutlined', 'entertainment'],
  ['ThunderboltOutlined', 'utilities'],
  ['SmileOutlined', 'lifestyle'],
  ['RocketOutlined', 'travel'],
  ['BulbOutlined', 'utilities'],
  ['CameraOutlined', 'media'],
  ['VideoCameraOutlined', 'media'],
  ['PhoneOutlined', 'tech'],
  ['LaptopOutlined', 'tech'],
  ['TabletOutlined', 'tech'],
  ['MobileOutlined', 'tech'],
  ['WifiOutlined', 'utilities'],
  ['CloudOutlined', 'utilities'],
]);

function toUnixMs(dateStr) {
  if (!dateStr) return null;
  const t = new Date(String(dateStr)).getTime();
  return Number.isFinite(t) ? t : null;
}

function formatAmount(amount, options = {}) {
  const n = typeof amount === 'string' ? Number(amount) : Number(amount);
  if (!Number.isFinite(n)) return null;
  const decimals = Number.isInteger(options.decimals) ? options.decimals : 2;
  return n.toFixed(decimals);
}

function normalizeCategoryName(name) {
  return String(name || '').trim();
}

function normalizeCategoryKey(name) {
  return normalizeCategoryName(name).toLowerCase();
}

function deriveIconType(icon) {
  const raw = String(icon || '').trim();
  if (!raw) return 'default';
  const mapped = ICON_TYPE_BY_ICON.get(raw);
  if (mapped) return mapped;

  // If backend already stores a UI icon type key, pass it through.
  const lower = raw.toLowerCase();
  if (/^[a-z0-9_-]{2,32}$/.test(lower)) return lower;
  return 'default';
}

function enrichCategoryRow(row) {
  const r = row && typeof row === 'object' ? row : {};
  return {
    ...r,
    iconType: deriveIconType(r.icon),
  };
}

function buildCategoryMetaIndex(rows) {
  const exact = new Map();
  const normalized = new Map();

  for (const r of Array.isArray(rows) ? rows : []) {
    const name = normalizeCategoryName(r && r.name);
    if (!name) continue;
    const meta = {
      name,
      icon: r && r.icon ? String(r.icon) : null,
      iconType: deriveIconType(r && r.icon),
      color: r && r.color ? String(r.color) : null,
    };
    exact.set(name, meta);
    normalized.set(normalizeCategoryKey(name), meta);
  }

  return {
    get(name) {
      const n = normalizeCategoryName(name);
      if (!n) return null;
      return exact.get(n) || normalized.get(normalizeCategoryKey(n)) || null;
    }
  };
}

function enrichTransactionRow(row, categoryIndex) {
  const r = row && typeof row === 'object' ? row : {};
  const amountNum = Number.isFinite(Number(r.amount)) ? Number(r.amount) : 0;
  const createdAtTs = toUnixMs(r.created_at) ?? toUnixMs(r.date) ?? null;
  const dateTs = toUnixMs(r.date) ?? null;

  const categoryMeta = categoryIndex && typeof categoryIndex.get === 'function'
    ? categoryIndex.get(r.category)
    : null;

  return {
    ...r,
    amount: amountNum,
    amountFormatted: formatAmount(amountNum) ?? '0.00',
    // Use created_at for animations/sorting; fallback to date.
    timestamp: createdAtTs,
    dateTimestamp: dateTs,
    categoryMeta: categoryMeta ? {
      name: categoryMeta.name,
      icon: categoryMeta.icon,
      iconType: categoryMeta.iconType,
      color: categoryMeta.color,
    } : null,
  };
}

module.exports = {
  toUnixMs,
  formatAmount,
  deriveIconType,
  enrichCategoryRow,
  buildCategoryMetaIndex,
  enrichTransactionRow,
};

