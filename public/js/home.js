import {
  $, store, esc, t, tp, pick, api, failureMessage, ago, formatDate, locale, toast, sparkle, pointOf, TOKEN,
  stateBox, remembered, remember, markFresh, pageKeys, skeleton, skeletonItems, regionShape, loadingNote,
} from './garden.js';

// The home page: a little of every garden, one tab each. Every tab asks its garden's own API, all at once and
// on its own, so the counts fill in while you read and a slow one (GitHub, Jira) never holds up the rest.
// PR, review and ticket cards link through whole; Todoist rows check off just like on the task page.
const LIMIT = 8;
// The PR tab follows the repos you've picked on the PR page (it keeps them in localStorage).
const PR_REPOS_KEY = 'prs-repos';
const DEFAULT_PR_REPOS = ['kolide/k2'];
const TAB_KEY = 'home-tab';
// Like the task page: a checked-off task leaves at once, but Todoist only hears after the undo window.
const UNDO_MS = 6000;
const LEAVE_MS = 260;
const STAT_EMOJI = { prs: '💖', reviews: '👀', tasks: '📝', jira: '🎟️' };

const tabs = () => [...document.querySelectorAll('#home-tabs [role="tab"]')];
const names = () => tabs().map((tab) => tab.dataset.tab);
// What each tab shows once its API answers: { items, row, note, extra }. count is the items still showing.
const sections = {};
const ui = {
  tab: store.get(TAB_KEY), hidden: new Set(), pending: null, loading: 0,
  query: remembered('home-search', ''), chip: remembered('home-chips', {}), // chip: { tab name: chip key }
};
const activeTab = () => (names().includes(ui.tab) ? ui.tab : names()[0]);
// The remembered chip for a tab, if that tab still has it; otherwise the tab shows everything.
const activeChip = (name) => (sections[name]?.chips?.some((c) => c.key === ui.chip[name]) ? ui.chip[name] : undefined);
const shown = (name) => (sections[name]?.items || []).filter((item) => !ui.hidden.has(item.id));
// What the pane lists: the tab's items, narrowed by its chip and the search box.
function filtered(name) {
  const section = sections[name];
  const chip = section?.chips?.find((c) => c.key === activeChip(name));
  const query = ui.query.trim().toLowerCase();
  return shown(name)
    .filter((item) => !chip || chip.test(item))
    .filter((item) => !query || section.text(item).toLowerCase().includes(query));
}
const countOf = (name) => (sections[name]?.items ? shown(name).length : null);
const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const formatTime = (datetime) => new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(datetime));

/* ---------- rendering ---------- */

function render() {
  const active = activeTab();
  tabs().forEach((tab) => {
    const selected = tab.dataset.tab === active;
    tab.setAttribute('aria-selected', selected);
    tab.tabIndex = selected ? 0 : -1;
    tab.querySelector('[data-count]').textContent = countOf(tab.dataset.tab) ?? '';
  });
  $('#home-panel').setAttribute('aria-labelledby', `home-tab-${active}`);
  renderPanel(active);
  renderStats();
}

function renderPanel(name) {
  const section = sections[name];
  $('#home-panel').setAttribute('aria-busy', String(!section));
  const all = shown(name);
  const items = filtered(name);
  $('#home-shown').textContent = section?.items ? tp('home.shown', all.length, { shown: items.length }) : '';
  renderChips(name);
  let note = '';
  if (!section) note = ''; // the list's skeleton stands in
  else if (section.note) note = stateBox(section.failed ? 'failed' : 'empty', section.failed ? '🥀' : STAT_EMOJI[name], section.note);
  else if (section.items && !items.length) note = stateBox('empty', all.length ? '🌙' : STAT_EMOJI[name], all.length ? t('home.no_match') : section.empty);
  $('#home-note').hidden = !note;
  $('#home-note').innerHTML = note;
  $('#home-list').className = name === 'tasks' ? 'task-list' : 'home-list';
  $('#home-list').innerHTML = section ? items.slice(0, LIMIT).map(section.row || (() => '')).join('') : listSkeleton(name);
  const more = items.length > LIMIT ? tp('home.more', items.length - LIMIT) : '';
  const words = [more, section?.extra?.()].filter(Boolean).map(esc);
  const link = `<a class="link-btn" href="/${name}">${esc(t(`home.cards.${name}.open`))}</a>`;
  $('#home-foot').innerHTML = [...words, link].join(' · ');
}

function listSkeleton(name) {
  const count = regionShape($('#home-list'), [4])[0];
  return skeletonItems(count, name === 'tasks' ? 'task-row' : 'home-row', { list: true }) + loadingNote(t('home.loading'), { tag: 'li' });
}

