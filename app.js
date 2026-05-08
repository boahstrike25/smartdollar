/* =========================================================================
   $martDollar — smart, private, free personal finance & financial literacy
   Single-file vanilla JavaScript app. Local-first. PWA. No paid dependencies.

   Architecture:
     - h()             : tiny hyperscript helper for DOM creation
     - db              : Dexie IndexedDB wrapper
     - state           : observable app state (subscribe / mutate / load)
     - router          : hash-based router
     - pages.*         : page renderers (onboarding, dashboard, transactions, ...)
     - components.*    : modal, toast, statCard, ...
     - main()          : bootstrap

   Privacy: ALL DATA stays in the user's browser via IndexedDB.
   ========================================================================= */
'use strict';

/* =========================================================================
   1. UTILITIES
   ========================================================================= */
const Utils = (() => {
  const PAY_FREQUENCIES = {
    weekly:    { label: 'Weekly',     periodsPerMonth: 4.345 },
    biweekly:  { label: 'Every 2 weeks', periodsPerMonth: 2.17 },
    semimonthly:{label: 'Twice a month', periodsPerMonth: 2 },
    monthly:   { label: 'Monthly',    periodsPerMonth: 1 },
  };

  const CURRENCIES = [
    { code: 'USD', symbol: '$',  name: 'US Dollar' },
    { code: 'EUR', symbol: '€',  name: 'Euro' },
    { code: 'GBP', symbol: '£',  name: 'British Pound' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'JPY', symbol: '¥',  name: 'Japanese Yen' },
    { code: 'INR', symbol: '₹',  name: 'Indian Rupee' },
    { code: 'NGN', symbol: '₦',  name: 'Nigerian Naira' },
    { code: 'KES', symbol: 'KSh',name: 'Kenyan Shilling' },
    { code: 'ZAR', symbol: 'R',  name: 'South African Rand' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    { code: 'MXN', symbol: 'MX$',name: 'Mexican Peso' },
  ];

  function formatMoney(amount, currency = 'USD', opts = {}) {
    const minDigits = opts.minDigits ?? 2;
    const maxDigits = opts.maxDigits ?? 2;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: minDigits,
        maximumFractionDigits: maxDigits,
      }).format(amount || 0);
    } catch (e) {
      return `${currency} ${Number(amount || 0).toFixed(2)}`;
    }
  }
  function formatNumber(n, digits = 0) {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: digits, maximumFractionDigits: digits
    }).format(n || 0);
  }
  function formatPct(n, digits = 0) {
    return `${(n * 100).toFixed(digits)}%`;
  }
  function formatDate(d, opts = {}) {
    const date = d instanceof Date ? d : new Date(d);
    return new Intl.DateTimeFormat(undefined, opts.long
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: opts.year ? 'numeric' : undefined }
    ).format(date);
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function monthKey(d = new Date()) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  function monthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }
  function monthShortLabel(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'short' });
  }
  function startOfMonth(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }
  function endOfMonth(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m, 0, 23, 59, 59);
  }
  function addMonths(key, n) {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return monthKey(d);
  }

  const uid = () => 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // tiny event bus
  function bus() {
    const subs = new Set();
    return {
      on: (fn) => { subs.add(fn); return () => subs.delete(fn); },
      emit: (...a) => subs.forEach(fn => { try { fn(...a); } catch (e) { console.error(e); } }),
    };
  }

  // Debounce
  function debounce(fn, ms) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return {
    PAY_FREQUENCIES, CURRENCIES,
    formatMoney, formatNumber, formatPct, formatDate, todayISO,
    monthKey, monthLabel, monthShortLabel, startOfMonth, endOfMonth, addMonths,
    uid, bus, debounce, escapeHtml,
  };
})();


/* =========================================================================
   2a. BRAND — $martDollar logo mark (inline SVG)
   ========================================================================= */
const BRAND_NAME = '$martDollar';
const BrandMarkSVG = (size = 28) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="${size}" height="${size}" aria-hidden="true"><text x="14" y="21" font-size="22" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" fill="#ffffff" font-weight="900" letter-spacing="-0.5">$</text></svg>`;

/* =========================================================================
   2b. MOTIVATIONAL QUOTES — rotated on each app entry / refresh
   ========================================================================= */
const Quotes = [
  "Keep going—small steps lead to big change.",
  "Believe you can and you're halfway there.",
  "Do the best you can. No one can do more than that.",
  "Attitude is a little thing that makes a big difference.",
  "It is never too late to be what you might have been.",
  "Do what you can, with what you have, where you are.",
  "It always seems impossible until it's done.",
  "We will fail when we fail to try.",
  "Whatever you are, be a good one.",
  "All our dreams can come true \u2014 if we have the courage to pursue them.",
  "Be yourself; everyone else is already taken.",
  "Be the change you wish to see in the world.",
  "Go the extra mile. It's never crowded there.",
  "One positive thought in the morning can change your whole day.",
  "It is hard to beat a person who never gives up.",
  "Progress, not perfection.",
  "Focus on impact; results will follow.",
  "Stay consistent. Your future self will thank you.",
  "Every effort counts. Keep building.",
  "Progress is progress, no matter how small.",
  "You are becoming someone you once needed.",
  "Start where you are and rise from there.",
  "Your future needs your effort today.",
  "Strength grows in the moments that feel heavy.",
  "You don\u2019t have to be perfect to be powerful.",
  "Every step forward counts.",
  "Your consistency will outshine your struggles.",
  "Sometimes courage is just trying again tomorrow.",
  "The version of you you\u2019re chasing is already possible.",
  "Small habits shape big destinies.",
  "Better days begin with better decisions.",
  "Believe in the work you\u2019re doing, even before results show.",
  "Your story is far from over.",
  "You didn\u2019t come this far to stay the same.",
  "Turn pressure into purpose.",
  "You are building a life you will be proud of.",
  "Don\u2019t fear failure \u2014 fear giving up.",
  "Growth begins outside your comfort zone.",
  "Work quietly, then let success speak.",
  "Even slow progress beats standing still.",
  "Your dreams deserve action, not hesitation.",
  "One step today can change everything tomorrow.",
  "You have what it takes \u2014 act like it.",
  "Nothing changes if nothing changes.",
  "Discipline is a form of self-love.",
  "The comeback is always stronger than the setback.",
  "Peace is also a goal worth chasing.",
  "Use the struggle \u2014 don\u2019t waste it.",
  "Who you become matters more than what you do.",
  "Greatness follows patience and work.",
  "You are allowed to start again.",
  "Your pace is not the problem \u2014 quitting is.",
  "When you can\u2019t control the situation, control your response.",
  "Something great is quietly forming inside you.",
  "Your future self is cheering you on.",
  "Storms don\u2019t last \u2014 but strength does.",
  "Excellence is built on ordinary days.",
  "Success begins the moment you refuse to quit.",
  "Remember why you started and keep going.",
  "Your dreams are waiting for your courage.",
  "Turn hope into a plan and a plan into action.",
  "You are capable of more than you realize.",
  "Doubt kills more dreams than failure ever will.",
  "Nothing extraordinary happens inside a comfort zone.",
  "Be proud of how far you\u2019ve come \u2014 you're not done yet.",
  "Focus on progress, not perfection.",
  "Inner peace is the real win.",
  "Your energy introduces you before you speak.",
  "You were made for more than fear.",
  "With the right mindset, everything can shift.",
  "The best project you\u2019ll ever work on is you.",
  "A single decision can rewrite your entire life.",
  "What you practice in private, you will be rewarded for in public.",
  "Every challenge is shaping you for something greater.",
  "Be disciplined enough to stay consistent.",
  "Believe it, envision it, work for it.",
  "Where focus goes, progress grows.",
  "Don\u2019t shrink \u2014 rise.",
  "You are the change your life has been waiting for.",
];
// Pick a quote ONCE per session/page-load so it stays steady while navigating
// but rotates on every refresh.
const TODAY_QUOTE = Quotes[Math.floor(Math.random() * Quotes.length)];

/* =========================================================================
   2. ICONS — inline SVG (no external icon font needed)
   ========================================================================= */
