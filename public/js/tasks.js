import { $, store, esc, ago, t, tp, pick, api, failureMessage, toast, sparkle, pointOf, openDialog, formatDate, locale } from './garden.js';

const LEAVE_MS = 260;
const TODOIST_STALE_MS = 2 * 60 * 1000;

const ui = {
  tasks: [],
  lastDeleted: null,
  todoist: { enabled: false, loading: true, sections: [], filter: null, tab: store.get('tasks-todoist-tab'), error: null, closed: new Set(), loadedAt: 0 },
};

const formatTime = (datetime) => new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(datetime));
// The same task can sit in more than one of your filter's lists; counts and lookups use each task once.
const allTodoist = () => [...new Map(ui.todoist.sections.flatMap((section) => section.tasks).map((task) => [task.id, task])).values()];
const isOpen = (task) => !ui.todoist.closed.has(task.id);
const openTodoist = () => allTodoist().filter(isOpen);
const findTodoist = (id) => allTodoist().find((task) => task.id === id);
const activeSection = () => ui.todoist.sections.find((section) => section.label === ui.todoist.tab) || ui.todoist.sections[0];
const rowById = (id) => [...document.querySelectorAll('.task-row')].find((row) => row.dataset.id === id);

const byOldest = (key) => (a, b) => a[key].localeCompare(b[key]);
const todo = () => ui.tasks.filter((t) => !t.done_at).sort(byOldest('created_at'));
const done = () => ui.tasks.filter((t) => t.done_at).sort(byOldest('done_at')).reverse();
const findTask = (id) => ui.tasks.find((t) => t.id === id);
const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/* ---------- rendering ---------- */

function render() {
  const open = todo();
  const finished = done();
  $('#todo-list').innerHTML = open.length ? open.map(taskRow).join('') : emptyTodo(finished.length);
  $('#done-list').innerHTML = finished.length ? finished.map(taskRow).join('') : `<li class="done-empty">${t('tasks.done_empty')}</li>`;
  $('#done-count').textContent = finished.length;
  const remaining = open.length + openTodoist().length;
  $('#task-summary').textContent = remaining ? tp('tasks.summary', remaining) : t('tasks.all_caught_up');
  renderTodoist();
}

function renderTodoist() {
  const { enabled, loading, error, filter, sections } = ui.todoist;
  $('#todoist-section').hidden = !enabled;
  $('#todo-title').classList.toggle('sr-only', !enabled);
  if (!enabled) return;
  $('#todoist-heading').textContent = filter ? t('tasks.todoist.heading', { filter: filter.name }) : 'todoist';
  if (filter) $('#todoist-open').href = filter.url;
  $('#todoist-count').textContent = loading || error ? '' : openTodoist().length;
  renderTodoistTabs();
  const section = activeSection();
  const status = loading ? t('tasks.todoist.loading') : error ? t('tasks.todoist.error', { error }) : section?.tasks.length ? '' : t('tasks.todoist.empty_tab');
  $('#todoist-status').hidden = !status;
  $('#todoist-status').textContent = status;
  $('#todoist-list').innerHTML = loading || error || !section ? '' : section.tasks.map(todoistRow).join('');
}

function renderTodoistTabs() {
  const { sections, loading, error } = ui.todoist;
  const tabs = $('#todoist-tabs');
  tabs.hidden = loading || Boolean(error) || sections.length < 2;
  if (tabs.hidden) return;
  const active = activeSection();
  tabs.innerHTML = sections.map((section, index) => {
    const selected = section === active;
    return `<button type="button" class="tab" role="tab" id="todoist-tab-${index}" data-tab-index="${index}" aria-controls="todoist-list"
      aria-selected="${selected}" tabindex="${selected ? 0 : -1}">${esc(section.label)} <span class="tab-count">${section.tasks.filter(isOpen).length}</span></button>`;
  }).join('');
  $('#todoist-list').setAttribute('aria-labelledby', `todoist-tab-${sections.indexOf(active)}`);
}

function selectTodoistTab(index, { focus = false } = {}) {
  const section = ui.todoist.sections[index];
  if (!section) return;
  ui.todoist.tab = section.label;
  store.set('tasks-todoist-tab', section.label);
  renderTodoist();
  if (focus) document.getElementById(`todoist-tab-${index}`)?.focus();
}

function todoistBadges(task) {
  const badges = [];
  if (task.overdue) badges.push(`<span class="mini-badge is-overdue">${esc(t('tasks.todoist.overdue', { date: formatDate(task.due_date) }))}</span>`);
  else if (task.due_datetime) badges.push(`<span class="mini-badge is-time">${esc(t('tasks.todoist.at_time', { time: formatTime(task.due_datetime) }))}</span>`);
  if (task.recurring) badges.push(`<span class="mini-badge">${esc(t('tasks.todoist.recurring'))}</span>`);
  if (task.project) badges.push(`<span class="mini-badge">📁 ${esc(task.project)}</span>`);
  return badges.join('');
}

