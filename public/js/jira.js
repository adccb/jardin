import {
  $, store, esc, ago, formatDate, t, tp, api, failureMessage, sparkle, toast, sprout, stateBox, remembered, remember, markFresh,
  skeleton, skeletonItems, regionShape, loadingNote, rememberShape,
} from './garden.js';
import { ScopePanel } from './scope-panel.js';

const CATEGORY_ORDER = { new: 0, indeterminate: 1, done: 2 };
const PRIORITY_RANK = { Highest: 0, Blocker: 0, Critical: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 };
const PRIORITY_EMOJI = { Highest: '🔥', Blocker: '🔥', Critical: '🔥', High: '🌶️', Medium: '🍵', Low: '🧊', Lowest: '💤' };
const TYPE_EMOJI = { Bug: '🐛', Story: '📖', Task: '📝', Epic: '⚡', 'Sub-task': '🧩', Subtask: '🧩', Spike: '🔬', Improvement: '✨' };
const CATEGORY_EMOJI = { new: '🌱', indeterminate: '🏃‍♀️', done: '✅' };
const STATUS_EMOJI = [[/block/i, '🚧'], [/review/i, '👀'], [/test|qa/i, '🧪']];
const statusEmoji = (status) => STATUS_EMOJI.find(([pattern]) => pattern.test(status.name))?.[1] || CATEGORY_EMOJI[status.category] || '🎈';

// A view is 'mine' or 'sprint:<id>', one tab each.
const MINE = 'mine';
const DEFAULT_SORT = { mine: 'updated', sprint: 'rank' };
const sprintView = (id) => `sprint:${id}`;
const isSprint = (view) => view.startsWith('sprint:');
const sprintIdOf = (view) => view.slice('sprint:'.length);
const kindOf = (view) => (isSprint(view) ? 'sprint' : MINE);

const ui = {
  view: store.get('jira-view') || MINE,
  results: {},
  loadIds: {},
  inFlight: 0,
  sprints: [],
  // Each tab keeps its own status chip, since sprints and your tickets have different statuses.
  statuses: remembered('jira-statuses', {}),
  status: 'all',
  lanePicks: {},
  query: remembered('jira-search', ''),
  sorts: { mine: store.get('jira-sort') || DEFAULT_SORT.mine, sprint: store.get('jira-sprint-sort') || DEFAULT_SORT.sprint },
  includeDone: store.get('jira-done') === 'yes',
  showSprintDone: store.get('jira-sprint-done') === 'yes',
};

const panel = new ScopePanel({ prefix: 'jira.panel', storeKey: 'jira-sprints', onChange: () => sprintScopeChanged() });

const views = () => [MINE, ...panel.scoped().map((sprint) => sprintView(sprint.id))];
const sprintName = (view) => ui.sprints.find((sprint) => String(sprint.id) === sprintIdOf(view))?.name || sprintIdOf(view);

const current = () => ui.results[ui.view];
const isDone = (ticket) => ticket.status.category === 'done';

// The tickets a tab is showing: sprints hide their done ones unless you ask for them.
function poolOf(view) {
  const tickets = ui.results[view]?.tickets || [];
  return isSprint(view) && !ui.showSprintDone ? tickets.filter((ticket) => !isDone(ticket)) : tickets;
}

const pool = () => poolOf(ui.view);
const typeEmoji = (ticket) => TYPE_EMOJI[ticket.type?.name] || (ticket.type?.subtask ? '🧩' : '🎟️');
const priorityRank = (ticket) => PRIORITY_RANK[ticket.priority] ?? 5;
const isHot = (ticket) => priorityRank(ticket) <= 1;

const SORTS = {
  updated: (a, b) => Date.parse(b.updated) - Date.parse(a.updated),
  priority: (a, b) => priorityRank(a) - priorityRank(b) || Date.parse(b.updated) - Date.parse(a.updated),
  created: (a, b) => Date.parse(b.created) - Date.parse(a.created),
  key: (a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }),
  rank: (a, b) => (a.position ?? 0) - (b.position ?? 0),
};

/* ---------- loading ---------- */