const Icon = (() => {
  const svg = (path, opts = {}) =>
    `<svg viewBox="0 0 24 24" width="${opts.size || 20}" height="${opts.size || 20}" fill="none" stroke="currentColor" stroke-width="${opts.stroke || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  return {
    home:    (o) => svg('<path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V10"/>', o),
    list:    (o) => svg('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>', o),
    pie:     (o) => svg('<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>', o),
    target:  (o) => svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>', o),
    book:    (o) => svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', o),
    settings:(o) => svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>', o),
    plus:    (o) => svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', o),
    x:       (o) => svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', o),
    edit:    (o) => svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>', o),
    trash:   (o) => svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>', o),
    upload:  (o) => svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>', o),
    download:(o) => svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', o),
    arrowUp: (o) => svg('<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>', o),
    arrowDown:(o) => svg('<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>', o),
    check:   (o) => svg('<polyline points="20 6 9 17 4 12"/>', o),
    info:    (o) => svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>', o),
    warn:    (o) => svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', o),
    lightbulb:(o) => svg('<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2z"/>', o),
    wallet:  (o) => svg('<path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1"/><circle cx="17" cy="13" r="1.5"/>', o),
    trend:   (o) => svg('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>', o),
    coins:   (o) => svg('<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="M9 14H7"/><path d="M16.71 13.88l.7.71-2.82 2.82"/>', o),
    flame:   (o) => svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>', o),
    shield:  (o) => svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', o),
    search:  (o) => svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>', o),
    chevR:   (o) => svg('<polyline points="9 18 15 12 9 6"/>', o),
    chevL:   (o) => svg('<polyline points="15 18 9 12 15 6"/>', o),
    sparkle: (o) => svg('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>', o),
  };
})();


/* =========================================================================
   3. h() — tiny hyperscript DOM helper
   ========================================================================= */
function h(tag, props, ...children) {
  if (typeof tag === 'function') return tag(props || {}, children);
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') {
        el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
      } else if (k === 'style' && typeof v === 'object') {
        Object.assign(el.style, v);
      } else if (k === 'html') {
        el.innerHTML = v;
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'dataset' && typeof v === 'object') {
        Object.assign(el.dataset, v);
      } else if (k === 'for') {
        // <label for="..."> — DOM property is htmlFor; attribute is for.
        el.setAttribute('for', v);
      } else if (k in el && !k.startsWith('aria-') && k !== 'role' && k !== 'list') {
        // Prefer property assignment so things like defaultValue / defaultChecked / value actually apply.
        try { el[k] = v; } catch (e) { el.setAttribute(k, v); }
      } else {
        el.setAttribute(k, v);
      }
    }
  }
  appendChildren(el, children);
  return el;
}
function appendChildren(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}
function clearNode(node) { while (node.firstChild) node.removeChild(node.firstChild); }


/* =========================================================================
   4. DATABASE — Dexie / IndexedDB
   ========================================================================= */
const db = new Dexie('PennywiseDB');
db.version(1).stores({
  profile:      'id, createdAt',
  transactions: 'id, date, type, categoryId, amount',
  categories:   'id, type, name',
  budgets:      'id, monthKey, categoryId, &[monthKey+categoryId]',
  goals:        'id, status, type, priority',
  debts:        'id, name, balance',
  prefs:        'id',
  meta:         'key',
});

const DEFAULT_CATEGORIES = [
  // Expenses
  { name: 'Housing',        type: 'expense', icon: '🏠', color: '#0ea5e9', monthlyLimit: 0, isDefault: true },
  { name: 'Groceries',      type: 'expense', icon: '🛒', color: '#16a34a', monthlyLimit: 0, isDefault: true },
  { name: 'Transport',      type: 'expense', icon: '🚌', color: '#f59e0b', monthlyLimit: 0, isDefault: true },
  { name: 'Utilities',      type: 'expense', icon: '💡', color: '#7c3aed', monthlyLimit: 0, isDefault: true },
  { name: 'Dining out',     type: 'expense', icon: '🍔', color: '#ef4444', monthlyLimit: 0, isDefault: true },
  { name: 'Entertainment',  type: 'expense', icon: '🎬', color: '#ec4899', monthlyLimit: 0, isDefault: true },
  { name: 'Health',         type: 'expense', icon: '🩺', color: '#06b6d4', monthlyLimit: 0, isDefault: true },
  { name: 'Personal care',  type: 'expense', icon: '💆', color: '#a855f7', monthlyLimit: 0, isDefault: true },
  { name: 'Subscriptions',  type: 'expense', icon: '📺', color: '#8b5cf6', monthlyLimit: 0, isDefault: true },
  { name: 'Education',      type: 'expense', icon: '📚', color: '#14b8a6', monthlyLimit: 0, isDefault: true },
  { name: 'Other expense',  type: 'expense', icon: '🧾', color: '#64748b', monthlyLimit: 0, isDefault: true },
  // Income
  { name: 'Salary',         type: 'income',  icon: '💼', color: '#0d9488', isDefault: true },
  { name: 'Freelance',      type: 'income',  icon: '💻', color: '#0891b2', isDefault: true },
  { name: 'Gift',           type: 'income',  icon: '🎁', color: '#db2777', isDefault: true },
  { name: 'Other income',   type: 'income',  icon: '✨', color: '#65a30d', isDefault: true },
  // Savings
  { name: 'Savings',        type: 'savings', icon: '🐷', color: '#0f766e', isDefault: true },
];

const Repo = {
  async ensureSeeded() {
    const count = await db.categories.count();
    if (count === 0) {
      const seed = DEFAULT_CATEGORIES.map(c => ({ id: Utils.uid(), ...c }));
      await db.categories.bulkAdd(seed);
    }
  },
  async getProfile() {
    const list = await db.profile.toArray();
    return list[0] || null;
  },
  async setProfile(p) {
    const now = new Date().toISOString();
    const existing = await this.getProfile();
    if (existing) {
      const updated = { ...existing, ...p, updatedAt: now };
      await db.profile.put(updated);
      return updated;
    } else {
      const created = { id: Utils.uid(), createdAt: now, updatedAt: now, ...p };
      await db.profile.put(created);
      return created;
    }
  },
  async listCategories() { return db.categories.toArray(); },
  async addCategory(cat) { const c = { id: Utils.uid(), ...cat }; await db.categories.put(c); return c; },
  async updateCategory(id, changes) { await db.categories.update(id, changes); },
  async deleteCategory(id) {
    // reassign transactions to "Other expense" or "Other income"
    const cat = await db.categories.get(id);
    if (!cat) return;
    if (cat.isDefault) throw new Error('Default categories cannot be deleted.');
    const fallback = (await db.categories.where('type').equals(cat.type).toArray())
      .find(c => c.isDefault && c.name.startsWith('Other'));
    if (fallback) {
      await db.transactions.where('categoryId').equals(id).modify({ categoryId: fallback.id });
    }
    await db.categories.delete(id);
  },

  async listTransactions(filter = {}) {
    let coll = db.transactions.orderBy('date').reverse();
    let arr = await coll.toArray();
    if (filter.monthKey) arr = arr.filter(t => t.date.startsWith(filter.monthKey));
    if (filter.type)     arr = arr.filter(t => t.type === filter.type);
    if (filter.categoryId) arr = arr.filter(t => t.categoryId === filter.categoryId);
    if (filter.search) {
      const s = filter.search.toLowerCase();
      arr = arr.filter(t =>
        (t.merchant || '').toLowerCase().includes(s) ||
        (t.notes || '').toLowerCase().includes(s));
    }
    return arr;
  },
  async addTransaction(t) {
    const tx = {
      id: Utils.uid(), createdAt: new Date().toISOString(), source: 'manual', ...t,
      amount: Math.abs(Number(t.amount)),
    };
    await db.transactions.put(tx);
    return tx;
  },
  async updateTransaction(id, changes) {
    if (changes.amount != null) changes.amount = Math.abs(Number(changes.amount));
    await db.transactions.update(id, changes);
  },
  async deleteTransaction(id) { await db.transactions.delete(id); },

  async listBudgets(monthKey) {
    if (!monthKey) return db.budgets.toArray();
    return db.budgets.where('monthKey').equals(monthKey).toArray();
  },
  async setBudget(monthKey, categoryId, amount) {
    const existing = await db.budgets.get({ monthKey, categoryId });
    if (existing) {
      await db.budgets.update(existing.id, { amount: Number(amount) });
    } else {
      await db.budgets.put({ id: Utils.uid(), monthKey, categoryId, amount: Number(amount) });
    }
  },

  async listGoals() { return db.goals.orderBy('priority').toArray(); },
  async addGoal(g)  { const goal = { id: Utils.uid(), status: 'active', currentAmount: 0, priority: 1, createdAt: new Date().toISOString(), ...g }; await db.goals.put(goal); return goal; },
  async updateGoal(id, changes) { await db.goals.update(id, changes); },
  async deleteGoal(id) { await db.goals.delete(id); },

  async listDebts() { return db.debts.toArray(); },
  async addDebt(d) { const debt = { id: Utils.uid(), createdAt: new Date().toISOString(), ...d }; await db.debts.put(debt); return debt; },
  async updateDebt(id, changes) { await db.debts.update(id, changes); },
  async deleteDebt(id) { await db.debts.delete(id); },

  async exportAll() {
    const [profile, categories, transactions, budgets, goals, debts] = await Promise.all([
      db.profile.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.budgets.toArray(),
      db.goals.toArray(),
      db.debts.toArray(),
    ]);
    return {
      app: '$martDollar',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { profile, categories, transactions, budgets, goals, debts },
    };
  },
  async importAll(payload) {
    // Accept both new ($martDollar) and legacy (Pennywise) backup files.
    const validApp = payload && (payload.app === '$martDollar' || payload.app === 'Pennywise');
    if (!validApp) throw new Error('Not a $martDollar backup file.');
    const d = payload.data || {};
    await db.transaction('rw', [db.profile, db.categories, db.transactions, db.budgets, db.goals, db.debts], async () => {
      await Promise.all([db.profile.clear(), db.categories.clear(), db.transactions.clear(),
                         db.budgets.clear(), db.goals.clear(), db.debts.clear()]);
      if (d.profile?.length)      await db.profile.bulkPut(d.profile);
      if (d.categories?.length)   await db.categories.bulkPut(d.categories);
      if (d.transactions?.length) await db.transactions.bulkPut(d.transactions);
      if (d.budgets?.length)      await db.budgets.bulkPut(d.budgets);
      if (d.goals?.length)        await db.goals.bulkPut(d.goals);
      if (d.debts?.length)        await db.debts.bulkPut(d.debts);
    });
  },
  async wipeAll() {
    await db.transaction('rw', [db.profile, db.categories, db.transactions, db.budgets, db.goals, db.debts, db.prefs, db.meta], async () => {
      await Promise.all([
        db.profile.clear(), db.categories.clear(), db.transactions.clear(),
        db.budgets.clear(), db.goals.clear(), db.debts.clear(),
        db.prefs.clear(), db.meta.clear(),
      ]);
    });
  },
};


/* =========================================================================
   5. STATE — observable
   ========================================================================= */
const State = (() => {
  const _state = {
    profile: null,
    categories: [],
    transactions: [],
    budgets: [],
    goals: [],
    debts: [],
    currentMonth: Utils.monthKey(),
    isLoading: true,
    route: location.hash.slice(1) || '/dashboard',
  };
  const events = Utils.bus();

  async function loadAll() {
    _state.isLoading = true; events.emit(_state);
    const [profile, categories, transactions, budgets, goals, debts] = await Promise.all([
      Repo.getProfile(),
      Repo.listCategories(),
      Repo.listTransactions(),
      Repo.listBudgets(),
      Repo.listGoals(),
      Repo.listDebts(),
    ]);
    Object.assign(_state, { profile, categories, transactions, budgets, goals, debts, isLoading: false });
    events.emit(_state);
  }

  return {
    get() { return _state; },
    on(fn) { return events.on(fn); },
    notify() { events.emit(_state); },
    setMonth(m) { _state.currentMonth = m; events.emit(_state); },
    setRoute(r) { _state.route = r; events.emit(_state); },
    loadAll,
  };
})();


/* =========================================================================
   6. SELECTORS — derived data / financial logic
   ========================================================================= */
const Sel = {
  catById(state, id) { return state.categories.find(c => c.id === id); },
  txInMonth(state, month = state.currentMonth) {
    return state.transactions.filter(t => t.date.startsWith(month));
  },
  monthIncome(state, m = state.currentMonth) {
    return Sel.txInMonth(state, m).filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
  },
  monthExpenses(state, m = state.currentMonth) {
    return Sel.txInMonth(state, m).filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
  },
  monthSavings(state, m = state.currentMonth) {
    return Sel.txInMonth(state, m).filter(t => t.type === 'savings').reduce((s,t) => s+t.amount, 0);
  },
  monthCashflow(state, m = state.currentMonth) {
    return Sel.monthIncome(state, m) - Sel.monthExpenses(state, m) - Sel.monthSavings(state, m);
  },
  savingsRate(state, m = state.currentMonth) {
    const inc = Sel.monthIncome(state, m);
    if (!inc) return 0;
    return Sel.monthSavings(state, m) / inc;
  },
  spendingByCategory(state, m = state.currentMonth) {
    const map = {};
    for (const t of Sel.txInMonth(state, m)) {
      if (t.type !== 'expense') continue;
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    }
    return map;
  },
  budgetForMonth(state, m = state.currentMonth) {
    const budgets = state.budgets.filter(b => b.monthKey === m);
    const spending = Sel.spendingByCategory(state, m);
    return budgets.map(b => {
      const cat = Sel.catById(state, b.categoryId);
      const spent = spending[b.categoryId] || 0;
      const remaining = b.amount - spent;
      const pct = b.amount > 0 ? spent / b.amount : 0;
      let status = 'ok';
      if (pct >= 1) status = 'over';
      else if (pct >= 0.85) status = 'warn';
      return { ...b, category: cat, spent, remaining, pct, status };
    });
  },
  rolling3mAvg(state, categoryId, m = state.currentMonth) {
    let total = 0;
    for (let i = 1; i <= 3; i++) {
      const k = Utils.addMonths(m, -i);
      total += state.transactions
        .filter(t => t.categoryId === categoryId && t.date.startsWith(k))
        .reduce((s,t) => s+t.amount, 0);
    }
    return total / 3;
  },
  unusualSpendingFlags(state, m = state.currentMonth) {
    const now = Sel.spendingByCategory(state, m);
    const flags = [];
    for (const cid of Object.keys(now)) {
      const avg = Sel.rolling3mAvg(state, cid, m);
      if (avg > 0 && now[cid] > avg * 1.5 && now[cid] - avg > 20) {
        flags.push({ categoryId: cid, current: now[cid], avg });
      }
    }
    return flags;
  },
  trendLast(state, n = 6) {
    const months = [];
    for (let i = n - 1; i >= 0; i--) {
      const k = Utils.addMonths(state.currentMonth, -i);
      months.push({
        key: k,
        label: Utils.monthShortLabel(k),
        income: Sel.monthIncome(state, k),
        expenses: Sel.monthExpenses(state, k),
        savings: Sel.monthSavings(state, k),
      });
    }
    return months;
  },
  upcomingRecurring(state, daysAhead = 14) {
    // Simple model: any transaction with recurringRuleId in past 35 days suggests upcoming repeat
    // For MVP we just surface recurring expenses tagged as such
    const now = new Date();
    const upcoming = state.transactions
      .filter(t => t.recurring && t.type === 'expense')
      .map(t => {
        const last = new Date(t.date);
        const next = new Date(last); next.setMonth(next.getMonth() + 1);
        return { ...t, nextDate: next };
      })
      .filter(t => {
        const diff = (t.nextDate - now) / (1000*60*60*24);
        return diff > -1 && diff <= daysAhead;
      })
      .sort((a,b) => a.nextDate - b.nextDate);
    return upcoming;
  },
};


/* =========================================================================
   7. SMART TIPS — rule-based, plain language, privacy-preserving
   ========================================================================= */
const Tips = {
  generate(state) {
    const tips = [];
    const m = state.currentMonth;
    const inc = Sel.monthIncome(state, m);
    const exp = Sel.monthExpenses(state, m);
    const sav = Sel.monthSavings(state, m);
    const rate = Sel.savingsRate(state, m);

    if (inc === 0 && exp === 0 && state.transactions.length === 0) {
      tips.push({ kind: 'info', icon: 'lightbulb',
        title: 'Start by adding your income',
        body: 'Track your first paycheck or income source. Knowing what comes in is the foundation of any budget.' });
    }
    if (inc > 0 && exp > inc) {
      tips.push({ kind: 'warn', icon: 'warn',
        title: 'You\'re spending more than you earn this month',
        body: 'A common fix: review the largest spending categories and trim one or two. Small changes add up fast.' });
    }
    if (inc > 0 && rate < 0.1 && rate >= 0) {
      tips.push({ kind: 'info', icon: 'lightbulb',
        title: 'Try the 50/30/20 rule',
        body: 'Aim for 50% needs, 30% wants, 20% savings. Even moving 5% of income to savings is a win.' });
    }
    if (rate >= 0.2) {
      tips.push({ kind: 'success', icon: 'sparkle',
        title: `Excellent — you saved ${Utils.formatPct(rate, 0)} of your income`,
        body: 'That\'s above the 20% target. Consider directing a portion to your highest-priority goal.' });
    }
    const flags = Sel.unusualSpendingFlags(state, m);
    if (flags.length) {
      const cat = Sel.catById(state, flags[0].categoryId);
      tips.push({ kind: 'warn', icon: 'flame',
        title: `Unusual spending in ${cat?.name ?? 'a category'}`,
        body: `This month you've spent ${Utils.formatMoney(flags[0].current, state.profile?.currency)}, well above your 3-month average of ${Utils.formatMoney(flags[0].avg, state.profile?.currency)}.` });
    }
    const overBudgets = Sel.budgetForMonth(state, m).filter(b => b.status === 'over');
    if (overBudgets.length) {
      tips.push({ kind: 'warn', icon: 'warn',
        title: `Over budget in ${overBudgets.length} categor${overBudgets.length === 1 ? 'y' : 'ies'}`,
        body: 'Tap "Budget" to see which categories went over and adjust your plan.' });
    }
    if (state.debts.length > 0) {
      const total = state.debts.reduce((s,d) => s+d.balance, 0);
      tips.push({ kind: 'info', icon: 'lightbulb',
        title: 'Stay focused on debt payoff',
        body: `You're tracking ${Utils.formatMoney(total, state.profile?.currency)} in debt. The Goals & Debt tab can simulate snowball and avalanche strategies, so you know exactly when you'll be free.` });
    }
    return tips;
  },
  // Static educational lessons — plain-language curriculum
  // grouped into 5 topics so users can browse by what they want to learn.
  topics: [
    { id: 'foundations', label: 'Foundations',  icon: 'lightbulb', blurb: 'Money basics that everything else is built on.' },
    { id: 'saving',      label: 'Saving',       icon: 'coins',     blurb: 'Build a cushion and pay yourself first.' },
    { id: 'debt',        label: 'Debt',         icon: 'shield',    blurb: 'Borrow smart, pay off fast.' },
    { id: 'investing',   label: 'Investing',    icon: 'trend',     blurb: 'Put your money to work over time.' },
    { id: 'growing',     label: 'Growing wealth', icon: 'sparkle', blurb: 'Long-term habits that build real wealth.' },
  ],
  lessons: [
    /* ------------------ FOUNDATIONS (5) ------------------ */
    { id: 'budget-101', topic: 'foundations', difficulty: 'beginner', minutes: 3,
      title: 'What is a budget — really?',
      body: `A budget is just a plan for your money before you spend it. You decide how much goes to needs (housing, food), wants (fun, hobbies), and the future (savings, debt). When real spending matches your plan, you feel less stressed about money. When it doesn't, your budget tells you exactly where to look. Don't think of a budget as a cage — think of it as permission. Once you've covered the essentials, every dollar left over is yours to enjoy without guilt.` },
    { id: '50-30-20', topic: 'foundations', difficulty: 'beginner', minutes: 3,
      title: 'The 50/30/20 rule',
      body: `A simple guideline: spend 50% of your take-home pay on needs (rent, groceries, utilities), 30% on wants (dining, entertainment), and 20% on the future (savings and debt payments). Adjust the numbers to fit your life — the goal is awareness, not perfection. If 50% can't cover your needs in your city, that's a signal to either grow your income or restructure your fixed costs, not to feel like you're failing.` },
    { id: 'pay-yourself-first', topic: 'foundations', difficulty: 'beginner', minutes: 2,
      title: 'Pay yourself first',
      body: `Most people save what's left over at the end of the month. Trouble is, there usually isn't anything left. "Paying yourself first" flips the order: the moment you get paid, money goes to savings or investments, and you live on the rest. Even 5% of your paycheck, set aside before you see it, beats good intentions you never act on.` },
    { id: 'needs-vs-wants', topic: 'foundations', difficulty: 'beginner', minutes: 2,
      title: 'Needs vs wants — and why it matters',
      body: `A need keeps you safe, fed, healthy, or employed. A want makes life better. The honest test: would skipping it for one month genuinely harm you? Most subscriptions, meals out, and upgrades are wants — and that's totally fine. The trap is calling a want a "need" so you don't feel like you can cut it. Naming things accurately is half the battle.` },
    { id: 'tracking-spending', topic: 'foundations', difficulty: 'beginner', minutes: 3,
      title: 'Why tracking matters more than budgeting',
      body: `A budget without tracking is a wish. Tracking is what turns a plan into reality — and it almost always reveals surprises. Most people overestimate how much they spend on rent and underestimate how much goes to small daily purchases. Just one month of honest tracking usually finds 10–20% you didn't know was leaving. Use the Transactions tab — even a quick log a day is enough.` },

    /* ------------------ SAVING (5) ------------------ */
    { id: 'emergency-fund', topic: 'saving', difficulty: 'beginner', minutes: 3,
      title: 'The emergency fund',
      body: `An emergency fund is a small pot of money set aside for life's surprises — a car repair, a medical bill, a missed paycheck. A common starter goal is one month of essential expenses, with three to six months as the long-term target. Keep it in a separate, easy-to-access savings account so it's not in your face every time you check your spending account. The peace of mind, once you have it, is hard to overstate.` },
    { id: 'savings-rate', topic: 'saving', difficulty: 'beginner', minutes: 2,
      title: 'What is "savings rate"?',
      body: `Your savings rate is the share of your income that you save each month. If you bring home $3,000 and save $300, your rate is 10%. Most experts recommend at least 20%, but anything above zero is progress. Increase it gradually — even 1% more is a win. Over a working life, your savings rate matters more than your investment returns: someone who saves 20% will retire decades earlier than someone who saves 5%, even with the same investments.` },
    { id: 'sinking-funds', topic: 'saving', difficulty: 'intermediate', minutes: 3,
      title: 'Use sinking funds for big expenses',
      body: `A sinking fund is a small monthly amount you set aside for a known future expense — holidays, car insurance, a vacation, an annual tax bill. By splitting a large bill across many months, you avoid the sting of paying it all at once and you don't dip into your emergency fund or rack up debt. Set one up in Goals: target the total amount, the date you'll need it by, and let $martDollar tell you the monthly amount required.` },
    { id: 'high-yield-savings', topic: 'saving', difficulty: 'intermediate', minutes: 2,
      title: 'High-yield savings accounts',
      body: `A regular savings account at a big bank often pays close to nothing. Online high-yield savings accounts (HYSAs) typically pay many times more, with the same FDIC/equivalent protection. The money is liquid — you can withdraw any time. There's no reason to keep your emergency fund earning 0.01% when you could be earning the going rate. Five minutes of paperwork unlocks years of compounding.` },
    { id: 'automate-saving', topic: 'saving', difficulty: 'beginner', minutes: 2,
      title: 'Automate the boring parts',
      body: `Willpower is a finite resource. Automation is forever. Set up an automatic transfer from your checking account to your savings on payday — same day, same amount. After a month or two, you stop noticing the money was ever there. The biggest lever for building wealth isn't picking the right investment, it's removing yourself from the decision to save.` },

    /* ------------------ DEBT (4) ------------------ */
    { id: 'snowball-vs-avalanche', topic: 'debt', difficulty: 'beginner', minutes: 3,
      title: 'Snowball vs avalanche debt payoff',
      body: `Snowball: pay off the smallest balance first, regardless of interest rate. You see quick wins, which keeps motivation high. Avalanche: pay off the highest interest rate first. You save the most money over time. Both work — pick the one you'll actually stick with. The Goals & Debt tab projects both for your specific debts so you can see the difference in months and total interest before deciding.` },
    { id: 'good-vs-bad-debt', topic: 'debt', difficulty: 'beginner', minutes: 3,
      title: 'Good debt, bad debt',
      body: `Not all debt is equal. A low-interest mortgage on a home you'll live in, or a student loan tied to better earning power, can be reasonable. High-interest credit-card debt or "buy now, pay later" on consumer purchases drains future income for nothing. A useful rule of thumb: if the thing you're borrowing for either appreciates or grows your earning power, the debt has a job. If it doesn't, the debt is just stealing from your future self.` },
    { id: 'minimum-payment-trap', topic: 'debt', difficulty: 'intermediate', minutes: 3,
      title: 'The minimum-payment trap',
      body: `Credit-card minimum payments are designed so the lender keeps charging you interest as long as possible. Paying only the minimum on a $5,000 balance at 22% APR can take 20+ years to clear and more than double the original amount in interest. Even one extra $50/month dramatically shortens the timeline. Treat the minimum as the floor, never the goal.` },
    { id: 'apr-vs-apy', topic: 'debt', difficulty: 'intermediate', minutes: 2,
      title: 'APR vs APY — what\'s the difference?',
      body: `APR (annual percentage rate) is the simple yearly interest rate — usually how loan and credit-card rates are quoted. APY (annual percentage yield) accounts for compounding within the year — usually how savings rates are quoted. A 12% APR credit card actually charges about 12.68% APY because interest compounds monthly. When comparing borrowing costs, line APR up against APR; when comparing returns, line APY up against APY.` },

    /* ------------------ INVESTING (6) ------------------ */
    { id: 'compound-interest', topic: 'investing', difficulty: 'beginner', minutes: 3,
      title: 'Compound interest, the eighth wonder',
      body: `Compound interest is interest earning interest. $100 at 8% becomes $108 next year, then 8% of $108 the year after — not 8% of $100. Over 30 years, $100 grows to about $1,006 with no extra deposits. The lesson: time is the most powerful ingredient. Starting at 25 with $200/month easily beats starting at 35 with $400/month. The earlier you begin, even with small amounts, the more the math works in your favor.` },
    { id: 'index-funds', topic: 'investing', difficulty: 'beginner', minutes: 3,
      title: 'Why index funds are a great default',
      body: `An index fund holds a tiny slice of every company in a market index (like the S&P 500). You get instant diversification, ultra-low fees (often under 0.1%/year), and historically returns that beat most actively managed funds. You don't have to pick winners — you own the whole market. For most beginners, a low-cost broad-market index fund is a perfectly reasonable first investment, full stop.` },
    { id: 'dollar-cost-averaging', topic: 'investing', difficulty: 'beginner', minutes: 2,
      title: 'Dollar-cost averaging',
      body: `Dollar-cost averaging means investing the same amount at regular intervals — say $200 every payday — regardless of price. When prices are low, you buy more shares; when high, fewer. You stop trying to time the market (which almost no one does well) and turn investing into a boring, automatic habit. Boring is exactly what you want.` },
    { id: 'risk-vs-reward', topic: 'investing', difficulty: 'intermediate', minutes: 3,
      title: 'Risk and reward go together',
      body: `Higher long-term returns come with bigger short-term ups and downs. Stocks have historically returned about 7% per year after inflation — but in a bad year they can drop 30%+. Bonds are steadier but earn less. The right mix depends on your timeline: money you need next year shouldn't be in stocks; money you don't need for 20 years probably should be. Anyone offering high returns with no risk is selling something.` },
    { id: 'retirement-accounts', topic: 'investing', difficulty: 'intermediate', minutes: 3,
      title: 'Retirement accounts (and the free money inside them)',
      body: `Retirement accounts (401(k), IRA, ISA, RRSP, depending on your country) offer tax advantages — your money grows without being taxed each year, which compounds enormously over decades. Many employers also match contributions up to a percentage of your salary. That match is literally free money — never leave it on the table. Open the account, contribute at least enough to capture the full match, and turn on auto-investing. You're done.` },
    { id: 'fees-matter', topic: 'investing', difficulty: 'intermediate', minutes: 3,
      title: 'Fees quietly eat your returns',
      body: `A 1% annual fee sounds small. Over 30 years on a $100,000 portfolio, it can cost you over $200,000 in lost growth. Always check the expense ratio of any fund you buy — under 0.20% is great, under 0.10% is excellent. Skip products with "loads," surrender charges, or high advisor fees unless you understand exactly what you're paying for. The lower the fee, the more of your money keeps working for you.` },

    /* ------------------ GROWING WEALTH (5) ------------------ */
    { id: 'lifestyle-inflation', topic: 'growing', difficulty: 'intermediate', minutes: 3,
      title: 'Beware lifestyle inflation',
      body: `Lifestyle inflation is when your spending creeps up every time your income does. Get a raise, upgrade the car. Bigger paycheck, nicer apartment. Soon you're earning much more but saving the same. The fix: every time your income rises, automatically route a chunk of the increase straight to savings or investments before it touches your spending account. Future-you gets a raise too.` },
    { id: 'increase-income', topic: 'growing', difficulty: 'intermediate', minutes: 3,
      title: 'You can only cut so much — grow your income',
      body: `Cutting expenses has a floor: you have to eat, sleep somewhere, and pay your bills. Earning more has no ceiling. Negotiate at performance reviews, switch jobs every few years (job-switchers consistently out-earn job-stayers), build a marketable skill, or start a small side income. A 10% raise once is worth more than skipping coffee for a decade — and it compounds, because future raises are usually a percentage of your current salary.` },
    { id: 'tax-basics', topic: 'growing', difficulty: 'intermediate', minutes: 3,
      title: 'Taxes — the basics that move the needle',
      body: `Taxes are usually one of the largest line items in your life. You don't need to be an accountant, but a few basics matter: marginal vs effective rates (you don't pay your top rate on every dollar), pre-tax retirement contributions reduce your taxable income today, and tax-advantaged accounts let investments grow without yearly drag. Once a year, spend an evening understanding your country's main tax-advantaged accounts. The lifetime payoff is enormous.` },
    { id: 'insurance-basics', topic: 'growing', difficulty: 'intermediate', minutes: 3,
      title: 'Insurance — for when things actually go wrong',
      body: `The right way to think about insurance: pay a small predictable amount to avoid a financial disaster. Health, disability, and renters/home insurance are usually worth their weight in gold. Extended warranties on consumer electronics usually aren't. The test is "could I absorb this loss out of pocket?" — if yes, self-insure; if no, buy coverage. Don't insure small risks; do insure catastrophic ones.` },
    { id: 'net-worth', topic: 'growing', difficulty: 'intermediate', minutes: 2,
      title: 'Track your net worth, not just your income',
      body: `Your net worth is everything you own (cash, investments, home, etc.) minus everything you owe (loans, credit cards, mortgages). It's the single best long-term measure of financial progress. High income doesn't equal wealth — many high earners have a near-zero net worth because their spending matches their income. Calculate yours quarterly. The number going up over years means the system is working, even when individual months feel chaotic.` },
  ],
  glossary: [
    ['Net income',      'Money you actually take home, after taxes and deductions.'],
    ['Net worth',       'What you own minus what you owe — your big-picture wealth number.'],
    ['Cash flow',       'Money in minus money out for a period of time.'],
    ['APR',             'Annual percentage rate — the yearly cost of borrowing money.'],
    ['APY',             'Annual percentage yield — the actual yearly return after compounding.'],
    ['Compound interest','Interest earning interest — money growing on top of money already grown.'],
    ['Principal',       'The original amount of a loan, before interest.'],
    ['Index fund',      'A low-fee fund that tracks a whole market index — diversification in one purchase.'],
    ['Diversification', 'Owning a mix of investments so no single bad one sinks you.'],
    ['Expense ratio',   'The yearly fee a fund charges, expressed as a percentage of your investment.'],
    ['Liquidity',       'How quickly you can turn an asset into cash without losing value.'],
    ['Discretionary',   'Spending you choose, like dining or entertainment — easier to cut.'],
    ['Fixed expense',   'A bill that\'s the same each month, like rent.'],
    ['Variable expense','A bill that changes each month, like groceries or fuel.'],
    ['Sinking fund',    'Small monthly savings set aside for a known future expense.'],
    ['HYSA',            'High-yield savings account — pays meaningfully more than a typical big-bank savings account.'],
  ],
};