function todoistRow(task) {
  const closed = ui.todoist.closed.has(task.id);
  const meta = closed
    ? `<span class="mini-badge">${esc(t(task.recurring ? 'tasks.todoist.recurring_done' : 'tasks.todoist.done_badge'))}</span>`
    : todoistBadges(task);
  return `
    <li class="task-row todoist-row prio-${task.priority}${closed ? ' is-done' : ''}" data-id="${esc(task.id)}" data-source="todoist">
      <label class="task-check">
        <input type="checkbox" ${closed ? 'checked' : ''}>
        <span class="task-title">${esc(task.content)}</span>
      </label>
      <span class="task-meta">${meta}</span>
      <a class="task-open" href="${esc(task.url)}" target="_blank" rel="noopener" tabindex="-1" aria-label="${esc(t('tasks.todoist.open_label', { title: task.content }))}">↗️</a>
    </li>`;
}

function emptyTodo(doneCount) {
  const message = doneCount ? t('tasks.empty_all_done_html') : t('tasks.empty_fresh_html');
  return `<li class="task-empty"><span class="big" aria-hidden="true">🍓</span>${message}</li>`;
}

function taskRow(task) {
  const isDone = Boolean(task.done_at);
  const age = isDone ? t('tasks.finished', { ago: ago(task.done_at) }) : t('tasks.planted', { ago: ago(task.created_at) });
  return `
    <li class="task-row${isDone ? ' is-done' : ''}" data-id="${esc(task.id)}">
      <label class="task-check">
        <input type="checkbox" ${isDone ? 'checked' : ''}>
        <span class="task-title">${esc(task.title)}</span>
      </label>
      <span class="task-age">${age}</span>
      <button type="button" class="task-delete" data-action="delete" tabindex="-1" aria-label="${t('tasks.delete_label', { title: esc(task.title) })}">🗑️</button>
    </li>`;
}

/* ---------- focus ---------- */

// Checks for a closed <details> directly: Chrome keeps its hidden content in layout, so offsetParent lies.
const focusables = () => [...document.querySelectorAll('.task-row input')].filter((input) => !input.closest('details:not([open])'));

function focusTask(id) {
  const row = [...document.querySelectorAll('.task-row')].find((r) => r.dataset.id === id);
  row?.querySelector('input').focus();
}

function moveFocus(delta) {
  const inputs = focusables();
  if (!inputs.length) return;
  const index = inputs.indexOf(document.activeElement);
  const next = index === -1 ? (delta > 0 ? 0 : inputs.length - 1) : Math.min(Math.max(index + delta, 0), inputs.length - 1);
  inputs[next].focus();
}

function neighbourOf(id) {
  const ids = focusables().map((input) => input.closest('.task-row').dataset.id);
  const index = ids.indexOf(id);
  return ids[index + 1] || ids[index - 1] || null;
}

function restoreFocus(id) {
  if (id) focusTask(id);
  if (!document.activeElement || document.activeElement === document.body) $('#new-task').focus();
}

/* ---------- actions ---------- */

async function createTask() {
  const input = $('#task-input');
  const title = input.value.trim();
  if (!title) return shake(input);
  const result = await api('/api/tasks/create', { title });
  if (!result.ok) return toast(failureMessage(result), 'error');
  ui.tasks.push(result.task);
  $('#task-dialog').close();
  render();
  const row = [...document.querySelectorAll('.task-row')].find((r) => r.dataset.id === result.task.id);
  row?.classList.add('is-new');
  focusTask(result.task.id);
  if (row) sparkle(pointOf(row));
}

async function toggleTask(id) {
  const task = findTask(id);
  const row = [...document.querySelectorAll('.task-row')].find((r) => r.dataset.id === id);
  if (!task || !row) return;
  const finishing = !task.done_at;
  const next = neighbourOf(id);
  const point = pointOf(row);
  row.querySelector('input').checked = finishing;
  row.classList.add('is-leaving');

  const [result] = await Promise.all([api('/api/tasks/update', { id, done: finishing }), pause(LEAVE_MS)]);
  if (!result.ok) {
    toast(failureMessage(result), 'error');
    return render();
  }
  Object.assign(task, result.task);
  render();
  restoreFocus(next);
  if (finishing) {
    sparkle(point);
    toast(pick('tasks.cheers'));
  }
}

async function toggleTodoist(id) {
  const task = findTodoist(id);
  const input = rowById(id)?.querySelector('input');
  if (!task || !input) return;
  const closing = !ui.todoist.closed.has(id);
  if (!closing && task.recurring) {
    input.checked = true;
    return toast(t('tasks.todoist.recurring_reopen'));
  }
  input.checked = closing;
  const result = await api(`/api/tasks/todoist/${closing ? 'close' : 'reopen'}`, { id });
  if (!result.ok) {
    input.checked = !closing;
    return toast(failureMessage(result), 'error');
  }
  if (closing) ui.todoist.closed.add(id);
  else ui.todoist.closed.delete(id);
  render();
  focusTask(id);
  if (!closing) return toast(t('tasks.todoist.reopened'));
  sparkle(pointOf(rowById(id)));
  toast(pick('tasks.cheers'));
}

const isTodoistRow = (row) => row?.dataset.source === 'todoist';