function viewParams(view, refresh) {
  const scope = isSprint(view) ? { view: 'sprint', sprint: sprintIdOf(view) } : { view: MINE, done: ui.includeDone ? '1' : '0' };
  return new URLSearchParams({ ...scope, ...(refresh ? { refresh: '1' } : {}) });
}

async function busy(work) {
  ui.inFlight += 1;
  $('#refresh').disabled = true;
  try { return await work; } finally {
    ui.inFlight -= 1;
    $('#refresh').disabled = ui.inFlight > 0;
  }
}

async function loadSprints({ refresh = false } = {}) {
  const result = await busy(api(`/api/jira/sprints${refresh ? '?refresh=1' : ''}`));
  if (!result.httpOk) {
    panel.fail(failureMessage(result));
    sprintScopeChanged();
    return;
  }
  ui.sprints = result.sprints;
  panel.setItems(ui.sprints.map(sprintItem));
  sprintScopeChanged();
}

function sprintItem(sprint) {
  const dates = sprint.start && sprint.end ? `${formatDate(sprint.start)} → ${formatDate(sprint.end)}` : '';
  const upcoming = sprint.state === 'future' ? t('jira.panel.upcoming') : '';
  return { id: sprint.id, name: sprint.name, detail: [upcoming, dates].filter(Boolean).join(' · '), tally: sprint.mine };
}

// Checking, unchecking or hiding a sprint: load new tabs, and leave a tab that's gone.
function sprintScopeChanged() {
  if (!views().includes(ui.view)) ui.view = MINE;
  views().filter((view) => !ui.results[view]).forEach((view) => loadView(view));
  render();
}

async function loadView(view, { refresh = false } = {}) {
  const loadId = (ui.loadIds[view] || 0) + 1;
  ui.loadIds[view] = loadId;
  if (view === ui.view && !ui.results[view]) renderLoading();
  const result = await busy(api(`/api/jira/tickets?${viewParams(view, refresh)}`));
  if (loadId !== ui.loadIds[view]) return;
  ui.results[view] = result.httpOk ? result : { failed: failureMessage(result) };
  if (result.httpOk) markFresh();
  renderTabs();
  if (view !== ui.view) return;
  render();
  sprout($('#tickets'));
}

/* ---------- rendering ---------- */

function render() {
  renderTabs();
  renderViewControls();
  const data = current();
  if (!data) return renderLoading();
  if (data.failed) return renderFailure(data.failed);
  if (!statuses().some((s) => s.name === ui.status)) ui.status = 'all';
  renderStats();
  renderFilters();
  renderSprintInfo();
  renderTickets();
}

const tabId = (view) => `jira-tab-${view.replace(':', '-')}`;

function tabLabel(view) {
  return isSprint(view) ? `<span aria-hidden="true">🏃</span> ${esc(sprintName(view))}` : `<span aria-hidden="true">🙋‍♀️</span> ${esc(t('jira.tabs.mine'))}`;
}

function renderTabs() {
  $('#jira-tabs').innerHTML = views().map((view) => {
    const selected = view === ui.view;
    const count = ui.results[view]?.tickets ? poolOf(view).length : '';
    return `<button type="button" class="tab" role="tab" id="${tabId(view)}" data-view="${esc(view)}" aria-controls="jira-panel"
      aria-selected="${selected}" tabindex="${selected ? 0 : -1}">${tabLabel(view)} <span class="tab-count">${count}</span></button>`;
  }).join('');
  $('#jira-panel').setAttribute('aria-labelledby', tabId(ui.view));
}

function renderViewControls() {
  const sprint = isSprint(ui.view);
  $('#include-done').closest('.done-toggle').hidden = sprint;
  $('#sprint-done-toggle').hidden = !sprint;
  $('#sort option[value="rank"]').hidden = !sprint;
  $('#sort').value = ui.sorts[kindOf(ui.view)];
}

// As many stat boxes as the tab will have: sprints add done and yours; your tickets add done when it's asked for.
const statCount = () => (isSprint(ui.view) ? 5 : 4 + Number(ui.includeDone));

function renderLoading() {
  $('#stats').innerHTML = skeleton('stat', statCount());
  $('#status-filters').innerHTML = skeleton('chip', 4);
  $('#shown').textContent = '';
  renderSprintInfo();
  const tickets = $('#tickets');
  tickets.innerHTML = skeletonItems(regionShape(tickets, [2])[0], 'lane') + loadingNote(t('jira.loading'));
}