/* =========================================================================
   8. TOAST + MODAL components
   ========================================================================= */
function toast(message, kind = '') {
  const el = h('div', { class: ['toast', kind].filter(Boolean).join(' '), role: 'status' }, message);
  document.getElementById('toast-root').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
    el.style.transition = 'opacity 200ms, transform 200ms'; }, 2400);
  setTimeout(() => el.remove(), 2700);
}

function openModal({ title, content, footer, onClose }) {
  const root = document.getElementById('modal-root');
  clearNode(root);

  const close = () => { clearNode(root); document.body.style.overflow = ''; if (onClose) onClose(); };
  document.body.style.overflow = 'hidden';

  const scrim = h('div', { class: 'scrim', role: 'dialog', 'aria-modal': 'true',
                           onClick: (e) => { if (e.target === scrim) close(); } },
    h('div', { class: 'modal' },
      h('div', { class: 'modal-header' },
        h('h2', null, title),
        h('button', { class: 'btn btn-icon btn-ghost', 'aria-label': 'Close', onClick: close, html: Icon.x() })),
      h('div', { class: 'modal-body' }, content),
      footer ? h('div', { class: 'row-between', style: { marginTop: '20px' } }, ...footer) : null,
    )
  );
  // ESC to close
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey, { once: true });
  root.appendChild(scrim);

  // Focus first input or button
  setTimeout(() => {
    const first = scrim.querySelector('input,select,textarea,button:not([aria-label="Close"])');
    if (first) first.focus();
  }, 50);

  return close;
}

