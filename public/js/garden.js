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

const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: locale === 'en' ? 'narrow' : 'long' });

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


export function toast(message, kind = 'ok', { ms } = {}) {
  const element = document.createElement('div');
  element.className = `toast toast-${kind}`;
  element.textContent = message;
  if (kind === 'error') element.setAttribute('role', 'alert');
  $('#toasts').append(element);
  setTimeout(() => {
    element.classList.add('bye');
    setTimeout(() => element.remove(), 400);
  }, ms ?? (kind === 'error' ? 8000 : 3500));
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

/* ---------- the pieces every page shares ---------- */

// One look for every loading, empty and failed state in a page's content: a big emoji over a short message.
// kind is 'loading', 'empty' or 'failed'; html: true for a trusted _html translation.
export const stateBox = (kind, emoji, message, { html = false } = {}) =>
  `<div class="${kind}"><span class="big" aria-hidden="true">${emoji}</span>${html ? message : esc(message)}</div>`;

/* ---------- skeletons: stand-ins the size of the data on its way ---------- */

// The markup lives in pages/skeletons/: the server draws a page's first ones, and these clone its <template>s.
export const skeleton = (kind, count = 1) => ($(`template[data-skeleton="${kind}"]`)?.innerHTML ?? '').repeat(count);
// Skeletons are hidden from screen readers, so a region standing in for its content says what it's waiting on.
export const loadingNote = (message, { tag = 'p' } = {}) => `<${tag} class="sr-only">${esc(message)}</${tag}>`;
const emptySkeleton = (list) => (list ? `<li class="is-skeleton" aria-hidden="true">${skeleton('state-box')}</li>` : skeleton('state-box'));

// These three mirror skeleton_items, skeleton_grids and skeleton_groups in lib/garden/view.rb.
export const skeletonItems = (count, item, { list = false } = {}) => (count > 0 ? skeleton(item, count) : emptySkeleton(list));

export function skeletonGrids(counts, card, { heading = null } = {}) {
  if (!counts.some((count) => count > 0)) return skeleton('state-box');
  return counts.filter((count) => count > 0).map((count) => {
    const grid = `<div class="grid">${skeleton(card, count)}</div>`;
    return heading ? `<section class="pr-section is-skeleton">${skeleton(heading)}${grid}</section>` : grid;
  }).join('');
}

export function skeletonGroups(counts, { item = 'panel-row', list = 'repo-list', empty = 'panel-empty' } = {}) {
  return counts.map((count) => skeleton('panel-heading')
    + (count > 0 ? `<ul class="${list}">${skeleton(item, count)}</ul>` : skeleton(empty))).join('');
}

// How many items each region showed last time, kept in a cookie so the server can draw first-paint skeletons that
// size. A region opts in with data-shape="key", plus data-shape-items (what to count) and optionally
// data-shape-groups (count within each of these); it's recorded whenever it shows real content.
const SHAPES_COOKIE = 'garden_shapes';
const SHAPE_LIMITS = { groups: 8, items: 16 };
const shapes = readShapes();

function readShapes() {
  const saved = document.cookie.split('; ').find((pair) => pair.startsWith(`${SHAPES_COOKIE}=`));
  try { return JSON.parse(decodeURIComponent(saved?.slice(SHAPES_COOKIE.length + 1) || '{}')); } catch { return {}; }
}

export const shapeOf = (key, fallback) => (Array.isArray(shapes[key]) ? shapes[key] : fallback);
export const regionShape = (element, fallback) => shapeOf(element.dataset.shape, fallback);

export function rememberShape(key, counts) {
  const clamped = counts.slice(0, SHAPE_LIMITS.groups).map((count) => Math.min(count, SHAPE_LIMITS.items));
  if (JSON.stringify(shapes[key]) === JSON.stringify(clamped)) return;
  shapes[key] = clamped;
  document.cookie = `${SHAPES_COOKIE}=${encodeURIComponent(JSON.stringify(shapes))}; path=/; max-age=31536000; samesite=strict`;
}

function recordShape(region) {
  if (!region.firstElementChild || region.querySelector('.is-skeleton')) return;
  const { shape, shapeGroups, shapeItems } = region.dataset;
  const groups = shapeGroups ? [...region.querySelectorAll(shapeGroups)] : [region];
  const counts = groups.map((group) => group.querySelectorAll(shapeItems).length);
  rememberShape(shape, counts.length ? counts : [0]);
}

const shapeRecorder = new MutationObserver((mutations) => {
  new Set(mutations.map((mutation) => mutation.target.closest('[data-shape]')).filter(Boolean)).forEach(recordShape);
});
document.querySelectorAll('[data-shape]').forEach((region) => shapeRecorder.observe(region, { childList: true, subtree: true }));

// What a page remembers between visits (its chip, its search), as JSON under its own key.
export function remembered(key, fallback) {
  try {
    const saved = store.get(key);
    return saved === null ? fallback : JSON.parse(saved);
  } catch {
    return fallback;
  }
}
export const remember = (key, value) => store.set(key, JSON.stringify(value));

// "3 min old" beside the page's refresh button: how old the data on screen is. Pages call markFresh() after each load.
// While data is on its way (the page disables its refresh button meanwhile) the same spot shows a little bubbling
// indicator, so the label holds its space from the first paint and nothing shifts when the age arrives.
let freshAt = null;
let loading = true;
export function markFresh() {
  freshAt = Date.now();
  loading = false;
  renderFreshness();
}
function freshnessTag() {
  const button = $('#refresh');
  if (!button) return null;
  let tag = $('#freshness');
  if (!tag) {
    tag = document.createElement('span');
    tag.id = 'freshness';
    tag.className = 'freshness';
    tag.setAttribute('aria-live', 'polite');
    button.after(tag);
  }
  return tag;
}
function renderFreshness() {
  const tag = freshnessTag();
  if (!tag) return;
  tag.classList.toggle('is-loading', loading);
  // A reload keeps what's on screen (dimmed) rather than swapping it for skeletons, so nothing moves.
  document.body.classList.toggle('is-refreshing', loading && freshAt !== null);
  if (loading) {
    tag.innerHTML = `<span aria-hidden="true">🫧</span><span class="freshness-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="sr-only">${esc(t('common.age.loading'))}</span>`;
    return;
  }
  if (freshAt === null) {
    tag.textContent = '';
    return;
  }
  const minutes = Math.floor((Date.now() - freshAt) / 60000);
  if (minutes < 1) tag.textContent = t('common.age.fresh');
  else if (minutes < 60) tag.textContent = tp('common.age.minutes', minutes);
  else tag.textContent = tp('common.age.hours', Math.floor(minutes / 60));
}
// The refresh button is disabled while a page fetches: show the indicator then, and settle when it's enabled again
// (a failed load leaves the last age, or nothing, rather than bubbling forever).
const refreshButton = $('#refresh');
if (refreshButton) {
  new MutationObserver(() => {
    if (refreshButton.disabled) loading = true;
    else if (loading) loading = false;
    renderFreshness();
  }).observe(refreshButton, { attributes: true, attributeFilter: ['disabled'] });
  renderFreshness();
}
setInterval(renderFreshness, 30000);

// The same keys on every page: / to search, r to refresh, ← → between tabs, ? for the list. A page adds its own
// rows to the list with pageKeys([{ keys_html, does }]) and handles those keys itself.
let extraKeys = [];
export const pageKeys = (rows) => { extraKeys = rows; };
const SHARED_KEYS = ['search', 'refresh', 'tabs', 'help', 'close'];
const typingIn = (element) => element?.matches?.('input, textarea, select, [contenteditable]')
  && !element.matches('input[type="checkbox"], input[type="radio"]');
const visible = (element) => element && element.offsetParent !== null;

function focusSearch() {
  const search = [...document.querySelectorAll('main input[type="search"]')].find(visible);
  if (!search) return false;
  search.focus();
  search.select();
  return true;
}

function refreshPage() {
  const button = $('#refresh');
  if (!visible(button) || button.disabled) return false;
  button.click();
  return true;
}

function stepTab(delta) {
  const tabs = [...(([...document.querySelectorAll('main .tabs')].find(visible))?.querySelectorAll('[role="tab"]') || [])];
  if (!tabs.length) return false;
  const index = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
  const next = tabs[(index + delta + tabs.length) % tabs.length];
  next.click();
  next.focus();
  return true;
}

function showKeys() {
  const shared = SHARED_KEYS.map((name) => ({ keys_html: t(`common.keys.${name}.keys_html`), does: t(`common.keys.${name}.does`) }));
  const rows = [...shared.slice(0, -1), ...extraKeys, shared.at(-1)];
  openDialog({
    title: t('common.keys.title'),
    body: `<table class="key-table">${rows.map((row) => `<tr><td>${row.keys_html}</td><td>${esc(row.does)}</td></tr>`).join('')}</table>`,
    confirm: null,
    cancel: t('common.got_it'),
  });
  return true;
}

const KEYS = { '/': focusSearch, r: refreshPage, '?': showKeys, ArrowLeft: () => stepTab(-1), ArrowRight: () => stepTab(1) };
document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (document.querySelector('dialog[open]') || typingIn(event.target)) return;
  if (KEYS[event.key]?.()) event.preventDefault();
});

plantFloaties();