// Chips for the tabs that have something to filter by, with counts, like the other pages.
function renderChips(name) {
  if (!sections[name]) {
    $('#home-chips').hidden = false;
    $('#home-chips').innerHTML = skeleton('chip', 3);
    return;
  }
  const chips = sections[name]?.chips;
  $('#home-chips').hidden = !chips?.length;
  if (!chips?.length) return;
  const all = [{ key: undefined, label: t('common.all'), test: () => true }, ...chips];
  $('#home-chips').innerHTML = all.map((chip) => {
    const count = shown(name).filter(chip.test).length;
    return `<button type="button" class="chip" data-chip="${chip.key ?? ''}" aria-pressed="${activeChip(name) === chip.key}">${esc(chip.label)}<span class="count">${count}</span></button>`;
  }).join('');
}

// The same stat boxes as the other pages, one per tab, filled in as each tab's API answers.
function renderStats() {
  $('#stats').innerHTML = names().map((name) => {
    const count = countOf(name);
    const label = tp(`home.stats.${name}`, count ?? 2);
    return `<div class="stat"><b>${count ?? '<span class="bone"></span>'}</b><span><span aria-hidden="true">${STAT_EMOJI[name]}</span> ${esc(label)}</span></div>`;
  }).join('');
  const allClear = names().every((name) => countOf(name) === 0);
  $('#home-summary').textContent = t(allClear ? 'home.all_clear' : 'home.tagline');
}

// text: what the search box matches against; chips: optional [{ key, label, test }].
function fill(name, { items = null, row = null, note = '', failed = false, empty = '', extra = null, text = () => '', chips = null }) {
  sections[name] = { items, row, note, failed, empty, extra, text, chips };
  render();
}

const fail = (name, result) => fill(name, { note: t('home.failed', { error: failureMessage(result) }), failed: true });

// A card that links through whole.
// ci: a checks verdict (passing / failing / pending); it sits on the card's far right.
function linkRow({ url, title, meta = [], ci = null }) {
  const badges = meta.filter(Boolean).map((text) => `<span class="mini-badge">${esc(text)}</span>`).join('');
  const status = ['passing', 'failing', 'pending'].includes(ci)
    ? `<span class="home-ci is-${ci}">${esc(t(`home.ci.${ci}`))}</span>` : '';
  return `<li><a class="home-row" href="${esc(url)}" target="_blank" rel="noopener">`
    + `<span class="home-main"><span class="home-title">${esc(title)}</span><span class="home-meta">${badges}</span></span>${status}</a></li>`;
}

const repoName = (slug) => slug.split('/').pop();

// One chip per repo in the list, busiest first. Chips are made once, from the list as it loaded.
function repoChips(items) {
  const tally = items.reduce((counts, item) => counts.set(item.repo, (counts.get(item.repo) || 0) + 1), new Map());
  return [...tally.entries()]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([repo]) => ({ key: repo, label: `📦 ${repoName(repo)}`, test: (item) => item.repo === repo }));
}

// The task page's own row: check it off, or ↗️ to open it in Todoist.
function taskRow(task) {
  const badges = [];
  if (task.overdue) badges.push(`<span class="mini-badge is-overdue">${esc(t('tasks.todoist.overdue', { date: formatDate(task.due_date) }))}</span>`);
  else if (task.due_datetime) badges.push(`<span class="mini-badge is-time">${esc(t('tasks.todoist.at_time', { time: formatTime(task.due_datetime) }))}</span>`);
  if (task.recurring) badges.push(`<span class="mini-badge">${esc(t('tasks.todoist.recurring'))}</span>`);
  if (task.project) badges.push(`<span class="mini-badge">📁 ${esc(task.project)}</span>`);
  return `
    <li class="task-row todoist-row prio-${task.priority}" data-id="${esc(task.id)}">
      <label class="task-check">
        <input type="checkbox">
        <span class="task-title">${esc(task.content)}</span>
      </label>
      <span class="task-meta">${badges.join('')}</span>
      <a class="task-open" href="${esc(task.url)}" target="_blank" rel="noopener" aria-label="${esc(t('tasks.todoist.open_label', { title: task.content }))}">↗️</a>
    </li>`;
}

function greet() {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  $('#greeting').textContent = t(`home.greeting.${part}`);
}

/* ---------- the tabs ---------- */