function confirmModal({ title, body, confirmLabel = 'Confirm', danger = false, onConfirm }) {
  let close;
  close = openModal({
    title,
    content: h('p', { class: 'text-muted', style: { marginBottom: 0 } }, body),
    footer: [
      h('button', { class: 'btn btn-secondary', onClick: () => close() }, 'Cancel'),
      h('button', {
        class: danger ? 'btn btn-danger' : 'btn btn-primary',
        onClick: async () => { await onConfirm(); close(); }
      }, confirmLabel),
    ],
  });
}


/* =========================================================================
   9. ROUTER — hash-based
   ========================================================================= */
const Router = (() => {
  const ROUTES = ['/dashboard', '/transactions', '/budget', '/goals', '/learn', '/settings'];
  function go(path) {
    location.hash = path;
  }
  function init() {
    const handler = () => {
      let r = location.hash.slice(1) || '/dashboard';
      if (!ROUTES.includes(r)) r = '/dashboard';
      State.setRoute(r);
    };
    window.addEventListener('hashchange', handler);
    handler();
  }
  return { go, init, ROUTES };
})();


/* =========================================================================
   10. UI COMPONENTS
   ========================================================================= */
function StatCard({ label, value, hint, icon, delta, deltaPositive, accent = 'primary' }) {
  return h('div', { class: 'card stat' },
    h('div', { class: 'row-between' },
      h('div', { class: 'stat-label' },
        icon ? h('span', { html: Icon[icon]({ size: 16 }) }) : null,
        label),
      h('div', { class: 'stat-icon', html: Icon[icon || 'wallet']({ size: 20 }) }),
    ),
    h('div', { class: 'stat-value' }, value),
    hint ? h('div', { class: 'text-sm text-subtle' }, hint) : null,
    delta != null ? h('div', { class: ['stat-delta', deltaPositive ? 'positive' : 'negative'].join(' ') },
      h('span', { html: deltaPositive ? Icon.arrowUp({ size: 14 }) : Icon.arrowDown({ size: 14 }) }),
      delta) : null,
  );
}

function TipCard(tip) {
  const cls = tip.kind === 'success' ? 'tip success' : tip.kind === 'warn' ? 'tip warn' : 'tip';
  return h('div', { class: cls },
    h('div', { class: 'tip-icon', html: Icon[tip.icon || 'info']({ size: 22 }) }),
    h('div', { class: 'tip-body' },
      h('strong', null, tip.title),
      tip.body));
}

function CategoryChip(cat) {
  if (!cat) return h('span', { class: 'cat-chip' }, '—');
  return h('span', { class: 'cat-chip' },
    h('span', { 'aria-hidden': 'true' }, cat.icon || ''),
    h('span', null, cat.name));
}

function MonthSelector(currentMonth, onChange) {
  const prev = Utils.addMonths(currentMonth, -1);
  const next = Utils.addMonths(currentMonth, 1);
  return h('div', { class: 'row', style: { gap: '4px' } },
    h('button', { class: 'btn btn-icon btn-secondary', 'aria-label': 'Previous month',
                  onClick: () => onChange(prev), html: Icon.chevL() }),
    h('div', { class: 'month-pill', 'aria-live': 'polite' }, Utils.monthLabel(currentMonth)),
    h('button', { class: 'btn btn-icon btn-secondary', 'aria-label': 'Next month',
                  onClick: () => onChange(next), html: Icon.chevR() }),
  );
}


/* =========================================================================
   11. ONBOARDING
   ========================================================================= */
const Onboarding = {
  step: 0,
  data: { displayName: '', currency: 'USD', payFrequency: 'monthly', beginnerMode: true, primaryGoal: 'save' },

  render(root) {
    clearNode(root);
    const steps = [this.welcome, this.identity, this.currency, this.frequency, this.goal, this.finish];
    const total = steps.length;
    const node = h('div', { class: 'onboarding' },
      h('div', { class: 'onboarding-card' },
        h('div', { class: 'onboarding-progress', 'aria-label': `Step ${this.step + 1} of ${total}` },
          ...steps.map((_, i) => h('span', { class: i <= this.step ? 'active' : '' }))),
        steps[this.step].call(this, root),
      ));
    root.appendChild(node);
    // Focus first interactive element
    setTimeout(() => {
      const f = node.querySelector('input, button.pill-choice, .btn-primary');
      if (f) f.focus();
    }, 60);
  },

  next(root) { this.step++; this.render(root); },
  back(root) { if (this.step > 0) this.step--; this.render(root); },

  welcome(root) {
    return h('div', { class: 'stack-lg' },
      h('div', { style: { fontSize: '40px' } }, '👋'),
      h('h1', null, 'Welcome to $martDollar'),
      h('p', { class: 'text-muted' }, 'A friendly, private place to understand your money. We\'ll set you up in about 60 seconds.'),
      h('div', { class: 'tip', style: { marginTop: '12px' } },
        h('div', { class: 'tip-icon', html: Icon.shield({ size: 22 }) }),
        h('div', { class: 'tip-body' },
          h('strong', null, 'Your data stays with you'),
          'Everything you enter is stored on this device only. No accounts, no servers, no tracking.')),
      h('div', { class: 'row-between', style: { marginTop: '16px' } },
        h('span'),
        h('button', { class: 'btn btn-primary', onClick: () => Onboarding.next(root) },
          'Get started ', h('span', { html: Icon.chevR({ size: 16 }) })),
      ),
    );
  },

  identity(root) {
    const onSubmit = (e) => {
      e.preventDefault();
      const name = e.target.elements.name.value.trim();
      Onboarding.data.displayName = name || 'Friend';
      Onboarding.next(root);
    };
    return h('form', { class: 'stack-lg', onSubmit },
      h('h1', null, 'What should we call you?'),
      h('p', { class: 'text-muted' }, 'Just a friendly name for the dashboard.'),
      h('div', { class: 'field' },
        h('label', { for: 'name' }, 'Name'),
        h('input', { class: 'input', id: 'name', name: 'name', type: 'text',
                     placeholder: 'e.g. Alex', maxLength: 40, autoComplete: 'given-name' }),
        h('div', { class: 'hint' }, 'Optional — leave blank if you prefer.'),
      ),
      h('div', { class: 'row-between' },
        h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => Onboarding.back(root) }, 'Back'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Continue'),
      )
    );
  },

  currency(root) {
    return h('div', { class: 'stack-lg' },
      h('h1', null, 'Pick your currency'),
      h('p', { class: 'text-muted' }, 'Used to display amounts. You can change this later.'),
      h('div', { class: 'field' },
        h('label', { for: 'cur' }, 'Currency'),
        h('select', { class: 'select', id: 'cur', value: Onboarding.data.currency,
                      onChange: (e) => Onboarding.data.currency = e.target.value },
          ...Utils.CURRENCIES.map(c =>
            h('option', { value: c.code, selected: c.code === Onboarding.data.currency },
              `${c.symbol}  ${c.code} — ${c.name}`)))
      ),
      h('div', { class: 'row-between' },
        h('button', { class: 'btn btn-ghost', onClick: () => Onboarding.back(root) }, 'Back'),
        h('button', { class: 'btn btn-primary', onClick: () => Onboarding.next(root) }, 'Continue'),
      )
    );
  },

  frequency(root) {
    const opts = Object.entries(Utils.PAY_FREQUENCIES);
    return h('div', { class: 'stack-lg' },
      h('h1', null, 'How often are you paid?'),
      h('p', { class: 'text-muted' }, 'This helps us plan your monthly budget more accurately.'),
      h('div', { class: 'stack' },
        ...opts.map(([key, info]) =>
          h('button', {
            type: 'button', class: 'pill-choice',
            'aria-pressed': Onboarding.data.payFrequency === key ? 'true' : 'false',
            onClick: () => { Onboarding.data.payFrequency = key; Onboarding.render(root); }
          },
            h('strong', null, info.label),
            h('span', null, key === 'monthly' ? 'Once a month'
              : key === 'biweekly' ? 'Every other week'
              : key === 'weekly' ? '52 paychecks a year'
              : 'On the 1st and 15th'))),
      ),
      h('div', { class: 'row-between' },
        h('button', { class: 'btn btn-ghost', onClick: () => Onboarding.back(root) }, 'Back'),
        h('button', { class: 'btn btn-primary', onClick: () => Onboarding.next(root) }, 'Continue'),
      )
    );
  },

  goal(root) {
    const goals = [
      { key: 'save', title: 'Build a savings cushion', sub: 'Set money aside for emergencies and goals' },
      { key: 'debt', title: 'Pay off debt', sub: 'Plan and track payoff with a clear strategy' },
      { key: 'spend', title: 'Understand my spending', sub: 'See where my money actually goes each month' },
      { key: 'all',  title: 'A bit of everything',     sub: 'Let me set this up later' },
    ];
    return h('div', { class: 'stack-lg' },
      h('h1', null, `What's most important right now?`),
      h('p', { class: 'text-muted' }, 'We\'ll tailor your dashboard to what you care about most.'),
      h('div', { class: 'stack' },
        ...goals.map(g =>
          h('button', {
            type: 'button', class: 'pill-choice',
            'aria-pressed': Onboarding.data.primaryGoal === g.key ? 'true' : 'false',
            onClick: () => { Onboarding.data.primaryGoal = g.key; Onboarding.render(root); }
          },
            h('strong', null, g.title),
            h('span', null, g.sub))),
      ),
      h('div', { class: 'row-between' },
        h('button', { class: 'btn btn-ghost', onClick: () => Onboarding.back(root) }, 'Back'),
        h('button', { class: 'btn btn-primary', onClick: () => Onboarding.next(root) }, 'Continue'),
      )
    );
  },

  finish(root) {
    return h('div', { class: 'stack-lg' },
      h('div', { style: { fontSize: '40px' } }, '🎉'),
      h('h1', null, `You're all set${Onboarding.data.displayName ? ', ' + Onboarding.data.displayName : ''}!`),
      h('p', { class: 'text-muted' }, 'Next: add an income or expense and watch your dashboard come to life.'),
      h('div', { class: 'tip success', style: { marginTop: '12px' } },
        h('div', { class: 'tip-icon', html: Icon.lightbulb({ size: 22 }) }),
        h('div', { class: 'tip-body' },
          h('strong', null, 'Tip: little and often beats long sessions'),
          'Logging one or two transactions a day takes 10 seconds and builds a complete picture of your money over time.')),
      h('div', { class: 'row-between' },
        h('button', { class: 'btn btn-ghost', onClick: () => Onboarding.back(root) }, 'Back'),
        h('button', { class: 'btn btn-primary', onClick: async () => {
          await Repo.setProfile({
            displayName: Onboarding.data.displayName,
            currency: Onboarding.data.currency,
            payFrequency: Onboarding.data.payFrequency,
            beginnerMode: Onboarding.data.beginnerMode,
            primaryGoal: Onboarding.data.primaryGoal,
          });
          await State.loadAll();
          Router.go('/dashboard');
          toast(`Welcome${Onboarding.data.displayName ? ', ' + Onboarding.data.displayName : ''}! 🌱`, 'success');
        } }, 'Open my dashboard'),
      )
    );
  }
};


/* =========================================================================
   12. APP SHELL — sidebar + topbar layout
   ========================================================================= */
function AppShell(state, page) {
  const navItem = (path, label, shortLabel, iconKey) =>
    h('button', {
      class: ['nav-item', state.route === path ? 'active' : ''].filter(Boolean).join(' '),
      onClick: () => Router.go(path),
      'aria-current': state.route === path ? 'page' : null,
      title: label,
    },
      h('span', { class: 'nav-icon', html: Icon[iconKey]({ size: 20 }) }),
      h('span', { class: 'nav-label-full' }, label),
      h('span', { class: 'nav-label-short' }, shortLabel || label));

  const titles = {
    '/dashboard': 'Dashboard',
    '/transactions': 'Transactions',
    '/budget': 'Budget',
    '/goals': 'Goals & Debt',
    '/learn': 'Learn',
    '/settings': 'Settings',
  };

  return h('div', { class: 'app' },
    h('aside', { class: 'sidebar', 'aria-label': 'Primary navigation' },
      h('div', { class: 'brand' },
        h('div', { class: 'brand-mark', html: BrandMarkSVG(28) }),
        h('span', { class: 'name' }, BRAND_NAME)),
      h('nav', { class: 'nav', 'aria-label': 'Sections' },
        h('div', { class: 'nav-section-label' }, 'Money'),
        navItem('/dashboard',    'Dashboard',    'Home',     'home'),
        navItem('/transactions', 'Transactions', 'Activity', 'list'),
        navItem('/budget',       'Budget',       'Budget',   'pie'),
        navItem('/goals',        'Goals & Debt', 'Goals',    'target'),
        h('div', { class: 'nav-section-label' }, 'Grow'),
        navItem('/learn',        'Learn',        'Learn',    'book'),
        navItem('/settings',     'Settings',     'Settings', 'settings'),
      ),
    ),
    h('header', { class: 'topbar' },
      h('h1', null, titles[state.route] || BRAND_NAME),
      h('div', { class: 'topbar-actions' },
        ['/dashboard','/transactions','/budget'].includes(state.route)
          ? MonthSelector(state.currentMonth, (m) => State.setMonth(m))
          : null,
        h('button', {
          class: 'btn btn-primary', onClick: () => Pages.transactions.openTransactionForm(),
        }, h('span', { html: Icon.plus({ size: 16 }) }), 'Add'),
      ),
    ),
    h('main', { id: 'main', class: 'main', tabIndex: -1 },
      QuoteBanner(),
      page,
    ),
  );
}

