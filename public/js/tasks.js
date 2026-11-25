import {
  $, store, esc, t, tp, pick, api, failureMessage, toast, sparkle, pointOf, openDialog, formatDate, locale, TOKEN,
} from './garden.js';
import { ScopePanel } from './scope-panel.js';

// Every task lives in Todoist, and the lists you pick in the side panel become tabs.
const LEAVE_MS = 260;
const STALE_MS = 2 * 60 * 1000;
// Checking off and deleting both wait this long (while their toast says "press u to undo") before reaching
// Todoist, which can't undelete and leaves nothing here to uncheck.
const UNDO_MS = 6000;

const ui = {
  enabled: true, loading: true, error: null, sections: [], loadedAt: 0, loadId: 0,
  tab: store.get('tasks-todoist-tab'),
  hidden: new Set(), // checked off or deleted here and not yet confirmed by Todoist, so they stay hidden through reloads
  pending: null, // { id, action, timer } while undo is still possible
};

// The lists the panel offers, in tab order. The first visit shows today and late, as the page always has.
const LISTS = ['today', 'late', 'inbox', 'upcoming'];
const STARTING_LISTS = ['today', 'late'];
const SCOPE_KEY = 'tasks-tabs';
if (store.get(`${SCOPE_KEY}-excluded`) === null) {
  store.set(`${SCOPE_KEY}-excluded`, JSON.stringify(LISTS.filter((key) => !STARTING_LISTS.includes(key))));
}
const panel = new ScopePanel({ prefix: 'tasks.panel', storeKey: SCOPE_KEY, onChange: () => load() });
panel.setItems(LISTS.map((key) => ({ id: key, name: t(`tasks.todoist.tabs.${key}`), detail: t(`tasks.panel.details.${key}`) })));
const shownLists = () => panel.scoped().map((item) => item.id);

