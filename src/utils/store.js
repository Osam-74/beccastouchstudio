// ── Beccastouch Studio – localStorage data store ───────────────
const KEYS = {
  bookings: 'beccastouch_bookings',
  products: 'beccastouch_products',
  pricing:  'beccastouch_pricing',
  settings: 'beccastouch_settings',
};

export const DEFAULT_PRICING = {
  studio: { single: 5, group: 8, currency: 'GHS', unit: 'per minute' },
  glam: {
    makeup:        { general: { studio: 200, home: 280 }, bridal: { studio: 600, home: 750 } },
    gele:          { general: { studio: 150, home: 220 }, bridal: { studio: 400, home: 520 } },
    'makeup+gele': { general: { studio: 320, home: 430 }, bridal: { studio: 900, home: 1100 } },
    custom:        { general: { studio: 250, home: 350 }, bridal: { studio: 700, home: 900 } },
  },
  glamExtras: { bridesmaids: 150, gelePerBridesmaid: 100, extraDayMultiplier: 0.5 },
};

export const DEFAULT_SETTINGS = {
  studioName: 'Beccastouch Studio',
  whatsapp: '233XXXXXXXXX',
  email: 'hello@beccastouchstudio.com',
  momoNumber: '0XX XXX XXXX',
  momoName: 'Beccastouch Studio',
  address: 'Lagos, Nigeria',
  adminPin: '1234',
};

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function write(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

export const store = {
  getBookings: () => read(KEYS.bookings, []),
  saveBooking: (b) => { const list = store.getBookings(); list.push(b); write(KEYS.bookings, list); },
  updateBookingStatus: (id, status, adminNote = '') => {
    const list = store.getBookings().map(b =>
      b.id === id ? { ...b, status, adminNote, updatedAt: new Date().toISOString() } : b
    );
    write(KEYS.bookings, list);
    return list;
  },
  getProducts: () => read(KEYS.products, []),
  saveProduct: (p) => { const list = store.getProducts(); list.push({ ...p, id: genId('PRD') }); write(KEYS.products, list); },
  deleteProduct: (id) => { write(KEYS.products, store.getProducts().filter(p => p.id !== id)); },
  updateProduct: (id, updates) => {
    write(KEYS.products, store.getProducts().map(p => p.id === id ? { ...p, ...updates } : p));
  },
  getPricing: () => ({ ...DEFAULT_PRICING, ...read(KEYS.pricing, {}) }),
  savePricing: (p) => write(KEYS.pricing, p),
  getSettings: () => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) }),
  saveSettings: (s) => write(KEYS.settings, s),
};

export function genId(prefix = 'BK') {
  const d = new Date();
  const ds = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.random().toString(36).substring(2,5).toUpperCase();
  return `${prefix}-${ds}-${rand}`;
}