function renderFailure(message) {
  renderStats({ blank: true });
  renderFilters();
  $('#shown').textContent = '';
  renderSprintInfo();
  $('#tickets').innerHTML = stateBox('failed', '🥀', message);
}

function stat(emoji, count, label) {
  return `<div class="stat"><b>${count}</b><span><span aria-hidden="true">${emoji}</span> ${esc(label)}</span></div>`;
}

// blank: the tab didn't load, so its boxes stay put with a dash for each count.
function renderStats({ blank = false } = {}) {
  const tickets = current().tickets || [];
  const count = (number) => (blank ? '–' : number);
  const inCategory = (key) => tickets.filter((ticket) => ticket.status.category === key).length;
  const stats = [
    stat('🎟️', count(tickets.length), tp('jira.stats.tickets', tickets.length)),
    stat('🌱', count(inCategory('new')), t('jira.stats.to_do')),
    stat('🏃‍♀️', count(inCategory('indeterminate')), t('jira.stats.in_progress')),
  ];
  if (isSprint(ui.view)) {
    stats.push(stat('✅', count(inCategory('done')), tp('jira.stats_sprint.done', inCategory('done'))));
    stats.push(stat('💖', count(tickets.filter((ticket) => ticket.mine).length), t('jira.stats_sprint.yours')));
  } else {
    stats.push(stat('🔥', count(tickets.filter(isHot).length), t('jira.stats.high_priority')));
    if (current().include_done ?? (blank && ui.includeDone)) stats.push(stat('✅', count(inCategory('done')), tp('jira.stats.done', inCategory('done'))));
  }
  $('#stats').innerHTML = stats.join('');
}

function statuses() {
  const byName = new Map();
  pool().forEach((ticket) => {
    const entry = byName.get(ticket.status.name) || { ...ticket.status, count: 0 };
    entry.count += 1;
    byName.set(ticket.status.name, entry);
  });
  return [...byName.values()].sort((a, b) => (CATEGORY_ORDER[a.category] ?? 1) - (CATEGORY_ORDER[b.category] ?? 1) || a.name.localeCompare(b.name));
}

function renderFilters() {
  const chip = (key, label, count) =>
    `<button type="button" class="chip" data-status="${esc(key)}" aria-pressed="${ui.status === key}">${label}<span class="count">${count}</span></button>`;
  const chips = statuses().map((s) => chip(s.name, `${statusEmoji(s)} ${esc(s.name.toLowerCase())}`, s.count));
  $('#status-filters').innerHTML = [chip('all', esc(t('common.all')), pool().length), ...chips].join('');
}

const ME = 'me';
const NOBODY = 'unassigned';
const assigneeKey = (ticket) => (ticket.mine ? ME : ticket.assignee?.name || NOBODY);

function assigneeLabel(key) {
  if (key === ME) return t('jira.you');
  if (key === NOBODY) return t('jira.unassigned');
  return `👤 ${key}`;
}

// You first, then teammates alphabetically, then unassigned.
function peopleIn(tickets) {
  const counts = new Map();
  tickets.forEach((ticket) => counts.set(assigneeKey(ticket), (counts.get(assigneeKey(ticket)) || 0) + 1));
  const rank = (key) => (key === ME ? 0 : key === NOBODY ? 2 : 1);
  return [...counts].map(([key, count]) => ({ key, count })).sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
}

const laneId = (lane) => `${ui.view}:${lane.parent?.key || ''}`;

// Each lane keeps its own person filter, falling back to everyone once that person has nothing left in it.
function laneView(lane) {
  const people = peopleIn(lane.tickets);
  const saved = ui.lanePicks[laneId(lane)];
  const picked = people.some((person) => person.key === saved) ? saved : 'all';
  const shown = picked === 'all' ? lane.tickets : lane.tickets.filter((ticket) => assigneeKey(ticket) === picked);
  return { ...lane, people, picked, shown };
}