function toggleRow(row) {
  return isTodoistRow(row) ? toggleTodoist(row.dataset.id) : toggleTask(row.dataset.id);
}

function deleteRow(row) {
  return isTodoistRow(row) ? toast(t('tasks.todoist.no_delete')) : deleteTask(row.dataset.id);
}

function openRow(row) {
  if (isTodoistRow(row)) window.open(findTodoist(row.dataset.id)?.url, '_blank', 'noopener');
}

async function deleteTask(id) {
  const next = neighbourOf(id);
  const result = await api('/api/tasks/delete', { id });
  if (!result.ok) return toast(failureMessage(result), 'error');
  ui.tasks = ui.tasks.filter((t) => t.id !== id);
  ui.lastDeleted = result.task;
  render();
  restoreFocus(next);
  toast(t('tasks.toasts.deleted'));
}

async function undoDelete() {
  if (!ui.lastDeleted) return toast(t('tasks.toasts.nothing_to_undo'));
  const result = await api('/api/tasks/restore', { task: ui.lastDeleted });
  if (!result.ok) return toast(failureMessage(result), 'error');
  ui.tasks.push(result.task);
  ui.lastDeleted = null;
  if (result.task.done_at) setDoneOpen(true);
  render();
  focusTask(result.task.id);
  toast(t('tasks.toasts.restored'));
}

/* ---------- dialogs & sections ---------- */

function openCreate() {
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

function setDoneOpen(open) {
  $('#done-section').open = open;
  store.set('tasks-done-open', open ? 'yes' : 'no');
}

const HELP_ROWS = ['create', 'save', 'move', 'toggle', 'delete', 'undo', 'done_list', 'close'];
const helpRows = () => (ui.todoist.enabled ? [...HELP_ROWS, 'open_todoist'] : HELP_ROWS);

function helpRow(name) {
  return `<tr><td>${t(`tasks.help.rows.${name}.keys_html`)}</td><td>${esc(t(`tasks.help.rows.${name}.does`))}</td></tr>`;
}

function showHelp() {
  openDialog({
    title: t('tasks.help.title'),
    body: `<table class="key-table">${helpRows().map(helpRow).join('')}</table>`,
    confirm: null,
    cancel: t('common.got_it'),
  });
}

/* ---------- keyboard ---------- */

const anyDialogOpen = () => document.querySelector('dialog[open]') !== null;
const isTyping = (target) => target.matches?.('input[type="text"], input[type="search"], textarea, select, [contenteditable]');

function rowFor(target) {
  return target.closest?.('.task-row');
}

const SHORTCUTS = {
  c: () => openCreate(),
  d: () => setDoneOpen(!$('#done-section').open),
  u: () => undoDelete(),
  '?': () => showHelp(),
  j: () => moveFocus(1),
  k: () => moveFocus(-1),
  ArrowDown: () => moveFocus(1),
  ArrowUp: () => moveFocus(-1),
  Home: () => focusables()[0]?.focus(),
  End: () => focusables().at(-1)?.focus(),
};

const ROW_SHORTCUTS = {
  x: toggleRow,
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
  if (row && event.target.type === 'checkbox') toggleRow(row);
});

document.querySelector('.task-garden').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="delete"]');
  if (button) deleteTask(rowFor(button).dataset.id);
});

$('#done-section').addEventListener('toggle', (event) => store.set('tasks-done-open', event.target.open ? 'yes' : 'no'));
$('#done-section').open = store.get('tasks-done-open') === 'yes';

async function loadTasks() {
  const result = await api('/api/tasks/list');
  if (!result.httpOk) return toast(t('tasks.toasts.load_failed', { error: failureMessage(result) }), 'error');
  ui.tasks = result.tasks;
  render();
}

async function loadTodoist({ refresh = false } = {}) {
  const result = await api(`/api/tasks/todoist${refresh ? '?refresh=1' : ''}`);
  Object.assign(ui.todoist, {
    enabled: result.enabled !== false,
    loading: false,
    error: result.httpOk ? null : failureMessage(result),
    sections: result.sections || [],
    filter: result.filter || null,
    closed: new Set(),
    loadedAt: Date.now(),
  });
  const focusedId = rowFor(document.activeElement)?.dataset.id;
  render();
  if (focusedId) focusTask(focusedId);
}

$('#todoist-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[role="tab"]');
  if (tab) selectTodoistTab(Number(tab.dataset.tabIndex), { focus: true });
});

function todoistTabFor(key) {
  const count = ui.todoist.sections.length;
  const current = ui.todoist.sections.indexOf(activeSection());
  if (key === 'ArrowLeft') return (current - 1 + count) % count;
  if (key === 'ArrowRight') return (current + 1) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

$('#todoist-tabs').addEventListener('keydown', (event) => {
  const target = todoistTabFor(event.key);
  if (target === null) return;
  event.preventDefault();
  selectTodoistTab(target, { focus: true });
});

// Coming back to the tab after a while picks up whatever changed in Todoist meanwhile.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ui.todoist.enabled && Date.now() - ui.todoist.loadedAt > TODOIST_STALE_MS) loadTodoist({ refresh: true });
});

loadTasks();
loadTodoist();