// Inline motivational banner — rotates on each app entry / refresh.
function QuoteBanner() {
  return h('div', { class: 'quote-banner', role: 'status', 'aria-label': 'Motivation' },
    h('span', { class: 'quote-mark', 'aria-hidden': 'true' }, '\u201C'),
    h('p', { class: 'quote-text' }, TODAY_QUOTE),
  );
}


/* =========================================================================
   13. PAGES
   ========================================================================= */
const Pages = {};


/* ---------- DASHBOARD ---------- */
Pages.dashboard = {
  charts: { donut: null, trend: null },
  destroy() {
    Object.values(this.charts).forEach(c => c && c.destroy());
    this.charts = { donut: null, trend: null };
  },
  render(state) {
    this.destroy();
    const cur = state.profile?.currency || 'USD';
    const m = state.currentMonth;
    const inc = Sel.monthIncome(state, m);
    const exp = Sel.monthExpenses(state, m);
    const sav = Sel.monthSavings(state, m);
    const cf  = inc - exp - sav;
    const rate = Sel.savingsRate(state, m);
    const prevInc = Sel.monthIncome(state, Utils.addMonths(m, -1));
    const prevExp = Sel.monthExpenses(state, Utils.addMonths(m, -1));
    const incDelta = prevInc ? (inc - prevInc) / prevInc : 0;
    const expDelta = prevExp ? (exp - prevExp) / prevExp : 0;

    const tips = Tips.generate(state);
    const greeting = (() => {
      const hr = new Date().getHours();
      const part = hr < 5 ? 'Good evening' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
      return state.profile?.displayName ? `${part}, ${state.profile.displayName}` : part;
    })();

    const spendingMap = Sel.spendingByCategory(state, m);
    const catEntries = Object.entries(spendingMap)
      .map(([cid, amt]) => ({ cat: Sel.catById(state, cid), amt }))
      .filter(x => x.cat)
      .sort((a,b) => b.amt - a.amt);
    const trend = Sel.trendLast(state, 6);

    const node = h('div', { class: 'stack-lg' },
      // Greeting
      h('div', { class: 'row-between' },
        h('div', null,
          h('h2', { style: { fontSize: '22px', marginBottom: 4 } }, greeting),
          h('p', { class: 'text-muted' }, `Here's how you're doing in ${Utils.monthLabel(m)}.`)),
      ),

      // Stat cards
      h('div', { class: 'grid grid-cols-4' },
        StatCard({ label: 'Income',   value: Utils.formatMoney(inc, cur), icon: 'arrowDown',
                   delta: prevInc ? `${(incDelta * 100).toFixed(0)}% vs last month` : 'No prior data',
                   deltaPositive: incDelta >= 0 }),
        StatCard({ label: 'Expenses', value: Utils.formatMoney(exp, cur), icon: 'arrowUp',
                   delta: prevExp ? `${(expDelta * 100).toFixed(0)}% vs last month` : 'No prior data',
                   deltaPositive: expDelta < 0 }),
        StatCard({ label: 'Savings',  value: Utils.formatMoney(sav, cur), icon: 'coins',
                   hint: `${Utils.formatPct(rate, 0)} savings rate` }),
        StatCard({ label: cf >= 0 ? 'Left over' : 'Shortfall',
                   value: Utils.formatMoney(Math.abs(cf), cur), icon: 'wallet',
                   hint: cf >= 0 ? 'Cash flow this month' : 'Spending exceeds income' }),
      ),

      // Tips row
      tips.length ? h('div', { class: 'stack' }, ...tips.slice(0, 2).map(TipCard)) : null,

      // Charts
      h('div', { class: 'grid grid-cols-2' },
        h('div', { class: 'card' },
          h('div', { class: 'row-between', style: { marginBottom: '12px' } },
            h('h2', null, 'Spending by category'),
            h('span', { class: 'badge badge-neutral' }, `${catEntries.length} ${catEntries.length === 1 ? 'category' : 'categories'}`)),
          catEntries.length === 0
            ? h('div', { class: 'empty' },
                h('div', { class: 'empty-icon', html: Icon.pie({ size: 24 }) }),
                h('p', null, 'No expenses yet this month.'),
                h('p', { class: 'text-sm text-subtle' }, 'Add your first expense to see this chart.'))
            : h('div', { class: 'chart-box' }, h('canvas', { id: 'chart-donut', 'aria-label': 'Spending by category donut chart' })),
          // Accessible table fallback
          catEntries.length > 0 ? h('details', { style: { marginTop: '12px' } },
            h('summary', { class: 'text-sm text-muted' }, 'View as table'),
            h('table', { class: 'tx', style: { marginTop: '8px' } },
              h('thead', null, h('tr', null, h('th', null, 'Category'), h('th', { style: { textAlign: 'right' } }, 'Spent'))),
              h('tbody', null, ...catEntries.map(e =>
                h('tr', null,
                  h('td', null, CategoryChip(e.cat)),
                  h('td', { class: 'num expense' }, Utils.formatMoney(e.amt, cur))))))) : null,
        ),
        h('div', { class: 'card' },
          h('div', { class: 'row-between', style: { marginBottom: '12px' } },
            h('h2', null, 'Last 6 months'),
            h('span', { class: 'badge badge-neutral' }, 'Income vs Expenses')),
          h('div', { class: 'chart-box' }, h('canvas', { id: 'chart-trend', 'aria-label': 'Income vs expenses trend chart for the last six months' })),
          h('details', { style: { marginTop: '12px' } },
            h('summary', { class: 'text-sm text-muted' }, 'View as table'),
            h('table', { class: 'tx', style: { marginTop: '8px' } },
              h('thead', null, h('tr', null, h('th', null, 'Month'),
                h('th', { style: { textAlign: 'right' } }, 'Income'),
                h('th', { style: { textAlign: 'right' } }, 'Expenses'))),
              h('tbody', null, ...trend.map(t =>
                h('tr', null,
                  h('td', null, t.label),
                  h('td', { class: 'num income' }, Utils.formatMoney(t.income, cur)),
                  h('td', { class: 'num expense' }, Utils.formatMoney(t.expenses, cur))))))),
        ),
      ),

      // Recent transactions + Goals snapshot
      h('div', { class: 'grid grid-cols-2' },
        h('div', { class: 'card' },
          h('div', { class: 'row-between', style: { marginBottom: '12px' } },
            h('h2', null, 'Recent activity'),
            h('button', { class: 'btn btn-ghost text-sm', onClick: () => Router.go('/transactions') }, 'View all')),
          (() => {
            const recent = state.transactions.slice(0, 5);
            if (recent.length === 0) return h('div', { class: 'empty' },
              h('div', { class: 'empty-icon', html: Icon.list({ size: 24 }) }),
              h('p', null, 'No transactions yet.'),
              h('button', { class: 'btn btn-primary', style: { marginTop: '12px' },
                onClick: () => Pages.transactions.openTransactionForm() }, 'Add first transaction'));
            return h('div', { class: 'table-wrap' }, h('table', { class: 'tx' },
              h('tbody', null, ...recent.map(t => {
                const cat = Sel.catById(state, t.categoryId);
                return h('tr', null,
                  h('td', null,
                    h('div', { style: { fontWeight: 600 } }, t.merchant || cat?.name || '—'),
                    h('div', { class: 'text-xs text-subtle' }, Utils.formatDate(t.date))),
                  h('td', null, CategoryChip(cat)),
                  h('td', { class: ['num', t.type].join(' ') },
                    `${t.type === 'income' ? '+' : t.type === 'savings' ? '→' : '−'} ${Utils.formatMoney(t.amount, cur)}`),
                );
              }))));
          })(),
        ),
        h('div', { class: 'card' },
          h('div', { class: 'row-between', style: { marginBottom: '12px' } },
            h('h2', null, 'Goals'),
            h('button', { class: 'btn btn-ghost text-sm', onClick: () => Router.go('/goals') }, 'Manage')),
          (() => {
            const active = state.goals.filter(g => g.status === 'active').slice(0, 3);
            if (active.length === 0) return h('div', { class: 'empty' },
              h('div', { class: 'empty-icon', html: Icon.target({ size: 24 }) }),
              h('p', null, 'No goals yet.'),
              h('button', { class: 'btn btn-primary', style: { marginTop: '12px' },
                onClick: () => Router.go('/goals') }, 'Set a goal'));
            return h('div', { class: 'stack' }, ...active.map(g => {
              const pct = Math.min(1, g.currentAmount / (g.targetAmount || 1));
              return h('div', null,
                h('div', { class: 'row-between', style: { marginBottom: '4px' } },
                  h('strong', { class: 'text-sm' }, g.name),
                  h('span', { class: 'text-sm text-muted' },
                    `${Utils.formatMoney(g.currentAmount, cur)} / ${Utils.formatMoney(g.targetAmount, cur)}`)),
                h('div', { class: 'progress' }, h('div', { class: 'progress-bar', style: { width: `${pct * 100}%` } })));
            }));
          })(),
        ),
      ),
    );

    // Render charts after node is in DOM
    requestAnimationFrame(() => {
      if (catEntries.length > 0) {
        const ctx = document.getElementById('chart-donut');
        if (ctx) {
          this.charts.donut = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: catEntries.map(e => e.cat.name),
              datasets: [{
                data: catEntries.map(e => e.amt),
                backgroundColor: catEntries.map(e => e.cat.color || '#0d9488'),
                borderWidth: 2, borderColor: getComputedStyle(document.body).getPropertyValue('--c-surface').trim() || '#fff',
              }],
            },
            options: {
              responsive: true, maintainAspectRatio: false, cutout: '64%',
              plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 10 } } },
            },
          });
        }
      }
      const tctx = document.getElementById('chart-trend');
      if (tctx) {
        this.charts.trend = new Chart(tctx, {
          type: 'line',
          data: {
            labels: trend.map(t => t.label),
            datasets: [
              { label: 'Income',   data: trend.map(t => t.income),   borderColor: '#0d9488', backgroundColor: 'rgba(13,148,136,0.15)', fill: true, tension: 0.3, borderWidth: 2 },
              { label: 'Expenses', data: trend.map(t => t.expenses), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.10)',  fill: true, tension: 0.3, borderWidth: 2 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, ticks: { callback: (v) => Utils.formatNumber(v) } } },
          },
        });
      }
    });

    return node;
  },
};