// A sprint's dates come with its tickets, or from the sprint list while those are on their way. With neither
// yet, the line stays as the page drew it. Whether it showed is remembered, so the next first paint matches.
function renderSprintInfo() {
  const info = $('#sprint-info');
  const sprint = isSprint(ui.view) ? current()?.sprint || ui.sprints.find((s) => String(s.id) === sprintIdOf(ui.view)) : null;
  if (isSprint(ui.view) && !sprint) return;
  info.hidden = !sprint?.start || !sprint?.end;
  rememberShape('jira-sprint-info', [info.hidden ? 0 : 1]);
  if (info.hidden) return;
  info.textContent = t('jira.sprint.info', { name: sprint.name, start: formatDate(sprint.start), end: formatDate(sprint.end) });
}

function visibleTickets() {
  const query = ui.query.trim().toLowerCase();
  const haystack = (ticket) =>
    [ticket.key, ticket.summary, ticket.project.name, ticket.parent?.key, ticket.parent?.summary, ticket.assignee?.name, ...ticket.labels].join(' ').toLowerCase();
  return pool()
    .filter((ticket) => ui.status === 'all' || ticket.status.name === ui.status)
    .filter((ticket) => !query || haystack(ticket).includes(query))
    .sort(SORTS[ui.sorts[kindOf(ui.view)]] || SORTS[DEFAULT_SORT[kindOf(ui.view)]]);
}

function renderTickets() {
  const lanes = swimlanes(visibleTickets()).map(laneView);
  const shown = lanes.reduce((total, lane) => total + lane.shown.length, 0);
  $('#shown').textContent = tp('jira.shown', pool().length, { shown });
  $('#tickets').innerHTML = lanes.length ? lanes.map(laneHtml).join('') : emptyState();
}

// One lane per parent ticket, in the order parents first appear in the sorted list; parentless tickets go last.
function swimlanes(tickets) {
  const lanes = new Map();
  tickets.forEach((ticket) => {
    const key = ticket.parent?.key || '';
    if (!lanes.has(key)) lanes.set(key, { parent: ticket.parent || null, tickets: [] });
    lanes.get(key).tickets.push(ticket);
  });
  const orphans = lanes.get('');
  lanes.delete('');
  return orphans ? [...lanes.values(), orphans] : [...lanes.values()];
}

function laneHead(parent) {
  if (!parent) return `<span class="lane-parent is-orphan">${esc(t('jira.lanes.no_parent'))}</span>`;
  const emoji = TYPE_EMOJI[parent.type] || '🎟️';
  return `
    <button type="button" class="lane-parent" data-parent-key="${esc(parent.key)}" aria-haspopup="dialog"
            aria-label="${esc(t('jira.lanes.open_parent', { key: parent.key }))} · ${esc(parent.summary)}">
      <span aria-hidden="true">${emoji}</span><span class="lane-key">${esc(parent.key)}</span><span class="lane-title">${esc(parent.summary)}</span>
    </button>
    ${parent.status?.name ? statusBadge(parent.status) : ''}`;
}

// A lone person's chip doubles as the lane's count; with several people there's an "everyone" chip too.
function lanePeople(lane) {
  const alone = lane.people.length === 1;
  const chip = (key, label, count) =>
    `<button type="button" class="chip" data-lane-person="${esc(key)}" aria-pressed="${alone || lane.picked === key}">${esc(label)}<span class="count">${count}</span></button>`;
  const everyone = alone ? [] : [chip('all', t('jira.assignees.everyone'), lane.tickets.length)];
  const people = lane.people.map((person) => chip(person.key, assigneeLabel(person.key), person.count));
  return `<div class="chips lane-people" role="group" aria-label="${esc(t('jira.assignees.label'))}">${[...everyone, ...people].join('')}</div>`;
}

function laneHtml(lane) {
  return `
    <section class="lane" data-lane="${esc(laneId(lane))}" aria-label="${esc(lane.parent ? `${lane.parent.key} ${lane.parent.summary}` : t('jira.lanes.no_parent'))}">
      <header class="lane-head">
        ${laneHead(lane.parent)}
        ${lanePeople(lane)}
      </header>
      <div class="lane-track">${lane.shown.map(ticketCard).join('')}</div>
    </section>`;
}