async function loadPrs({ refresh = false } = {}) {
  const listed = await api('/api/prs/repos');
  if (!listed.httpOk) return fail('prs', listed);
  let saved;
  try { saved = JSON.parse(store.get(PR_REPOS_KEY)) || DEFAULT_PR_REPOS; } catch { saved = DEFAULT_PR_REPOS; }
  const known = new Set((listed.repos || []).map((repo) => repo.slug));
  const slugs = saved.filter((slug) => known.has(slug));
  if (!slugs.length) return fill('prs', { items: [], empty: t('home.cards.prs.no_repos') });

  const result = await api(`/api/prs/list?${new URLSearchParams({ state: 'open', repos: slugs.join(','), ...(refresh ? { refresh: '1' } : {}) })}`);
  if (!result.httpOk) return fail('prs', result);
  const prs = result.repos.flatMap((repo) => repo.prs || []);
  const needsWork = prs.filter((pr) => pr.group === 'needs_work').length;
  const ready = prs.filter((pr) => pr.group === 'mergeable').map((pr) => ({ ...pr, id: pr.url }));
  fill('prs', {
    items: ready,
    row: (pr) => linkRow({ url: pr.url, title: pr.title, meta: [`📦 ${repoName(pr.repo)} #${pr.number}`, `🌱 ${ago(pr.updated)}`], ci: pr.checks?.verdict }),
    empty: t('home.cards.prs.empty'),
    text: (pr) => [pr.title, pr.repo, `#${pr.number}`, pr.head, ...(pr.labels || [])].join(' '),
    chips: repoChips(ready),
    extra: () => (needsWork ? tp('home.cards.prs.needs_work', needsWork) : ''),
  });
}

async function loadReviews({ refresh = false } = {}) {
  const result = await api(`/api/reviews/list${refresh ? '?refresh=1' : ''}`);
  if (!result.httpOk) return fail('reviews', result);
  if (result.ok === false) return fill('reviews', { note: t(result.error_key) });
  const requests = result.requests || [];
  const yours = requests.filter((pr) => pr.via === 'you');
  const team = requests.length - yours.length;
  const mine = yours.map((pr) => ({ ...pr, id: pr.url }));
  fill('reviews', {
    items: mine,
    row: (pr) => linkRow({ url: pr.url, title: pr.title, meta: [`📦 ${repoName(pr.repo)} #${pr.number}`, pr.author && `👤 ${pr.author}`, pr.draft && t('home.cards.reviews.draft')], ci: pr.checks?.verdict }),
    empty: t('home.cards.reviews.empty'),
    text: (pr) => [pr.title, pr.repo, `#${pr.number}`, pr.author, ...(pr.labels || [])].join(' '),
    chips: repoChips(mine),
    extra: () => (team ? tp('home.cards.reviews.team', team) : ''),
  });
}

async function loadTasks({ refresh = false } = {}) {
  const result = await api(`/api/tasks/list?tabs=late,today${refresh ? '&refresh=1' : ''}`);
  if (!result.httpOk) return fail('tasks', result);
  if (result.enabled === false) return fill('tasks', { note: t('home.cards.tasks.not_set_up') });
  // Late first, then today; a task in both shows once.
  const seen = new Set();
  const tasks = (result.sections || []).flatMap((section) => section.tasks).filter((task) => !seen.has(task.id) && seen.add(task.id));
  fill('tasks', {
    items: tasks,
    row: taskRow,
    empty: t('home.cards.tasks.empty'),
    text: (task) => [task.content, task.project, ...(task.labels || [])].join(' '),
    chips: [
      { key: 'late', label: t('tasks.todoist.tabs.late'), test: (task) => task.overdue },
      { key: 'today', label: t('tasks.todoist.tabs.today'), test: (task) => !task.overdue },
    ],
    extra: () => {
      const late = shown('tasks').filter((task) => task.overdue).length;
      return late ? tp('home.cards.tasks.late_count', late) : '';
    },
  });
}

// In progress first, then to do; within each, the most recently touched.
async function loadJira({ refresh = false } = {}) {
  const result = await api(`/api/jira/tickets?view=mine${refresh ? '&refresh=1' : ''}`);
  if (!result.httpOk) return fail('jira', result);
  const order = { indeterminate: 0, new: 1 };
  const tickets = (result.tickets || [])
    .filter((ticket) => ticket.status.category !== 'done')
    .sort((a, b) => (order[a.status.category] ?? 2) - (order[b.status.category] ?? 2) || Date.parse(b.updated) - Date.parse(a.updated));
  const going = tickets.filter((ticket) => ticket.status.category === 'indeterminate').length;
  fill('jira', {
    items: tickets.map((ticket) => ({ ...ticket, id: ticket.key })),
    row: (ticket) => linkRow({ url: ticket.url, title: `${ticket.key} ${ticket.summary}`, meta: [ticket.status.name, ticket.priority && `⚡ ${ticket.priority}`] }),
    empty: t('home.cards.jira.empty'),
    text: (ticket) => [ticket.key, ticket.summary, ticket.status.name, ...(ticket.labels || [])].join(' '),
    chips: [
      { key: 'going', label: t('home.cards.jira.chips.in_progress'), test: (ticket) => ticket.status.category === 'indeterminate' },
      { key: 'todo', label: t('home.cards.jira.chips.to_do'), test: (ticket) => ticket.status.category === 'new' },
    ],
    extra: () => (going ? tp('home.cards.jira.in_progress', going) : ''),
  });
}