/* ---------- TRANSACTIONS ---------- */
Pages.transactions = {
  filter: { type: '', categoryId: '', search: '' },

  openTransactionForm(existing) {
    const state = State.get();
    const isEdit = !!existing;
    let close;
    const cur = state.profile?.currency || 'USD';

    const form = h('form', { class: 'stack', onSubmit: async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      const payload = {
        type: data.get('type'),
        amount: parseFloat(data.get('amount')),
        date: data.get('date'),
        categoryId: data.get('categoryId'),
        merchant: data.get('merchant')?.trim() || '',
        notes: data.get('notes')?.trim() || '',
        recurring: data.get('recurring') === 'on',
      };
      if (!payload.type || !payload.amount || payload.amount <= 0 || !payload.date || !payload.categoryId) {
        toast('Please complete all required fields.', 'danger');
        return;
      }
      if (isEdit) {
        await Repo.updateTransaction(existing.id, payload);
        toast('Transaction updated', 'success');
      } else {
        await Repo.addTransaction(payload);
        toast('Transaction added', 'success');
      }
      await State.loadAll();
      close();
    } },
      h('div', { class: 'field' },
        h('label', null, 'Type'),
        h('div', { class: 'toggle-group' }, ...['expense','income','savings'].map(t =>
          h('label', { class: 'toggle-cell' },
            h('input', { type: 'radio', name: 'type', value: t,
                         class: 'sr-only',
                         defaultChecked: (existing?.type || 'expense') === t,
                         onChange: (e) => {
                           const opts = e.target.form.elements.categoryId.options;
                           // refresh categories shown
                           Pages.transactions._refreshCategoryOptions(e.target.form, t);
                         }
                       }),
            h('button', { type: 'button',
              'aria-pressed': (existing?.type || 'expense') === t ? 'true' : 'false',
              onClick: (e) => {
                const f = e.target.closest('form');
                f.querySelector(`input[name=type][value=${t}]`).checked = true;
                f.querySelectorAll('.toggle-group [aria-pressed]').forEach(b => b.setAttribute('aria-pressed','false'));
                e.target.setAttribute('aria-pressed','true');
                Pages.transactions._refreshCategoryOptions(f, t);
              } },
              t === 'expense' ? 'Expense' : t === 'income' ? 'Income' : 'Savings')))),
      ),
      h('div', { class: 'field-row' },
        h('div', { class: 'field' },
          h('label', { for: 'tx-amount' }, `Amount (${cur})`),
          h('input', { class: 'input', type: 'number', id: 'tx-amount', name: 'amount',
                       step: '0.01', min: '0.01', required: true,
                       defaultValue: existing?.amount ?? '', placeholder: '0.00', inputmode: 'decimal' }),
        ),
        h('div', { class: 'field' },
          h('label', { for: 'tx-date' }, 'Date'),
          h('input', { class: 'input', type: 'date', id: 'tx-date', name: 'date',
                       required: true, defaultValue: existing?.date || Utils.todayISO() }),
        ),
      ),
      h('div', { class: 'field' },
        h('label', { for: 'tx-cat' }, 'Category'),
        h('select', { class: 'select', id: 'tx-cat', name: 'categoryId', required: true },
          ...state.categories
            .filter(c => c.type === (existing?.type || 'expense'))
            .map(c => h('option', { value: c.id, selected: existing?.categoryId === c.id }, `${c.icon} ${c.name}`))),
      ),
      h('div', { class: 'field' },
        h('label', { for: 'tx-merchant' }, 'Where? '),
        h('input', { class: 'input', type: 'text', id: 'tx-merchant', name: 'merchant',
                     placeholder: 'e.g. Whole Foods', maxLength: 80, defaultValue: existing?.merchant || '' }),
      ),
      h('div', { class: 'field' },
        h('label', { for: 'tx-notes' }, 'Notes'),
        h('textarea', { class: 'textarea', id: 'tx-notes', name: 'notes',
                        rows: 2, placeholder: 'Optional', maxLength: 200 }, existing?.notes || ''),
      ),
      h('div', { class: 'field' },
        h('label', { class: 'row', style: { gap: '8px' } },
          h('input', { type: 'checkbox', name: 'recurring', defaultChecked: existing?.recurring === true }),
          h('span', null, 'This is a recurring transaction (e.g. monthly bill)')),
      ),
      h('div', { class: 'row-between', style: { marginTop: '12px' } },
        isEdit ?
          h('button', { type: 'button', class: 'btn btn-ghost', style: { color: 'var(--c-danger)' },
            onClick: () => confirmModal({ title: 'Delete transaction?', body: 'This cannot be undone.',
              confirmLabel: 'Delete', danger: true,
              onConfirm: async () => { await Repo.deleteTransaction(existing.id); await State.loadAll();
                toast('Transaction deleted', 'success'); close(); } }) }, 'Delete')
          : h('span'),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => close() }, 'Cancel'),
          h('button', { type: 'submit', class: 'btn btn-primary' }, isEdit ? 'Save' : 'Add transaction')),
      )
    );

    close = openModal({
      title: isEdit ? 'Edit transaction' : 'Add transaction',
      content: form,
    });
  },

  _refreshCategoryOptions(form, type) {
    const sel = form.elements.categoryId;
    const cats = State.get().categories.filter(c => c.type === type);
    clearNode(sel);
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = `${c.icon} ${c.name}`;
      sel.appendChild(opt);
    });
  },

  exportCSV(state) {
    const rows = [['Date','Type','Category','Amount','Currency','Merchant','Notes','Recurring']];
    const cur = state.profile?.currency || 'USD';
    for (const t of state.transactions) {
      const cat = Sel.catById(state, t.categoryId);
      rows.push([
        t.date, t.type, cat ? cat.name : '',
        t.amount.toFixed(2), cur,
        (t.merchant || '').replace(/"/g, '""'),
        (t.notes || '').replace(/"/g, '""'),
        t.recurring ? 'yes' : 'no',
      ]);
    }
    const csv = rows.map(r => r.map(v => /[",\n]/.test(v) ? `"${v}"` : v).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `smartdollar-transactions-${Utils.todayISO()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('CSV exported', 'success');
  },

  render(state) {
    const cur = state.profile?.currency || 'USD';
    const f = this.filter;
    let txs = state.transactions;
    if (f.type) txs = txs.filter(t => t.type === f.type);
    if (f.categoryId) txs = txs.filter(t => t.categoryId === f.categoryId);
    if (f.search) {
      const s = f.search.toLowerCase();
      txs = txs.filter(t =>
        (t.merchant || '').toLowerCase().includes(s) ||
        (t.notes || '').toLowerCase().includes(s));
    }

    const incomeTotal = txs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
    const expenseTotal = txs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);

    return h('div', { class: 'stack-lg' },
      // Filters bar
      h('div', { class: 'card' },
        h('div', { class: 'row', style: { gap: '12px' } },
          h('div', { class: 'field', style: { flex: 1, minWidth: '180px' } },
            h('label', { for: 'tx-search', class: 'sr-only' }, 'Search'),
            h('input', { class: 'input', type: 'search', id: 'tx-search',
                         placeholder: 'Search merchant or notes…', defaultValue: f.search,
                         onInput: Utils.debounce((e) => { f.search = e.target.value; State.notify(); }, 200) })),
          h('div', { class: 'field' },
            h('label', { for: 'tx-fil-type', class: 'sr-only' }, 'Type'),
            h('select', { class: 'select', id: 'tx-fil-type',
                          onChange: (e) => { f.type = e.target.value; State.notify(); } },
              h('option', { value: '', selected: !f.type }, 'All types'),
              h('option', { value: 'expense', selected: f.type === 'expense' }, 'Expenses'),
              h('option', { value: 'income',  selected: f.type === 'income' },  'Income'),
              h('option', { value: 'savings', selected: f.type === 'savings' }, 'Savings'))),
          h('div', { class: 'field' },
            h('label', { for: 'tx-fil-cat', class: 'sr-only' }, 'Category'),
            h('select', { class: 'select', id: 'tx-fil-cat',
                          onChange: (e) => { f.categoryId = e.target.value; State.notify(); } },
              h('option', { value: '', selected: !f.categoryId }, 'All categories'),
              ...state.categories.map(c => h('option', { value: c.id, selected: c.id === f.categoryId }, `${c.icon} ${c.name}`)))),
          h('button', { class: 'btn btn-secondary', onClick: () => Pages.transactions.exportCSV(state) },
            h('span', { html: Icon.download({ size: 16 }) }), 'Export CSV'),
        )
      ),

      // Summary
      h('div', { class: 'grid grid-cols-3' },
        StatCard({ label: 'Showing', value: txs.length, icon: 'list',
                   hint: txs.length === state.transactions.length ? 'All transactions' : 'Filtered' }),
        StatCard({ label: 'Income (filtered)',   value: Utils.formatMoney(incomeTotal, cur),  icon: 'arrowDown' }),
        StatCard({ label: 'Expenses (filtered)', value: Utils.formatMoney(expenseTotal, cur), icon: 'arrowUp' }),
      ),

      // Table
      h('div', { class: 'card', style: { padding: 0 } },
        txs.length === 0
          ? h('div', { class: 'empty' },
              h('div', { class: 'empty-icon', html: Icon.list({ size: 24 }) }),
              h('p', null, state.transactions.length === 0 ? 'No transactions yet.' : 'No transactions match your filters.'),
              state.transactions.length === 0
                ? h('button', { class: 'btn btn-primary', style: { marginTop: '12px' },
                    onClick: () => Pages.transactions.openTransactionForm() }, 'Add transaction')
                : h('button', { class: 'btn btn-ghost', style: { marginTop: '12px' },
                    onClick: () => { Pages.transactions.filter = { type: '', categoryId: '', search: '' }; State.notify(); } }, 'Clear filters'))
          : h('div', { class: 'table-wrap' },
              h('table', { class: 'tx' },
                h('thead', null, h('tr', null,
                  h('th', null, 'Date'), h('th', null, 'Description'),
                  h('th', null, 'Category'), h('th', { style: { textAlign: 'right' } }, 'Amount'),
                  h('th', { style: { width: '60px' } }, h('span', { class: 'sr-only' }, 'Actions')))),
                h('tbody', null, ...txs.map(t => {
                  const cat = Sel.catById(state, t.categoryId);
                  return h('tr', null,
                    h('td', { class: 'nowrap text-sm' }, Utils.formatDate(t.date)),
                    h('td', null,
                      h('div', { style: { fontWeight: 600 } }, t.merchant || cat?.name || '—'),
                      t.notes ? h('div', { class: 'text-xs text-subtle' }, t.notes) : null,
                      t.recurring ? h('span', { class: 'badge badge-info', style: { marginLeft: 6 } }, 'Recurring') : null),
                    h('td', null, CategoryChip(cat)),
                    h('td', { class: ['num', t.type].join(' ') },
                      `${t.type === 'income' ? '+' : t.type === 'savings' ? '→' : '−'} ${Utils.formatMoney(t.amount, cur)}`),
                    h('td', null,
                      h('button', { class: 'btn btn-icon btn-ghost', 'aria-label': 'Edit transaction',
                        onClick: () => Pages.transactions.openTransactionForm(t),
                        html: Icon.edit({ size: 16 }) })));
                })))),
      ),
    );
  },
};


/* ---------- BUDGET ---------- */
Pages.budget = {
  openBudgetForm(monthKey, category, existingAmount) {
    let close;
    const state = State.get();
    const cur = state.profile?.currency || 'USD';
    const form = h('form', { class: 'stack', onSubmit: async (e) => {
      e.preventDefault();
      const amt = parseFloat(e.target.elements.amount.value);
      if (!(amt >= 0)) { toast('Enter a valid amount', 'danger'); return; }
      await Repo.setBudget(monthKey, category.id, amt);
      await State.loadAll();
      toast('Budget saved', 'success');
      close();
    } },
      h('p', { class: 'text-muted' }, `Set a monthly limit for ${category.icon} ${category.name} in ${Utils.monthLabel(monthKey)}.`),
      h('div', { class: 'field' },
        h('label', { for: 'budget-amount' }, `Monthly limit (${cur})`),
        h('input', { class: 'input', type: 'number', id: 'budget-amount', name: 'amount',
                     step: '0.01', min: '0', required: true,
                     defaultValue: existingAmount ?? '', placeholder: '0.00', inputmode: 'decimal' }),
        h('div', { class: 'hint' }, 'Set to 0 to remove the limit.'),
      ),
      h('div', { class: 'row-between', style: { marginTop: '8px' } },
        h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => close() }, 'Cancel'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save'),
      ),
    );
    close = openModal({ title: `Budget: ${category.name}`, content: form });
  },

  render(state) {
    const cur = state.profile?.currency || 'USD';
    const m = state.currentMonth;
    const expenseCats = state.categories.filter(c => c.type === 'expense');
    const budgets = Sel.budgetForMonth(state, m);
    const budgetByCat = Object.fromEntries(budgets.map(b => [b.categoryId, b]));
    const spending = Sel.spendingByCategory(state, m);

    const totalBudgeted = budgets.reduce((s,b) => s + b.amount, 0);
    const totalSpent = budgets.reduce((s,b) => s + b.spent, 0);
    const totalRemaining = totalBudgeted - totalSpent;
    const overall = totalBudgeted > 0 ? totalSpent / totalBudgeted : 0;

    return h('div', { class: 'stack-lg' },
      // Header — high-contrast hero with white text on deep teal gradient
      h('div', { class: 'card budget-hero' },
        h('div', { class: 'row-between' },
          h('div', null,
            h('h2', null, `Your plan for ${Utils.monthLabel(m)}`),
            h('p', null,
              `Set a monthly limit per category. ${BRAND_NAME} will warn you at 85% and again at 100%.`)),
          h('div', { class: 'hero-icon', html: Icon.pie({ size: 26 }) }))),

      // Overall progress
      h('div', { class: 'grid grid-cols-3' },
        StatCard({ label: 'Total budgeted', value: Utils.formatMoney(totalBudgeted, cur), icon: 'wallet' }),
        StatCard({ label: 'Spent so far',    value: Utils.formatMoney(totalSpent, cur),
                   hint: `${Utils.formatPct(overall, 0)} of plan`, icon: 'trend' }),
        StatCard({ label: totalRemaining >= 0 ? 'Remaining' : 'Over plan',
                   value: Utils.formatMoney(Math.abs(totalRemaining), cur), icon: 'coins' }),
      ),

      // Per-category list
      h('div', { class: 'card' },
        h('div', { class: 'row-between', style: { marginBottom: '12px' } },
          h('h2', null, 'Categories'),
          h('span', { class: 'text-sm text-subtle' }, 'Tap a row to set a limit')),
        h('div', { class: 'stack' }, ...expenseCats.map(cat => {
          const b = budgetByCat[cat.id];
          const spent = spending[cat.id] || 0;
          const limit = b?.amount || 0;
          const pct = limit > 0 ? Math.min(spent / limit, 1.5) : 0;
          const remaining = limit - spent;
          let barCls = 'progress-bar';
          let badge = null;
          if (limit === 0) badge = h('span', { class: 'badge badge-neutral' }, 'No limit');
          else if (pct >= 1) { barCls += ' danger'; badge = h('span', { class: 'badge badge-danger' }, 'Over budget'); }
          else if (pct >= 0.85) { barCls += ' warn'; badge = h('span', { class: 'badge badge-warn' }, 'Almost there'); }
          else badge = h('span', { class: 'badge badge-success' }, 'On track');

          return h('button', {
            class: 'card', style: { padding: '14px 16px', textAlign: 'left', cursor: 'pointer', width: '100%', border: '1px solid var(--c-border)' },
            onClick: () => Pages.budget.openBudgetForm(m, cat, b?.amount),
            'aria-label': `Set budget for ${cat.name}`,
          },
            h('div', { class: 'row-between', style: { marginBottom: '8px' } },
              h('div', { class: 'row', style: { gap: '8px' } },
                h('span', { 'aria-hidden': 'true', style: { fontSize: '20px' } }, cat.icon || '•'),
                h('strong', null, cat.name),
                badge),
              h('div', { class: 'num text-sm', style: { fontWeight: 700 } },
                limit > 0
                  ? `${Utils.formatMoney(spent, cur)} of ${Utils.formatMoney(limit, cur)}`
                  : Utils.formatMoney(spent, cur))),
            limit > 0
              ? h('div', { class: 'progress' }, h('div', { class: barCls, style: { width: `${Math.min(pct, 1) * 100}%` } }))
              : h('div', { class: 'text-xs text-subtle' }, 'Tap to set a monthly limit'),
            limit > 0 ? h('div', { class: 'text-xs text-subtle', style: { marginTop: '6px' } },
              remaining >= 0 ? `${Utils.formatMoney(remaining, cur)} left` : `${Utils.formatMoney(-remaining, cur)} over`) : null,
          );
        }))),

      // Tip
      TipCard({ kind: 'info', icon: 'lightbulb',
                title: 'Need a starting point?',
                body: 'Many people allocate roughly 50% of income to needs (housing, groceries, transport), 30% to wants (dining, entertainment), and 20% to savings & debt.' }),
    );
  },
};


/* ---------- GOALS & DEBT ---------- */
Pages.goals = {
  openGoalForm(existing) {
    let close;
    const state = State.get();
    const cur = state.profile?.currency || 'USD';
    const form = h('form', { class: 'stack', onSubmit: async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        name: fd.get('name')?.trim(),
        type: fd.get('type'),
        targetAmount: parseFloat(fd.get('targetAmount')),
        currentAmount: parseFloat(fd.get('currentAmount')) || 0,
        targetDate: fd.get('targetDate') || null,
        priority: parseInt(fd.get('priority')) || 1,
      };
      if (!payload.name || !payload.targetAmount) { toast('Please complete required fields', 'danger'); return; }
      if (existing) { await Repo.updateGoal(existing.id, payload); toast('Goal updated', 'success'); }
      else          { await Repo.addGoal(payload);                 toast('Goal added', 'success'); }
      await State.loadAll();
      close();
    } },
      h('div', { class: 'field' },
        h('label', { for: 'g-name' }, 'Goal name'),
        h('input', { class: 'input', id: 'g-name', name: 'name', required: true, maxLength: 60,
                     placeholder: 'e.g. Emergency fund', defaultValue: existing?.name || '' })),
      h('div', { class: 'field' },
        h('label', { for: 'g-type' }, 'Type'),
        h('select', { class: 'select', id: 'g-type', name: 'type' },
          h('option', { value: 'savings', selected: (existing?.type || 'savings') === 'savings' }, 'Savings'),
          h('option', { value: 'emergency', selected: existing?.type === 'emergency' }, 'Emergency fund'),
          h('option', { value: 'purchase', selected: existing?.type === 'purchase' }, 'Big purchase'),
          h('option', { value: 'other', selected: existing?.type === 'other' }, 'Other'))),
      h('div', { class: 'field-row' },
        h('div', { class: 'field' },
          h('label', { for: 'g-target' }, `Target amount (${cur})`),
          h('input', { class: 'input', type: 'number', id: 'g-target', name: 'targetAmount',
                       step: '0.01', min: '0.01', required: true,
                       defaultValue: existing?.targetAmount || '', inputmode: 'decimal' })),
        h('div', { class: 'field' },
          h('label', { for: 'g-current' }, 'Saved so far'),
          h('input', { class: 'input', type: 'number', id: 'g-current', name: 'currentAmount',
                       step: '0.01', min: '0',
                       defaultValue: existing?.currentAmount || 0, inputmode: 'decimal' }))),
      h('div', { class: 'field-row' },
        h('div', { class: 'field' },
          h('label', { for: 'g-date' }, 'Target date (optional)'),
          h('input', { class: 'input', type: 'date', id: 'g-date', name: 'targetDate', defaultValue: existing?.targetDate || '' })),
        h('div', { class: 'field' },
          h('label', { for: 'g-pri' }, 'Priority'),
          h('select', { class: 'select', id: 'g-pri', name: 'priority' },
            h('option', { value: 1, selected: (existing?.priority || 1) === 1 }, 'High'),
            h('option', { value: 2, selected: existing?.priority === 2 }, 'Medium'),
            h('option', { value: 3, selected: existing?.priority === 3 }, 'Low')))),
      h('div', { class: 'row-between', style: { marginTop: '8px' } },
        existing
          ? h('button', { type: 'button', class: 'btn btn-ghost', style: { color: 'var(--c-danger)' },
              onClick: () => confirmModal({ title: 'Delete goal?', body: 'This will not affect your transactions.',
                confirmLabel: 'Delete', danger: true,
                onConfirm: async () => { await Repo.deleteGoal(existing.id); await State.loadAll(); toast('Goal deleted', 'success'); close(); } }) }, 'Delete')
          : h('span'),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => close() }, 'Cancel'),
          h('button', { type: 'submit', class: 'btn btn-primary' }, existing ? 'Save' : 'Create goal')),
      )
    );
    close = openModal({ title: existing ? 'Edit goal' : 'New goal', content: form });
  },

  openDebtForm(existing) {
    let close;
    const cur = State.get().profile?.currency || 'USD';
    const form = h('form', { class: 'stack', onSubmit: async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        name: fd.get('name')?.trim(),
        balance: parseFloat(fd.get('balance')),
        apr: parseFloat(fd.get('apr')) || 0,
        minimumPayment: parseFloat(fd.get('minimumPayment')) || 0,
      };
      if (!payload.name || !(payload.balance >= 0)) { toast('Please complete required fields', 'danger'); return; }
      if (existing) { await Repo.updateDebt(existing.id, payload); toast('Debt updated', 'success'); }
      else          { await Repo.addDebt(payload);                 toast('Debt added', 'success'); }
      await State.loadAll();
      close();
    } },
      h('div', { class: 'field' },
        h('label', { for: 'd-name' }, 'Account name'),
        h('input', { class: 'input', id: 'd-name', name: 'name', required: true, maxLength: 60,
                     placeholder: 'e.g. Visa card', defaultValue: existing?.name || '' })),
      h('div', { class: 'field-row' },
        h('div', { class: 'field' },
          h('label', { for: 'd-bal' }, `Balance (${cur})`),
          h('input', { class: 'input', type: 'number', id: 'd-bal', name: 'balance',
                       step: '0.01', min: '0', required: true,
                       defaultValue: existing?.balance ?? '', inputmode: 'decimal' })),
        h('div', { class: 'field' },
          h('label', { for: 'd-apr' }, 'APR (%)'),
          h('input', { class: 'input', type: 'number', id: 'd-apr', name: 'apr',
                       step: '0.01', min: '0', max: '100', defaultValue: existing?.apr ?? '' }))),
      h('div', { class: 'field' },
        h('label', { for: 'd-min' }, `Minimum payment (${cur}/month)`),
        h('input', { class: 'input', type: 'number', id: 'd-min', name: 'minimumPayment',
                     step: '0.01', min: '0',
                     defaultValue: existing?.minimumPayment ?? '', inputmode: 'decimal' })),
      h('div', { class: 'row-between', style: { marginTop: '8px' } },
        existing
          ? h('button', { type: 'button', class: 'btn btn-ghost', style: { color: 'var(--c-danger)' },
              onClick: () => confirmModal({ title: 'Delete debt?', body: 'This will remove this account from your tracker.',
                confirmLabel: 'Delete', danger: true,
                onConfirm: async () => { await Repo.deleteDebt(existing.id); await State.loadAll(); toast('Debt deleted', 'success'); close(); } }) }, 'Delete')
          : h('span'),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => close() }, 'Cancel'),
          h('button', { type: 'submit', class: 'btn btn-primary' }, existing ? 'Save' : 'Add debt')),
      ),
    );
    close = openModal({ title: existing ? 'Edit debt' : 'Add debt', content: form });
  },

  // Compute payoff schedule comparing snowball vs avalanche
  payoffSimulation(debts, extraPayment = 0) {
    const cloneDebts = (arr) => arr.map(d => ({ ...d }));
    const simulate = (debtsIn, sortFn) => {
      const debts = cloneDebts(debtsIn).filter(d => d.balance > 0);
      let totalInterest = 0; let months = 0;
      const totalMin = debts.reduce((s,d) => s + d.minimumPayment, 0);
      const monthlyBudget = totalMin + extraPayment;
      while (debts.some(d => d.balance > 0) && months < 600) {
        months++;
        let leftover = monthlyBudget;
        // accrue interest
        for (const d of debts) {
          if (d.balance <= 0) continue;
          const interest = (d.balance * (d.apr / 100)) / 12;
          d.balance += interest;
          totalInterest += interest;
        }
        // pay minimums first
        for (const d of debts) {
          if (d.balance <= 0) continue;
          const pay = Math.min(d.minimumPayment, d.balance, leftover);
          d.balance -= pay; leftover -= pay;
        }
        // attack target
        const sorted = debts.filter(d => d.balance > 0).sort(sortFn);
        if (sorted.length && leftover > 0) {
          const target = sorted[0];
          const pay = Math.min(target.balance, leftover);
          target.balance -= pay; leftover -= pay;
        }
      }
      return { months, totalInterest };
    };
    const snowball  = simulate(debts, (a,b) => a.balance - b.balance);
    const avalanche = simulate(debts, (a,b) => b.apr - a.apr);
    return { snowball, avalanche };
  },

  render(state) {
    const cur = state.profile?.currency || 'USD';
    const goals = state.goals;
    const debts = state.debts;
    const totalDebt = debts.reduce((s,d) => s+d.balance, 0);
    const totalMin = debts.reduce((s,d) => s+d.minimumPayment, 0);
    const sim = debts.length ? Pages.goals.payoffSimulation(debts, 0) : null;

    return h('div', { class: 'stack-lg' },
      // Goals
      h('div', { class: 'card' },
        h('div', { class: 'row-between', style: { marginBottom: '12px' } },
          h('h2', null, 'Savings goals'),
          h('button', { class: 'btn btn-primary',
                        onClick: () => Pages.goals.openGoalForm() },
            h('span', { html: Icon.plus({ size: 16 }) }), 'New goal')),
        goals.length === 0
          ? h('div', { class: 'empty' },
              h('div', { class: 'empty-icon', html: Icon.target({ size: 24 }) }),
              h('p', null, 'No goals yet.'),
              h('p', { class: 'text-sm text-subtle' }, 'Set your first goal — even a small one is a great start.'))
          : h('div', { class: 'grid grid-cols-2' }, ...goals.map(g => {
              const pct = Math.min(1, g.currentAmount / (g.targetAmount || 1));
              const remaining = Math.max(0, g.targetAmount - g.currentAmount);
              const monthsToTarget = g.targetDate
                ? Math.max(0, Math.round((new Date(g.targetDate) - new Date()) / (1000*60*60*24*30.44)))
                : null;
              const monthlyNeed = monthsToTarget && monthsToTarget > 0 ? remaining / monthsToTarget : null;
              return h('div', { class: 'card', style: { border: '1px solid var(--c-border)' } },
                h('div', { class: 'row-between' },
                  h('div', null,
                    h('strong', null, g.name),
                    h('div', { class: 'text-xs text-subtle' },
                      g.type === 'emergency' ? 'Emergency fund'
                      : g.type === 'purchase' ? 'Big purchase'
                      : g.type === 'savings' ? 'Savings goal' : 'Goal',
                      g.targetDate ? ` · ${Utils.formatDate(g.targetDate)}` : '')),
                  h('button', { class: 'btn btn-icon btn-ghost', 'aria-label': `Edit ${g.name}`,
                                onClick: () => Pages.goals.openGoalForm(g), html: Icon.edit({ size: 16 }) })),
                h('div', { style: { margin: '12px 0' } },
                  h('div', { class: 'row-between', style: { marginBottom: '6px' } },
                    h('span', { class: 'text-sm text-muted' }, `${Utils.formatPct(pct, 0)} complete`),
                    h('span', { class: 'text-sm', style: { fontWeight: 700 } },
                      `${Utils.formatMoney(g.currentAmount, cur)} / ${Utils.formatMoney(g.targetAmount, cur)}`)),
                  h('div', { class: 'progress progress-lg' }, h('div', { class: 'progress-bar', style: { width: `${pct * 100}%` } }))),
                monthlyNeed
                  ? h('div', { class: 'text-sm text-muted' },
                      `≈ ${Utils.formatMoney(monthlyNeed, cur)} / month to hit your target`)
                  : h('div', { class: 'text-sm text-muted' }, `${Utils.formatMoney(remaining, cur)} to go`),
              );
            }))),

      // Debts
      h('div', { class: 'card' },
        h('div', { class: 'row-between', style: { marginBottom: '12px' } },
          h('h2', null, 'Debt accounts'),
          h('button', { class: 'btn btn-primary',
                        onClick: () => Pages.goals.openDebtForm() },
            h('span', { html: Icon.plus({ size: 16 }) }), 'Add debt')),
        debts.length === 0
          ? h('div', { class: 'empty' },
              h('div', { class: 'empty-icon', html: Icon.shield({ size: 24 }) }),
              h('p', null, 'No debts tracked. ', h('strong', null, '🎉')),
              h('p', { class: 'text-sm text-subtle' }, 'Add a credit card or loan to plan payoff.'))
          : h('div', { class: 'stack' },
              h('div', { class: 'grid grid-cols-3' },
                StatCard({ label: 'Total debt',     value: Utils.formatMoney(totalDebt, cur), icon: 'shield' }),
                StatCard({ label: 'Min. monthly',   value: Utils.formatMoney(totalMin, cur),  icon: 'wallet' }),
                StatCard({ label: 'Accounts',       value: debts.length, icon: 'list' })),
              h('div', { class: 'table-wrap' },
                h('table', { class: 'tx' },
                  h('thead', null, h('tr', null,
                    h('th', null, 'Account'),
                    h('th', { style: { textAlign: 'right' } }, 'Balance'),
                    h('th', { style: { textAlign: 'right' } }, 'APR'),
                    h('th', { style: { textAlign: 'right' } }, 'Min payment'),
                    h('th', { style: { width: 60 } }, h('span', { class: 'sr-only' }, 'Actions')))),
                  h('tbody', null, ...debts.map(d => h('tr', null,
                    h('td', null, h('strong', null, d.name)),
                    h('td', { class: 'num' }, Utils.formatMoney(d.balance, cur)),
                    h('td', { class: 'num' }, `${(d.apr || 0).toFixed(2)}%`),
                    h('td', { class: 'num' }, Utils.formatMoney(d.minimumPayment || 0, cur)),
                    h('td', null, h('button', { class: 'btn btn-icon btn-ghost', 'aria-label': `Edit ${d.name}`,
                      onClick: () => Pages.goals.openDebtForm(d), html: Icon.edit({ size: 16 }) }))))))),
              sim ? h('div', { class: 'tip', style: { marginTop: '8px' } },
                h('div', { class: 'tip-icon', html: Icon.lightbulb({ size: 22 }) }),
                h('div', { class: 'tip-body' },
                  h('strong', null, 'Payoff projection'),
                  `Paying minimums only: snowball method clears all debt in ~${sim.snowball.months} months (interest paid: ${Utils.formatMoney(sim.snowball.totalInterest, cur)}). Avalanche method: ~${sim.avalanche.months} months (interest paid: ${Utils.formatMoney(sim.avalanche.totalInterest, cur)}). Adding extra payments shrinks both numbers fast.`,
                )) : null,
            )),

      TipCard({ kind: 'info', icon: 'book',
        title: 'Snowball or avalanche?',
        body: 'Snowball: pay smallest balance first for quick motivation wins. Avalanche: pay highest interest first to save the most money. Both work — pick what you\'ll stick with.' }),
    );
  },
};