function emptyState() {
  if (pool().length > 0) return stateBox('empty', '🌙', t('jira.empty.no_match'));
  if (isSprint(ui.view)) {
    const message = current().tickets.length > 0 ? t('jira.sprint.all_done') : t('jira.sprint.empty');
    return stateBox('empty', '🏖️', message);
  }
  return stateBox('empty', '🏝️', t('jira.empty.nothing_assigned'));
}

function statusBadge(status) {
  return `<span class="badge b-status-${esc(status.category)}">${statusEmoji(status)} ${esc(status.name.toLowerCase())}</span>`;
}

function assigneeBadge(ticket) {
  if (ticket.mine) return `<span class="badge b-pink">${esc(t('jira.you'))}</span>`;
  if (!ticket.assignee) return `<span class="badge b-lav">${esc(t('jira.unassigned'))}</span>`;
  return `<span class="badge b-lav">👤 ${esc(ticket.assignee.name)}</span>`;
}

function ticketBadges(ticket) {
  const badges = [statusBadge(ticket.status)];
  if (isSprint(ui.view) && 'assignee' in ticket) badges.push(assigneeBadge(ticket));
  if (ticket.priority) badges.push(`<span class="badge ${isHot(ticket) ? 'b-coral' : 'b-lav'}">${PRIORITY_EMOJI[ticket.priority] || '🎈'} ${esc(ticket.priority.toLowerCase())}</span>`);
  if (ticket.project?.key) badges.push(`<span class="badge b-pink">📁 ${esc(ticket.project.key)}</span>`);
  if (ticket.due) badges.push(`<span class="badge b-gold">${esc(t('jira.due', { date: formatDate(ticket.due) }))}</span>`);
  (ticket.labels || []).slice(0, 3).forEach((label) => badges.push(`<span class="badge b-mint">🏷️ ${esc(label)}</span>`));
  return badges.join('');
}

function ticketCard(ticket) {
  return `
    <button type="button" class="card ticket${ticket.mine && isSprint(ui.view) ? ' is-mine' : ''}" data-key="${esc(ticket.key)}" aria-haspopup="dialog">
      <span class="card-top">
        <span class="ticket-key">${esc(ticket.key)}</span>
        <span class="type" role="img" aria-label="${esc(ticket.type.name)}" title="${esc(ticket.type.name)}">${typeEmoji(ticket)}</span>
      </span>
      <h3>${esc(ticket.summary)}</h3>
      <span class="badges">${ticketBadges(ticket)}</span>
      <span class="card-foot"><span class="age" title="${esc(ticket.updated)}">${esc(t('jira.updated', { ago: ago(ticket.updated) }))}</span></span>
    </button>`;
}

/* ---------- drawer ---------- */

const drawer = $('#drawer');

// Parents usually aren't in the list, so the lane's own details fill the drawer until Jira answers.
function placeholderFor(key) {
  const listed = Object.values(ui.results).flatMap((data) => data?.tickets || []).find((ticket) => ticket.key === key);
  if (listed) return listed;
  const parent = current()?.tickets?.find((ticket) => ticket.parent?.key === key)?.parent;
  return {
    key, summary: parent?.summary || key, type: { name: parent?.type }, status: parent?.status || { name: '', category: 'new' },
    priority: parent?.priority, project: { key: key.split('-')[0] }, labels: [], url: `${current()?.site || ''}/browse/${key}`,
  };
}

async function openTicket(key) {
  fillDrawerHeader(placeholderFor(key));
  $('#drawer-body').innerHTML = `<p class="adf-empty"><span aria-hidden="true">☕</span> ${esc(t('jira.drawer.fetching'))}</p>`;
  drawer.showModal();
  sparkle({ x: innerWidth - 80, y: 60 });

  const result = await api(`/api/jira/ticket?key=${encodeURIComponent(key)}`);
  if (!drawer.open || $('#drawer-key').textContent !== key) return;
  if (!result.httpOk) {
    $('#drawer-body').innerHTML = `<p class="adf-empty">🥺 ${esc(failureMessage(result))}</p>`;
    return;
  }
  fillDrawerHeader(result.ticket);
  $('#drawer-body').innerHTML = result.description_html || `<p class="adf-empty"><span aria-hidden="true">🔮</span> ${esc(t('jira.drawer.no_description'))}</p>`;
}

