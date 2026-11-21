// shared helpers for every garden page 🌸

export const TOKEN = document.querySelector('meta[name="garden-token"]').content;
export const $ = (selector) => document.querySelector(selector);
const DAY = 86400000;
export const STALE_DAYS = 30;
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- i18n ---------- */

const I18N = JSON.parse(document.getElementById('garden-i18n').textContent);
export const locale = I18N.locale;
const pluralRules = new Intl.PluralRules(locale);
const lookup = (key) => key.split('.').reduce((node, part) => node?.[part], I18N.strings);
const interpolate = (text, vars) => text.replace(/%\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));

function missing(key) {
  console.warn(`🌐 missing translation: ${key}`);
  return key;
}

// Strings get %{var} filled in; lists (like random cheers) come back as arrays.
export function t(key, vars = {}) {
  const value = lookup(key);
  if (value === undefined) return missing(key);
  return typeof value === 'string' ? interpolate(value, vars) : value;
}

// Plural-aware: the key holds { one, other } and %{count} is filled in.
export function tp(key, count, vars = {}) {
  const forms = lookup(key);
  const form = forms?.[pluralRules.select(count)] ?? forms?.other;
  return form === undefined ? missing(key) : interpolate(form, { count, ...vars });
}

export const pick = (key) => {
  const options = t(key);
  return Array.isArray(options) ? options[Math.floor(Math.random() * options.length)] : options;
};

export const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};


export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ageDays = (iso) => (Date.now() - Date.parse(iso)) / DAY;

const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: locale === 'fr' ? 'long' : 'narrow' });

export function ago(iso) {
  const days = ageDays(iso);
  if (days < 1 / 24) return t('common.just_now');
  if (days < 1) return relative.format(-Math.round(days * 24), 'hour');
  if (days < 14) return relative.format(-Math.round(days), 'day');
  if (days < 60) return relative.format(-Math.round(days / 7), 'week');
  if (days < 365) return relative.format(-Math.round(days / 30), 'month');
  return relative.format(-Number((days / 365).toFixed(1)), 'year');
}

// Date-only strings (like Jira due dates) are UTC midnight; formatting in UTC keeps the right day.
export const formatDate = (isoDate) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(isoDate));

export function ageEmoji(iso) {
  const days = ageDays(iso);
  if (days < 1) return '🐣';
  if (days < 7) return '🌱';
  if (days < STALE_DAYS) return '🌸';
  if (days < 90) return '🐌';
  return '🕸️';
}

/* ---------- api ---------- */

export async function api(path, body) {
  const options = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Garden-Token': TOKEN }, body: JSON.stringify(body) }
    : {};
  try {
    const response = await fetch(path, options);
    const json = await response.json().catch(() => ({}));
    return { httpOk: response.ok, ok: false, ...json };
  } catch {
    return { httpOk: false, ok: false, error: t('errors.server_asleep') };
  }
}

export const failureMessage = (result) => result.error || (result.error_key && t(result.error_key)) || result.output || t('errors.wilted');

/* ---------- frivolity ---------- */

const FLOATIES = ['💖', '🌸', '✨', '🦄', '🍓', '🌷', '💕', '⭐', '🎀', '🫧', '🌈', '🍬', '🧁', '🐰'];

export function plantFloaties() {
  const field = $('.floaties');
  for (let i = 0; i < 18; i++) {
    const floaty = document.createElement('span');
    floaty.className = 'floaty';
    floaty.style.left = `${Math.random() * 100}%`;
    floaty.style.fontSize = `${14 + Math.random() * 20}px`;
    floaty.style.animationDuration = `${18 + Math.random() * 16}s`;
    floaty.style.animationDelay = `${-Math.random() * 34}s`;

    const sway = document.createElement('span');
    sway.className = 'floaty-sway';
    sway.textContent = FLOATIES[i % FLOATIES.length];
    sway.style.animationDuration = `${2.5 + Math.random() * 2.5}s`;
    sway.style.animationDelay = `${-Math.random() * 5}s`;

    floaty.append(sway);
    field.append(floaty);
  }
}

// Cards fade in on fresh data only, so filtering and searching don't replay it.
export function sprout(...grids) {
  grids.forEach((grid) => {
    grid.classList.add('sprouting');
    setTimeout(() => grid.classList.remove('sprouting'), 450);
  });
}

const CONFETTI = ['💖', '✨', '🌸', '💕', '⭐', '🎀', '🌷', '🦋'];

export function sparkle(point) {
  if (reducedMotion()) return;
  const x = point?.x ?? innerWidth / 2;
  const y = point?.y ?? innerHeight / 2;
  for (let i = 0; i < 16; i++) {
    const bit = document.createElement('span');
    bit.className = 'confetti';
    bit.setAttribute('aria-hidden', 'true');
    bit.textContent = CONFETTI[i % CONFETTI.length];
    const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.4;
    const distance = 60 + Math.random() * 90;
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    bit.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    bit.style.setProperty('--dy', `${Math.sin(angle) * distance - 30}px`);
    bit.style.setProperty('--rot', `${Math.random() * 360 - 180}deg`);
    bit.addEventListener('animationend', () => bit.remove());
    document.body.append(bit);
  }
}

export function pointOf(element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}


export function toast(message, kind = 'ok') {
  const element = document.createElement('div');
  element.className = `toast toast-${kind}`;
  element.textContent = message;
  if (kind === 'error') element.setAttribute('role', 'alert');
  $('#toasts').append(element);
  setTimeout(() => {
    element.classList.add('bye');
    setTimeout(() => element.remove(), 400);
  }, kind === 'error' ? 8000 : 3500);
}

/* ---------- dialog ---------- */

const dialog = $('#dialog');
let dialogBusy = false;
export const setDialogBusy = (busy) => { dialogBusy = busy; };
dialog.addEventListener('cancel', (event) => { if (dialogBusy) event.preventDefault(); });

export function openDialog({ title, body, confirm = t('common.ok'), cancel = t('common.never_mind'), danger = false }) {
  $('#dialog-title').textContent = title;
  $('#dialog-body').innerHTML = body;
  const confirmButton = $('#dialog-confirm');
  confirmButton.hidden = !confirm;
  confirmButton.textContent = confirm || '';
  confirmButton.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
  const cancelButton = $('#dialog-cancel');
  cancelButton.textContent = cancel;
  cancelButton.disabled = false;
  dialog.returnValue = '';
  if (!dialog.open) dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm' ? new FormData($('#dialog-form')) : null), { once: true });
  });
}

export function dialogItem(key) {
  return [...document.querySelectorAll('#dialog-body li')].find((li) => li.dataset.key === key);
}

export const toggle = (name, label, checked = false) =>
  `<label class="force-toggle"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;

/* ---------- language toggle ---------- */

document.getElementById('lang-toggle')?.addEventListener('click', (event) => {
  document.cookie = `garden_locale=${event.currentTarget.dataset.locale}; path=/; max-age=31536000; samesite=strict`;
  location.reload();
});

plantFloaties();