/* ---------- LEARN ---------- */
Pages.learn = {
  selectedTopic: 'all',
  topicLabel(id) {
    const t = Tips.topics.find(t => t.id === id);
    return t ? t.label : 'Lesson';
  },
  render(state) {
    const tips = Tips.generate(state);
    const filteredLessons = this.selectedTopic === 'all'
      ? Tips.lessons
      : Tips.lessons.filter(l => l.topic === this.selectedTopic);
    const totalMinutes = filteredLessons.reduce((s, l) => s + (l.minutes || 3), 0);
    const activeTopic = Tips.topics.find(t => t.id === this.selectedTopic);

    return h('div', { class: 'stack-lg' },
      // Personalized tips
      tips.length ? h('div', { class: 'card' },
        h('h2', { style: { marginBottom: '12px' } }, 'For you, right now'),
        h('div', { class: 'stack' }, ...tips.map(TipCard))) : null,

      // Lessons hero
      h('div', { class: 'card' },
        h('div', { class: 'row-between', style: { marginBottom: '12px', flexWrap: 'wrap', gap: '12px' } },
          h('div', null,
            h('h2', { style: { fontSize: '20px' } }, 'Learn the money you actually use'),
            h('p', { class: 'text-muted', style: { marginTop: '4px' } },
              activeTopic
                ? activeTopic.blurb
                : `${Tips.lessons.length} short lessons across 5 topics — manage, save, invest, and grow your money.`)),
          h('span', { class: 'badge badge-neutral' },
            `${filteredLessons.length} lesson${filteredLessons.length === 1 ? '' : 's'} · ~${totalMinutes} min`)),

        // Topic chip filter
        h('div', { class: 'topic-chips', role: 'tablist', 'aria-label': 'Filter lessons by topic' },
          h('button', {
            class: 'topic-chip',
            role: 'tab',
            'aria-pressed': this.selectedTopic === 'all' ? 'true' : 'false',
            onClick: () => { Pages.learn.selectedTopic = 'all'; State.notify(); },
          }, 'All', h('span', { class: 'count' }, ` · ${Tips.lessons.length}`)),
          ...Tips.topics.map(t => {
            const count = Tips.lessons.filter(l => l.topic === t.id).length;
            return h('button', {
              class: 'topic-chip',
              role: 'tab',
              'aria-pressed': this.selectedTopic === t.id ? 'true' : 'false',
              onClick: () => { Pages.learn.selectedTopic = t.id; State.notify(); },
            },
              h('span', { html: Icon[t.icon] ? Icon[t.icon]({ size: 14 }) : '' }),
              h('span', null, t.label),
              h('span', { class: 'count' }, ` · ${count}`));
          }),
        ),

        // Lesson grid
        h('div', { class: 'grid grid-cols-3' }, ...filteredLessons.map(l =>
          h('button', { class: 'card lesson-card',
            onClick: () => Pages.learn._openLesson(l) },
            h('span', { class: 'topic-tag' }, Pages.learn.topicLabel(l.topic)),
            h('h3', null, l.title),
            h('p', { class: 'text-sm text-muted' },
              l.body.slice(0, 110).trimEnd() + '…'),
            h('div', { class: 'meta' },
              h('span', { html: Icon.book({ size: 14 }) }),
              h('span', null, `${l.minutes || 3} min read`),
              h('span', null, '·'),
              h('span', null, l.difficulty || 'beginner'))))),
      ),

      // Glossary
      h('div', { class: 'card' },
        h('h2', { style: { marginBottom: '4px' } }, 'Glossary'),
        h('p', { class: 'text-sm text-muted', style: { marginBottom: '16px' } },
          'Plain-language definitions of the most useful money terms.'),
        h('dl', { style: { display: 'grid', gridTemplateColumns: 'min-content 1fr', columnGap: '20px', rowGap: '12px' } },
          ...Tips.glossary.flatMap(([term, def]) => [
            h('dt', { style: { fontWeight: 700, whiteSpace: 'nowrap' } }, term),
            h('dd', { class: 'text-muted', style: { margin: 0 } }, def),
          ]))),
    );
  },
  _openLesson(l) {
    openModal({
      title: l.title,
      content: h('div', { class: 'stack' },
        h('div', { class: 'row', style: { gap: '6px' } },
          h('span', { class: 'badge badge-info' }, Pages.learn.topicLabel(l.topic)),
          h('span', { class: 'badge badge-neutral' }, `${l.minutes || 3} min read`),
          h('span', { class: 'badge badge-neutral' }, l.difficulty || 'beginner')),
        h('p', { class: 'text-muted', style: { lineHeight: 1.7, marginTop: '4px' } }, l.body),
      ),
    });
  },
};