const formatTime = (datetime) => new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(datetime));
const visible = (task) => !ui.hidden.has(task.id);
// Counts and lookups use each task once, in case Todoist ever puts one in two tabs.
const allOpen = () => [...new Map(ui.sections.flatMap((section) => section.tasks).map((task) => [task.id, task])).values()].filter(visible);
const findOpen = (id) => allOpen().find((task) => task.id === id);
const activeSection = () => ui.sections.find((section) => section.key === ui.tab) || ui.sections[0];
const tabLabel = (section) => t(`tasks.todoist.tabs.${section.key}`);
const rowById = (id) => [...document.querySelectorAll('.task-row')].find((row) => row.dataset.id === id);
const today = () => { const now = new Date(); return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/* ---------- rendering ---------- */

function render() {
  const remaining = allOpen().length;
  // With no lists showing there is nothing to count, so the tagline goes back to its plain self.
  if (!ui.enabled || !shownLists().length) $('#task-summary').textContent = t('tasks.tagline');
  else if (!ui.loading && !ui.error) $('#task-summary').textContent = remaining ? tp('tasks.summary', remaining) : t('tasks.all_caught_up');
  $('#new-task').disabled = !ui.enabled;
  renderOpen();
}

function renderOpen() {
  const { enabled, loading, error } = ui;
  $('#todoist-count').textContent = loading || error || !enabled || !shownLists().length ? '' : allOpen().length;
  renderTabs();
  const section = activeSection();
  const tasks = section ? section.tasks.filter(visible) : [];
  let status = '';
  if (!enabled) status = t('tasks.todoist.not_set_up_html');
  else if (!shownLists().length) status = esc(t('tasks.no_tabs'));
  else if (loading) status = esc(t('tasks.todoist.loading'));
  else if (error) status = esc(t('tasks.todoist.error', { error }));
  else if (!tasks.length) status = esc(t('tasks.todoist.empty_tab'));
  $('#todoist-status').hidden = !status;
  $('#todoist-status').innerHTML = status;
  $('#todoist-list').innerHTML = loading || error || !enabled ? '' : tasks.map(taskRow).join('');
}

function renderTabs() {
  const tabs = $('#todoist-tabs');
  tabs.hidden = ui.loading || Boolean(ui.error) || !ui.enabled || !ui.sections.length;
  if (tabs.hidden) return;
  const active = activeSection();
  tabs.innerHTML = ui.sections.map((section, index) => {
    const selected = section === active;
    const count = section.tasks.filter(visible).length;
    return `<button type="button" class="tab" role="tab" id="todoist-tab-${index}" data-tab-index="${index}" aria-controls="todoist-list"
      aria-selected="${selected}" tabindex="${selected ? 0 : -1}">${esc(tabLabel(section))} <span class="tab-count">${count}</span></button>`;
  }).join('');
  $('#todoist-list').setAttribute('aria-labelledby', `todoist-tab-${ui.sections.indexOf(active)}`);
}

function selectTab(index, { focus = false } = {}) {
  const section = ui.sections[index];
  if (!section) return;
  ui.tab = section.key;
  store.set('tasks-todoist-tab', section.key);
  renderOpen();
  if (focus) document.getElementById(`todoist-tab-${index}`)?.focus();
}

function badges(task) {
  const list = [];
  if (task.overdue) list.push(`<span class="mini-badge is-overdue">${esc(t('tasks.todoist.overdue', { date: formatDate(task.due_date) }))}</span>`);
  else if (task.due_datetime) list.push(`<span class="mini-badge is-time">${esc(t('tasks.todoist.at_time', { time: formatTime(task.due_datetime) }))}</span>`);
  // Upcoming and inbox tasks can be due any day, so say which one (the time badge above covers today's).
  if (task.due_date && !task.overdue && task.due_date !== today()) list.push(`<span class="mini-badge">${esc(t('tasks.todoist.due_on', { date: formatDate(task.due_date) }))}</span>`);
  if (task.recurring) list.push(`<span class="mini-badge">${esc(t('tasks.todoist.recurring'))}</span>`);
  if (task.project) list.push(`<span class="mini-badge">📁 ${esc(task.project)}</span>`);
  return list.join('');
}

function taskRow(task) {
  return `
    <li class="task-row todoist-row prio-${task.priority}" data-id="${esc(task.id)}">
      <label class="task-check">
        <input type="checkbox">
        <span class="task-title">${esc(task.content)}</span>
      </label>
      <span class="task-meta">${badges(task)}</span>
      <a class="task-open" href="${esc(task.url)}" target="_blank" rel="noopener" tabindex="-1" aria-label="${esc(t('tasks.todoist.open_label', { title: task.content }))}">↗️</a>
      <button type="button" class="task-delete" data-action="delete" tabindex="-1" aria-label="${esc(t('tasks.delete_label', { title: task.content }))}">🗑️</button>
    </li>`;
}

/* ---------- focus ---------- */

const focusables = () => [...document.querySelectorAll('.task-row input')];

function focusTask(id) {
  rowById(id)?.querySelector('input').focus();
}

function moveFocus(delta) {
  const inputs = focusables();
  if (!inputs.length) return;
  const index = inputs.indexOf(document.activeElement);
  const next = index === -1 ? (delta > 0 ? 0 : inputs.length - 1) : Math.min(Math.max(index + delta, 0), inputs.length - 1);
  inputs[next].focus();
}

function neighborOf(id) {
  const ids = focusables().map((input) => input.closest('.task-row').dataset.id);
  const index = ids.indexOf(id);
  return ids[index + 1] || ids[index - 1] || null;
}

function restoreFocus(id) {
  if (id) focusTask(id);
  if (!document.activeElement || document.activeElement === document.body) $('#new-task').focus();
}

/* ---------- loading ---------- */

// Asks for just the lists the panel shows. A newer load (say, after another checkbox) wins over an older one.
async function load({ refresh = false } = {}) {
  const loadId = ++ui.loadId;
  const query = new URLSearchParams({ tabs: shownLists().join(',') });
  if (refresh) query.set('refresh', '1');
  const result = await api(`/api/tasks/list?${query}`);
  if (loadId !== ui.loadId) return;
  Object.assign(ui, {
    enabled: result.enabled !== false,
    loading: false,
    error: result.httpOk ? null : failureMessage(result),
    sections: result.sections || [],
    loadedAt: Date.now(),
  });
  const focusedId = rowFor(document.activeElement)?.dataset.id;
  render();
  if (focusedId) focusTask(focusedId);
}

/* ---------- actions ---------- */

async function createTask() {
  const input = $('#task-input');
  const text = input.value.trim();
  if (!text) return shake(input);
  const result = await api('/api/tasks/create', { text });
  if (!result.ok) return toast(failureMessage(result), 'error');
  $('#task-dialog').close();
  await load({ refresh: true });
  // Show the new task in whichever tab it landed in.
  const index = ui.sections.findIndex((section) => section.tasks.some((task) => task.id === result.id));
  if (index === -1) return toast(t('tasks.toasts.planted_elsewhere'));
  if (ui.sections[index] !== activeSection()) selectTab(index);
  const row = rowById(result.id);
  row?.classList.add('is-new');
  focusTask(result.id);
  if (row) sparkle(pointOf(row));
}

async function closeRow(row) {
  const { id } = row.dataset;
  if (!findOpen(id) || row.classList.contains('is-leaving')) return;
  const point = pointOf(row);
  row.querySelector('input').checked = true;
  row.classList.add('is-leaving');
  await pause(LEAVE_MS);
  sparkle(point);
  stage('close', id, t('tasks.toasts.closed', { cheer: pick('tasks.cheers') }));
}

function deleteRow(row) {
  const { id } = row.dataset;
  if (findOpen(id)) stage('delete', id, t('tasks.toasts.deleted'));
}

// Hides the task now and sends the close or delete after UNDO_MS. Only the latest one waits: starting
// another sends the one before straight away.
function stage(action, id, message) {
  flushPending();
  const next = neighborOf(id);
  ui.hidden.add(id);
  ui.pending = { id, action, timer: setTimeout(() => flushPending(), UNDO_MS) };
  render();
  restoreFocus(next);
  toast(message, 'ok', { ms: UNDO_MS });
}

// Sends the waiting action to Todoist. On the way out of the page it uses keepalive so it still arrives.
async function flushPending({ leaving = false } = {}) {
  const pending = ui.pending;
  if (!pending) return;
  ui.pending = null;
  clearTimeout(pending.timer);
  const path = `/api/tasks/${pending.action}`;
  if (leaving) {
    fetch(path, {
      method: 'POST', keepalive: true, body: JSON.stringify({ id: pending.id }),
      headers: { 'Content-Type': 'application/json', 'X-Garden-Token': TOKEN },
    });
    return;
  }
  const result = await api(path, { id: pending.id });
  // Done either way: drop it from what we're showing, so a recurring task's next date can show up on a later load.
  if (result.ok) ui.sections.forEach((section) => { section.tasks = section.tasks.filter((task) => task.id !== pending.id); });
  ui.hidden.delete(pending.id);
  render();
  if (!result.ok) toast(failureMessage(result), 'error');
}

function undo() {
  const pending = ui.pending;
  if (!pending) return toast(t('tasks.toasts.nothing_to_undo'));
  clearTimeout(pending.timer);
  ui.pending = null;
  ui.hidden.delete(pending.id);
  render();
  focusTask(pending.id);
  toast(t('tasks.toasts.restored'));
}

function openRow(row) {
  const task = findOpen(row.dataset.id);
  if (task) window.open(task.url, '_blank', 'noopener');
}

/* ---------- dialogs ---------- */

function openCreate() {
  if (!ui.enabled) return toast(t('errors.todoist.not_set_up'));
  const input = $('#task-input');
  input.value = '';
  $('#task-dialog').showModal();
  input.focus();
}

function shake(input) {
  input.classList.remove('is-shaking');
  void input.offsetWidth;
  input.classList.add('is-shaking');
  input.focus();
}

const HELP_ROWS = ['create', 'save', 'move', 'toggle', 'delete', 'undo', 'open_todoist', 'close'];

function helpRow(name) {
  return `<tr><td>${t(`tasks.help.rows.${name}.keys_html`)}</td><td>${esc(t(`tasks.help.rows.${name}.does`))}</td></tr>`;
}

function showHelp() {
  openDialog({
    title: t('tasks.help.title'),
    body: `<table class="key-table">${HELP_ROWS.map(helpRow).join('')}</table>`,
    confirm: null,
    cancel: t('common.got_it'),
  });
}

/* ---------- keyboard ---------- */

const anyDialogOpen = () => document.querySelector('dialog[open]') !== null;
const isTyping = (target) => target.matches?.('input[type="text"], input[type="search"], textarea, select, [contenteditable]');

function rowFor(target) {
  return target?.closest?.('.task-row');
}

const SHORTCUTS = {
  c: () => openCreate(),
  u: () => undo(),
  '?': () => showHelp(),
  j: () => moveFocus(1),
  k: () => moveFocus(-1),
  ArrowDown: () => moveFocus(1),
  ArrowUp: () => moveFocus(-1),
  Home: () => focusables()[0]?.focus(),
  End: () => focusables().at(-1)?.focus(),
};

const ROW_SHORTCUTS = {
  x: closeRow,
  o: openRow,
  Delete: deleteRow,
  Backspace: deleteRow,
};

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || anyDialogOpen() || isTyping(event.target)) return;
  const row = rowFor(event.target);
  const action = (row && ROW_SHORTCUTS[event.key]) || SHORTCUTS[event.key];
  if (!action) return;
  event.preventDefault();
  action(row);
});