const LOADERS = { prs: loadPrs, reviews: loadReviews, tasks: loadTasks, jira: loadJira };

async function loadAll({ refresh = false } = {}) {
  $('#refresh').disabled = true;
  await Promise.all(names().map((name) => LOADERS[name]({ refresh })
    .catch((error) => fill(name, { note: t('home.failed', { error: String(error) }), failed: true }))));
  $('#refresh').disabled = false;
  markFresh();
}

/* ---------- checking off tasks (same as the task page) ---------- */

async function closeTask(row) {
  const { id } = row.dataset;
  if (row.classList.contains('is-leaving')) return;
  const point = pointOf(row);
  row.classList.add('is-leaving');
  await pause(LEAVE_MS);
  sparkle(point);
  flushPending();
  ui.hidden.add(id);
  ui.pending = { id, timer: setTimeout(() => flushPending(), UNDO_MS) };
  render();
  toast(t('tasks.toasts.closed', { cheer: pick('tasks.cheers') }), 'ok', { ms: UNDO_MS });
}

// Sends the waiting close to Todoist. On the way out of the page it uses keepalive so it still arrives.
async function flushPending({ leaving = false } = {}) {
  const pending = ui.pending;
  if (!pending) return;
  ui.pending = null;
  clearTimeout(pending.timer);
  if (leaving) {
    fetch('/api/tasks/close', {
      method: 'POST', keepalive: true, body: JSON.stringify({ id: pending.id }),
      headers: { 'Content-Type': 'application/json', 'X-Garden-Token': TOKEN },
    });
    return;
  }
  const result = await api('/api/tasks/close', { id: pending.id });
  if (result.ok) {
    sections.tasks.items = sections.tasks.items.filter((task) => task.id !== pending.id);
  } else {
    toast(failureMessage(result), 'error');
  }
  ui.hidden.delete(pending.id);
  render();
}

function undo() {
  const pending = ui.pending;
  if (!pending) return toast(t('tasks.toasts.nothing_to_undo'));
  clearTimeout(pending.timer);
  ui.pending = null;
  ui.hidden.delete(pending.id);
  if (activeTab() !== 'tasks') selectTab('tasks');
  render();
  toast(t('tasks.toasts.restored'));
}

/* ---------- wiring ---------- */

function selectTab(name, { focus = false } = {}) {
  ui.tab = name;
  store.set(TAB_KEY, name);
  render();
  if (focus) document.getElementById(`home-tab-${name}`)?.focus();
}

greet();
if ($('#home-tabs')) {
  $('#home-tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) selectTab(tab.dataset.tab);
  });
  $('#home-tabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const list = names();
    const index = list.indexOf(activeTab());
    const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: list.length - 1 }[event.key];
    event.preventDefault();
    selectTab(list[(next + list.length) % list.length], { focus: true });
  });
  $('#home-list').addEventListener('change', (event) => {
    const row = event.target.closest('.task-row');
    if (row && event.target.checked) closeTask(row);
  });
  // u takes back the last check-off, as on the task page; it joins the shared key list.
  pageKeys([{ keys_html: t('tasks.help.rows.undo.keys_html'), does: t('tasks.help.rows.undo.does') }]);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'u' || event.metaKey || event.ctrlKey || event.altKey || event.target.matches?.('input[type="text"], input[type="search"], textarea')) return;
    event.preventDefault();
    undo();
  });
  window.addEventListener('pagehide', () => flushPending({ leaving: true }));
  $('#home-search').value = ui.query;
  $('#home-search').addEventListener('input', (event) => {
    ui.query = event.target.value;
    remember('home-search', ui.query);
    renderPanel(activeTab());
  });
  $('#home-chips').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-chip]');
    if (!chip) return;
    ui.chip[activeTab()] = chip.dataset.chip || undefined;
    remember('home-chips', ui.chip);
    renderPanel(activeTab());
  });
  $('#refresh').addEventListener('click', () => loadAll({ refresh: true }));
  render();
  loadAll();
}