function fillDrawerHeader(ticket) {
  $('#drawer-key').textContent = ticket.key;
  $('#drawer-title').textContent = `${typeEmoji(ticket)} ${ticket.summary}`;
  const created = ticket.created ? `<span class="badge b-lav">${esc(t('jira.created', { ago: ago(ticket.created) }))}</span>` : '';
  $('#drawer-badges').innerHTML = `${ticketBadges(ticket)}${created}`;
  $('#drawer-link').href = ticket.url;
}

/* ---------- tabs ---------- */

function selectView(view, { focus = false } = {}) {
  ui.view = view;
  ui.status = ui.statuses[view] || 'all';
  store.set('jira-view', view);
  render();
  if (!ui.results[view]) loadView(view);
  if (focus) document.getElementById(tabId(view))?.focus();
}

function viewForKey(key) {
  const all = views();
  const index = all.indexOf(ui.view);
  if (key === 'ArrowLeft') return all[(index - 1 + all.length) % all.length];
  if (key === 'ArrowRight') return all[(index + 1) % all.length];
  if (key === 'Home') return all[0];
  if (key === 'End') return all.at(-1);
  return null;
}

/* ---------- wiring ---------- */

$('#jira-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[role="tab"]');
  if (tab) selectView(tab.dataset.view, { focus: true });
});

$('#jira-tabs').addEventListener('keydown', (event) => {
  const view = viewForKey(event.key);
  if (!view) return;
  event.preventDefault();
  selectView(view, { focus: true });
});

$('#refresh').addEventListener('click', () => {
  loadSprints({ refresh: true });
  loadView(ui.view, { refresh: true });
});

$('#include-done').checked = ui.includeDone;
$('#include-done').addEventListener('change', (event) => {
  ui.includeDone = event.target.checked;
  store.set('jira-done', ui.includeDone ? 'yes' : 'no');
  if (ui.includeDone) toast(t('jira.toast.fetching_done'));
  loadView('mine');
});

$('#show-sprint-done').checked = ui.showSprintDone;
$('#show-sprint-done').addEventListener('change', (event) => {
  ui.showSprintDone = event.target.checked;
  store.set('jira-sprint-done', ui.showSprintDone ? 'yes' : 'no');
  render();
});

ui.status = ui.statuses[ui.view] || 'all';
$('#search').value = ui.query;

$('#search').addEventListener('input', (event) => {
  ui.query = event.target.value;
  remember('jira-search', ui.query);
  if (current()?.tickets) renderTickets();
});

$('#sort').addEventListener('change', (event) => {
  ui.sorts[kindOf(ui.view)] = event.target.value;
  store.set(isSprint(ui.view) ? 'jira-sprint-sort' : 'jira-sort', event.target.value);
  renderTickets();
});

$('#status-filters').addEventListener('click', (event) => {
  const chip = event.target.closest('[data-status]');
  if (!chip) return;
  ui.status = chip.dataset.status;
  ui.statuses[ui.view] = ui.status;
  remember('jira-statuses', ui.statuses);
  renderFilters();
  renderTickets();
});

$('#tickets').addEventListener('click', (event) => {
  const chip = event.target.closest('[data-lane-person]');
  if (!chip) return;
  const lane = chip.closest('[data-lane]').dataset.lane;
  ui.lanePicks[lane] = chip.dataset.lanePerson;
  renderTickets();
  const again = [...document.querySelectorAll('[data-lane]')].find((section) => section.dataset.lane === lane);
  [...(again?.querySelectorAll('[data-lane-person]') || [])].find((button) => button.dataset.lanePerson === chip.dataset.lanePerson)?.focus();
});

$('#tickets').addEventListener('click', (event) => {
  const target = event.target.closest('[data-key], [data-parent-key]');
  if (target) openTicket(target.dataset.key || target.dataset.parentKey);
});

$('#drawer-close').addEventListener('click', () => drawer.close());
drawer.addEventListener('click', (event) => { if (event.target === drawer) drawer.close(); });

// The saved tab may be a sprint; it stays put until the sprint list says whether it's still in scope.
render();
loadView(MINE);
if (isSprint(ui.view)) loadView(ui.view);
loadSprints();