/* ---------- wiring ---------- */

$('#task-input').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault();
  createTask();
});

$('#task-form').addEventListener('submit', (event) => {
  if (event.submitter?.value !== 'create') return;
  event.preventDefault();
  createTask();
});

$('#new-task').addEventListener('click', openCreate);

document.querySelector('.task-garden').addEventListener('change', (event) => {
  const row = rowFor(event.target);
  if (row && event.target.type === 'checkbox' && event.target.checked) closeRow(row);
});

document.querySelector('.task-garden').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="delete"]');
  if (button) deleteRow(rowFor(button));
});

$('#todoist-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[role="tab"]');
  if (tab) selectTab(Number(tab.dataset.tabIndex), { focus: true });
});

function tabFor(key) {
  const count = ui.sections.length;
  const current = ui.sections.indexOf(activeSection());
  if (key === 'ArrowLeft') return (current - 1 + count) % count;
  if (key === 'ArrowRight') return (current + 1) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

$('#todoist-tabs').addEventListener('keydown', (event) => {
  const target = tabFor(event.key);
  if (target === null) return;
  event.preventDefault();
  selectTab(target, { focus: true });
});

// Coming back to the tab after a while picks up whatever changed in Todoist meanwhile.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ui.enabled && Date.now() - ui.loadedAt > STALE_MS) load({ refresh: true });
});

// A close or delete still waiting for its undo window is sent on the way out, so closing the tab doesn't lose it.
window.addEventListener('pagehide', () => flushPending({ leaving: true }));

render();
load();