/* ---------- SETTINGS ---------- */
Pages.settings = {
  render(state) {
    const cur = state.profile?.currency || 'USD';
    const txCount = state.transactions.length;

    return h('div', { class: 'stack-lg' },
      // Profile
      h('div', { class: 'card' },
        h('h2', { style: { marginBottom: '12px' } }, 'Your profile'),
        h('form', { class: 'stack', onSubmit: async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          await Repo.setProfile({
            displayName: fd.get('displayName')?.trim() || '',
            currency: fd.get('currency'),
            payFrequency: fd.get('payFrequency'),
            beginnerMode: fd.get('beginnerMode') === 'on',
          });
          await State.loadAll();
          toast('Profile saved', 'success');
        } },
          h('div', { class: 'field-row' },
            h('div', { class: 'field' },
              h('label', { for: 's-name' }, 'Display name'),
              h('input', { class: 'input', id: 's-name', name: 'displayName', maxLength: 40,
                           defaultValue: state.profile?.displayName || '' })),
            h('div', { class: 'field' },
              h('label', { for: 's-cur' }, 'Currency'),
              h('select', { class: 'select', id: 's-cur', name: 'currency' },
                ...Utils.CURRENCIES.map(c => h('option', { value: c.code, selected: c.code === cur },
                  `${c.symbol}  ${c.code} — ${c.name}`))))),
          h('div', { class: 'field-row' },
            h('div', { class: 'field' },
              h('label', { for: 's-freq' }, 'Pay frequency'),
              h('select', { class: 'select', id: 's-freq', name: 'payFrequency' },
                ...Object.entries(Utils.PAY_FREQUENCIES).map(([k, v]) =>
                  h('option', { value: k, selected: state.profile?.payFrequency === k }, v.label)))),
            h('div', { class: 'field' },
              h('label', { class: 'row', style: { gap: '8px', alignItems: 'center', marginTop: '24px' } },
                h('input', { type: 'checkbox', name: 'beginnerMode',
                             defaultChecked: state.profile?.beginnerMode !== false }),
                h('span', null, 'Beginner mode (more explanations)')))),
          h('div', null,
            h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save changes')),
        )),

      // Privacy & Data
      h('div', { class: 'card' },
        h('h2', { style: { marginBottom: '8px' } }, 'Your data'),
        h('p', { class: 'text-muted', style: { marginBottom: '16px' } },
          `${txCount} transaction${txCount === 1 ? '' : 's'} · ${state.goals.length} goal${state.goals.length === 1 ? '' : 's'} · ${state.debts.length} debt account${state.debts.length === 1 ? '' : 's'} — all stored on this device.`),
        h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn btn-secondary',
            onClick: async () => {
              const data = await Repo.exportAll();
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `smartdollar-backup-${Utils.todayISO()}.json`;
              document.body.appendChild(a); a.click(); a.remove();
              URL.revokeObjectURL(url);
              toast('Backup exported', 'success');
            } }, h('span', { html: Icon.download({ size: 16 }) }), 'Export full backup (JSON)'),
          h('button', { class: 'btn btn-secondary',
            onClick: () => Pages.transactions.exportCSV(state) },
            h('span', { html: Icon.download({ size: 16 }) }), 'Export transactions (CSV)'),
          h('label', { class: 'btn btn-secondary', style: { cursor: 'pointer' } },
            h('span', { html: Icon.upload({ size: 16 }) }), 'Import backup',
            h('input', { type: 'file', accept: 'application/json', class: 'sr-only',
              onChange: async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                confirmModal({
                  title: 'Replace all data?',
                  body: 'Importing will overwrite all current data on this device.',
                  confirmLabel: 'Import & replace', danger: true,
                  onConfirm: async () => {
                    try {
                      const text = await file.text();
                      const json = JSON.parse(text);
                      await Repo.importAll(json);
                      await State.loadAll();
                      toast('Backup imported', 'success');
                    } catch (err) {
                      toast('Could not import: ' + err.message, 'danger');
                    }
                  },
                });
              } })),
          h('button', { class: 'btn btn-danger',
            onClick: () => confirmModal({
              title: 'Delete all your data?',
              body: 'This permanently removes all transactions, budgets, goals, and debts on this device. There is no undo. Consider exporting a backup first.',
              confirmLabel: 'Delete everything', danger: true,
              onConfirm: async () => {
                await Repo.wipeAll();
                await Repo.ensureSeeded();
                await State.loadAll();
                location.hash = '/dashboard';
                toast('All data deleted', 'success');
              } }) },
            h('span', { html: Icon.trash({ size: 16 }) }), 'Delete all data'),
        )),

      // Privacy notice
      h('div', { class: 'card' },
        h('h2', { style: { marginBottom: '8px' } }, 'Privacy'),
        h('p', { class: 'text-muted', style: { marginBottom: '8px' } },
          `${BRAND_NAME} is designed to be local-first and private:`),
        h('ul', { class: 'text-muted', style: { paddingLeft: '20px', lineHeight: '1.8' } },
          h('li', null, 'All your data is stored in your browser via IndexedDB. It never leaves this device.'),
          h('li', null, 'No account is required. There are no servers, no analytics, no cookies.'),
          h('li', null, 'Clearing your browser data will erase your records — keep regular backups.'),
          h('li', null, `${BRAND_NAME} is open-source and free. You can self-host it on GitHub Pages or Cloudflare Pages.`),
        )),

      // About
      h('div', { class: 'card' },
        h('h2', { style: { marginBottom: '8px' } }, 'About'),
        h('p', { class: 'text-muted' }, `${BRAND_NAME} · v1.1 · Built with HTML, JavaScript, IndexedDB (Dexie), and Chart.js. Free and open-source.`),
      ),
    );
  },
};


/* =========================================================================
   14. MAIN — render loop
   ========================================================================= */
function render() {
  const root = document.getElementById('root');
  const state = State.get();
  clearNode(root);

  if (state.isLoading) {
    root.appendChild(h('div', { style: { padding: '40px', textAlign: 'center' } },
      h('p', { class: 'text-muted' }, 'Loading…')));
    return;
  }

  // First-run -> onboarding
  if (!state.profile) {
    Onboarding.render(root);
    return;
  }

  // Cleanup chart instances when navigating away from dashboard
  if (state.route !== '/dashboard') Pages.dashboard.destroy();

  let page;
  switch (state.route) {
    case '/dashboard':    page = Pages.dashboard.render(state); break;
    case '/transactions': page = Pages.transactions.render(state); break;
    case '/budget':       page = Pages.budget.render(state); break;
    case '/goals':        page = Pages.goals.render(state); break;
    case '/learn':        page = Pages.learn.render(state); break;
    case '/settings':     page = Pages.settings.render(state); break;
    default:              page = Pages.dashboard.render(state);
  }
  root.appendChild(AppShell(state, page));
}


/* =========================================================================
   15. BOOTSTRAP
   ========================================================================= */
async function main() {
  try {
    // Wait briefly for Dexie/Chart.js to load (defer means they're ready before this runs in normal flow)
    if (typeof Dexie === 'undefined' || typeof Chart === 'undefined') {
      await new Promise(res => window.addEventListener('load', res, { once: true }));
    }
    await Repo.ensureSeeded();
    State.on(render);
    Router.init();
    await State.loadAll();

    // Register service worker for PWA / offline
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('service-worker.js').catch(() => { /* offline-only optional */ });
    }
  } catch (e) {
    console.error('$martDollar failed to start:', e);
    document.getElementById('root').innerHTML =
      `<div style="padding:40px;text-align:center;"><h1>Something went wrong starting $martDollar</h1><p>${Utils.escapeHtml(e.message)}</p></div>`;
  }
}

document.addEventListener('DOMContentLoaded', main);
