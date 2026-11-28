import {
  $, STALE_DAYS, store, esc, ageDays, t, tp, pick, ago, ageEmoji, api, failureMessage,
  sparkle, pointOf, toast, openDialog, setDialogBusy, dialogItem, toggle, sprout, stateBox, remembered, remember, markFresh,
  skeleton, skeletonItems, regionShape, loadingNote, rememberShape,
} from './garden.js';
import { ScopePanel } from './scope-panel.js';

const PAGE = $('[data-garden]').dataset.garden;
// The default branch never shows: it can't be tidied, and neither can the main checkout or a worktree on it.
const shownBranches = (state) => state.branches.filter((b) => !b.default);
const shownWorktrees = (state) => state.worktrees.filter((w) => !w.main && w.branch !== state.default_branch);
const pageItems = (state) => (PAGE === 'branches' ? shownBranches(state) : shownWorktrees(state));

const newBed = (name) => ({
  filter: remembered(`${name}-filter`, 'all'), query: remembered(`${name}-search`, ''),
  sort: store.get(`${name}-sort`) || 'oldest', selected: new Set(),
});
// Runs both the branch page and the worktree page: each shows one bed (its `data-garden`), one tab per repo in scope.
// states: the last snapshot of each in-scope repo, by path. errors: why a repo didn't load, by path.
// data: the open tab's snapshot, every branch and worktree tagged with its repo.
const ui = {
  repos: [], states: {}, errors: {}, generations: {}, pending: 0, data: null, home: '',
  repoTab: store.get(`${PAGE}-repo-tab`),
  beds: { branches: newBed('branches'), worktrees: newBed('worktrees') },
};

const SCOPE_KEY = `${PAGE}-repos`;
const panel = new ScopePanel({ prefix: 'branches.panel', storeKey: SCOPE_KEY, onChange: () => scopeChanged() });
const scopedPaths = () => panel.scoped().map((repo) => repo.id);
const activeRepo = () => (scopedPaths().includes(ui.repoTab) ? ui.repoTab : scopedPaths()[0] || null);
const isLoading = (path) => Boolean(path && !ui.states[path] && !ui.errors[path]);

const tildify = (path) => (ui.home && path.startsWith(ui.home) ? `~${path.slice(ui.home.length)}` : path);
const branchKey = (repo, name) => `${repo}::${name}`;
const branchByKey = (key) => ui.data?.branches.find((b) => b.key === key);
const worktreeByPath = (path) => ui.data?.worktrees.find((w) => w.path === path);
const isMerged = (b) => !b.default && (b.pr?.state === 'MERGED' || b.merged);
const isStale = (b) => ageDays(b.date) > STALE_DAYS;
const canDelete = (b) => !b.default && !b.current && !b.worktree;
const canRemove = (w) => !w.main && !w.missing;
const ownsDeletableBranch = (w) => !!w.info && !w.info.default;
const worktreeTime = (w) => (w.info ? Date.parse(w.info.date) : 0);

function lockReason(b) {
  if (b.default) return t('branches.lock.default');
  if (b.worktree) return t('branches.lock.worktree', { path: tildify(b.worktree) });
  return t('branches.lock.current');
}

const code = (text) => `<code>${esc(text)}</code>`;
const gitSays = (result) => `<p>${esc(t('branches.dialogs.git_says'))}</p><pre>${esc(failureMessage(result))}</pre>`;

/* ---------- beds: branches & worktrees share filters, sort, search, selection ---------- */

const BEDS = {
  branches: {
    items: () => ui.data.branches,
    key: (b) => b.key,
    selectable: canDelete,
    matches: (b, query) => b.name.toLowerCase().includes(query) || b.subject.toLowerCase().includes(query),
    card: (b) => branchCard(b),
    empty: () => branchesEmptyState(),
    filters: [
      { key: 'all', label: t('common.all'), test: () => true },
      { key: 'merged', label: t('branches.filters.branches.merged'), test: isMerged },
      { key: 'gone', label: t('branches.filters.branches.gone'), test: (b) => b.gone },
      { key: 'closed', label: t('branches.filters.branches.closed'), test: (b) => b.pr?.state === 'CLOSED' },
      { key: 'open', label: t('branches.filters.branches.open'), test: (b) => b.pr?.state === 'OPEN' },
      { key: 'stale', label: t('branches.filters.branches.stale', { days: STALE_DAYS }), test: isStale },
      { key: 'worktree', label: t('branches.filters.branches.worktree'), test: (b) => !!b.worktree },
      { key: 'nopr', label: t('branches.filters.branches.nopr'), test: (b) => b.prInfo && !b.pr, needsPrs: true },
    ],
    sorts: {
      oldest: (a, b) => Date.parse(a.date) - Date.parse(b.date),
      newest: (a, b) => Date.parse(b.date) - Date.parse(a.date),
      name: (a, b) => a.name.localeCompare(b.name),
      behind: (a, b) => (b.behind ?? 0) - (a.behind ?? 0),
    },
  },
  worktrees: {
    items: () => ui.data.worktrees,
    key: (w) => w.path,
    selectable: canRemove,
    matches: (w, query) => w.path.toLowerCase().includes(query) || (w.branch || '').toLowerCase().includes(query),
    card: (w) => worktreeCard(w),
    empty: () => worktreesEmptyState(),
    filters: [
      { key: 'all', label: t('common.all'), test: () => true },
      { key: 'merged', label: t('branches.filters.worktrees.merged'), test: (w) => !!w.info && isMerged(w.info) },
      { key: 'closed', label: t('branches.filters.worktrees.closed'), test: (w) => w.info?.pr?.state === 'CLOSED' },
      { key: 'open', label: t('branches.filters.worktrees.open'), test: (w) => w.info?.pr?.state === 'OPEN' },
      { key: 'clean', label: t('branches.filters.worktrees.clean'), test: (w) => !w.missing && w.dirty === 0 },
      { key: 'dirty', label: t('branches.filters.worktrees.dirty'), test: (w) => w.dirty > 0 },
      { key: 'stale', label: t('branches.filters.worktrees.stale', { days: STALE_DAYS }), test: (w) => !!w.info && isStale(w.info) },
      { key: 'detached', label: t('branches.filters.worktrees.detached'), test: (w) => w.detached },
      { key: 'ghost', label: t('branches.filters.worktrees.ghost'), test: (w) => w.missing || w.prunable },
    ],
    sorts: {
      oldest: (a, b) => worktreeTime(a) - worktreeTime(b),
      newest: (a, b) => worktreeTime(b) - worktreeTime(a),
      name: (a, b) => (a.branch || a.path).localeCompare(b.branch || b.path),
      dirty: (a, b) => b.dirty - a.dirty,
    },
  },
};

function visibleItems(bedName) {
  const bed = BEDS[bedName];
  const state = ui.beds[bedName];
  const filter = bed.filters.find((f) => f.key === state.filter) || bed.filters[0];
  const query = state.query.trim().toLowerCase();
  const sort = bed.sorts[state.sort] || bed.sorts.oldest;
  return bed.items()
    .filter(filter.test)
    .filter((item) => !query || bed.matches(item, query))
    .sort((a, b) => (b.main === true) - (a.main === true) || sort(a, b));
}

const isGitFailure = (result) => result.output !== undefined && !result.ok;
const deleteBranchRequest = (b, force) => api('/api/branches/delete-branch', { repo: b.repo, branch: b.name, force });
const removeWorktreeRequest = (w, force) => api('/api/branches/remove-worktree', { repo: w.repo, path: w.path, force });

/* ---------- loading ---------- */

// The folder a repo lives in, home shortened to ~, so same-named repos can be told apart.
const repoFolder = (path) => path.slice(0, path.lastIndexOf('/')).replace(/^\/(Users|home)\/[^/]+/, '~') || '/';
const repoName = (path) => ui.repos.find((r) => r.path === path)?.name || path;

async function loadRepos() {
  const result = await api('/api/branches/repos');
  if (!result.httpOk) return panel.fail(failureMessage(result));
  ui.repos = result.repos || [];
  seedScope();
  panel.setItems(ui.repos.map((r) => ({ id: r.path, name: r.name, detail: repoFolder(r.path) })));
  if (scopedPaths().length) await loadState();
  else render();
}

// The panel shows every repo it finds, but snapshotting all of them at once is slow, so the first
// visit starts with just one in scope: the repo the old picker last showed, or the first one.
function seedScope() {
  if (store.get(`${SCOPE_KEY}-excluded`) !== null || !ui.repos.length) return;
  const start = ui.repos.find((r) => r.path === store.get('repo'))?.path || ui.repos[0].path;
  panel.excluded = new Set(ui.repos.map((r) => r.path).filter((path) => path !== start));
  store.set(`${SCOPE_KEY}-excluded`, JSON.stringify([...panel.excluded]));
}

// Fetches a fresh snapshot of each repo (all in-scope repos by default). Each repo keeps its own
// generation number, so an older answer for a repo never overwrites a newer one.
async function loadState({ repos = scopedPaths(), refresh = false, quiet = false } = {}) {
  if (!repos.length) return render();
  if (!quiet) renderLoading();
  ui.pending += 1;
  $('#refresh').disabled = true;
  await Promise.all(repos.map(async (repo) => {
    const generation = (ui.generations[repo] || 0) + 1;
    ui.generations[repo] = generation;
    const result = await api(`/api/branches/state?repo=${encodeURIComponent(repo)}${refresh ? '&refresh=1' : ''}`);
    if (generation !== ui.generations[repo]) return;
    if (result.httpOk) {
      ui.states[repo] = result;
      delete ui.errors[repo];
    } else {
      delete ui.states[repo];
      ui.errors[repo] = t('branches.toasts.load_failed', { repo: repoName(repo), error: failureMessage(result) });
      toast(ui.errors[repo], 'error');
    }
  }));
  ui.pending -= 1;
  $('#refresh').disabled = ui.pending > 0;
  if (repos.some((repo) => ui.states[repo])) markFresh();
  render();
  if (!quiet) sprout($(`#${PAGE}`));
}

function scopeChanged() {
  const scoped = scopedPaths();
  // Forget repos that left scope, so bringing one back fetches it fresh.
  Object.keys(ui.states).filter((path) => !scoped.includes(path)).forEach((path) => delete ui.states[path]);
  Object.keys(ui.errors).filter((path) => !scoped.includes(path)).forEach((path) => delete ui.errors[path]);
  const missing = scoped.filter((path) => !ui.states[path] && !ui.errors[path]);
  const showing = scoped.length > missing.length;
  if (showing || !missing.length) render();
  if (missing.length) loadState({ repos: missing, quiet: showing });
}

// The open tab's snapshot, tagged so actions know which repo they're in.
function combine() {
  const state = ui.states[activeRepo()];
  ui.home = state?.home || Object.values(ui.states)[0]?.home || ui.home;
  const tag = state ? { repo: state.repo, repoName: state.name, base: state.default_branch, prInfo: state.pr_info } : {};
  ui.data = {
    branches: state ? shownBranches(state).map((b) => ({ ...b, ...tag, key: branchKey(state.repo, b.name) })) : [],
    worktrees: state ? shownWorktrees(state).map((w) => ({ ...w, ...tag })) : [],
    prInfo: Boolean(state?.pr_info),
  };
  linkWorktreesToBranches();
  keepSelectableSelections();
}

function linkWorktreesToBranches() {
  ui.data.worktrees.forEach((w) => { w.info = branchByKey(branchKey(w.repo, w.branch)); });
}

function keepSelectableSelections() {
  Object.entries(BEDS).forEach(([name, bed]) => {
    const selectable = new Set(bed.items().filter(bed.selectable).map(bed.key));
    const state = ui.beds[name];
    state.selected = new Set([...state.selected].filter((key) => selectable.has(key)));
  });
}

function forgetBranch(b) {
  const state = ui.states[b.repo];
  if (state) state.branches = state.branches.filter((other) => other.name !== b.name);
  ui.beds.branches.selected.delete(b.key);
}

/* ---------- rendering ---------- */

function render() {
  combine();
  renderStats();
  renderRepoTabs();
  renderBed(PAGE);
  renderBulkbar();
}

const emptyState = (emoji, message) => stateBox('empty', emoji, message);
const CARD_SKELETON = { branches: 'branch-card', worktrees: 'worktree-card' };
const loadingState = () => skeletonItems(regionShape($(`#${PAGE}`), [4])[0], CARD_SKELETON[PAGE]) + loadingNote(t('branches.loading'));

function renderLoading() {
  $(`#${PAGE}`).innerHTML = loadingState();
}

// When there's no repo to show (none in scope, still loading, or it failed), both sections say why.
function scopeEmptyState() {
  if (!ui.repos.length) return emptyState('🏜️', t('branches.no_repos'));
  const repo = activeRepo();
  if (!repo) return emptyState('🌙', t('branches.nothing_in_scope'));
  if (ui.errors[repo]) return stateBox('failed', '🥀', ui.errors[repo]);
  if (!ui.states[repo]) return loadingState();
  return null;
}

// The stats add up every repo in scope; the tabs below show one repo at a time.
function renderStats() {
  if (scopedPaths().some(isLoading)) {
    $('#stats').innerHTML = skeleton('stat', 4);
    return;
  }
  const states = scopedPaths().map((path) => ui.states[path]).filter(Boolean);
  const noPrInfo = states.filter((state) => !state.pr_info).map((state) => state.name);
  const stats = PAGE === 'branches' ? branchStats(states) : worktreeStats(states);
  $('#stats').innerHTML = stats
    .map(([emoji, count, key]) => `<div class="stat"><b>${count}</b><span><span aria-hidden="true">${emoji}</span> ${esc(tp(`branches.stats.${key}`, count))}</span></div>`)
    .join('');
  $('#pr-note').hidden = !noPrInfo.length;
  $('#pr-note').textContent = t('branches.pr_note', { repos: noPrInfo.join(', ') });
}

function branchStats(states) {
  const branches = states.flatMap(shownBranches);
  return [
    ['🌿', branches.length, 'branches'],
    ['💖', branches.filter(isMerged).length, 'merged'],
    ['👻', branches.filter((b) => b.gone).length, 'gone'],
    ['🕸️', branches.filter(isStale).length, 'stale'],
  ];
}

function worktreeStats(states) {
  const worktrees = states.flatMap((state) => shownWorktrees(state).map((w) => ({ ...w, info: state.branches.find((b) => b.name === w.branch) })));
  return [
    ['🏡', worktrees.length, 'worktrees'],
    ['🧺', worktrees.filter((w) => w.dirty > 0).length, 'unsaved'],
    ['💖', worktrees.filter((w) => w.info && isMerged(w.info)).length, 'merged'],
    ['👻', worktrees.filter((w) => w.missing || w.prunable).length, 'ghosts'],
  ];
}

function renderRepoTabs() {
  const active = activeRepo();
  $('#repo-tabs').innerHTML = scopedPaths().map((path, index) => {
    const selected = path === active;
    const count = ui.states[path] ? pageItems(ui.states[path]).length : '';
    return `<button type="button" class="tab" role="tab" id="repo-tab-${index}" data-repo="${esc(path)}" aria-controls="repo-tab-panel"
      aria-selected="${selected}" tabindex="${selected ? 0 : -1}">🪴 ${esc(repoName(path))} <span class="tab-count">${count}</span></button>`;
  }).join('');
  const index = scopedPaths().indexOf(active);
  if (index === -1) $('#repo-tab-panel').removeAttribute('aria-labelledby');
  else $('#repo-tab-panel').setAttribute('aria-labelledby', `repo-tab-${index}`);
}


function renderBed(bedName) {
  renderFilters(bedName);
  renderItems(bedName);
  if (bedName === 'worktrees' && !isLoading(activeRepo())) renderPrune();
}

// Whether it showed is remembered, so the next first paint leaves its room in the toolbar.
function renderPrune() {
  $('#prune').hidden = !ui.data.worktrees.some((w) => w.prunable || w.missing);
  rememberShape('worktrees-prune', [Number(!$('#prune').hidden)]);
}

function renderFilters(bedName) {
  const bed = BEDS[bedName];
  const state = ui.beds[bedName];
  if (isLoading(activeRepo())) {
    $(`#${bedName}-filters`).innerHTML = skeleton('chip', 4);
    return;
  }
  $(`#${bedName}-filters`).innerHTML = bed.filters
    .filter((f) => ui.data.prInfo || !f.needsPrs)
    .map((f) => {
      const count = bed.items().filter(f.test).length;
      return `<button type="button" class="chip" data-filter="${f.key}" aria-pressed="${state.filter === f.key}">${esc(f.label)}<span class="count">${count}</span></button>`;
    })
    .join('');
}

function renderItems(bedName) {
  const items = visibleItems(bedName);
  const total = BEDS[bedName].items().length;
  $(`#${bedName}-shown`).textContent = isLoading(activeRepo()) ? '' : tp(`branches.toolbar.${bedName}.shown`, total, { shown: items.length });
  $(`#${bedName}`).innerHTML = items.length ? items.map(BEDS[bedName].card).join('') : scopeEmptyState() || BEDS[bedName].empty();
}

function picker(bedName, key, label) {
  const checked = ui.beds[bedName].selected.has(key);
  return `<label class="pick"><input type="checkbox" data-action="select" ${checked ? 'checked' : ''} aria-label="${esc(t('branches.select_item', { label }))}"></label>`;
}

function branchesEmptyState() {
  const nothingDeletable = ui.data.branches.every((b) => !canDelete(b));
  const { filter, query } = ui.beds.branches;
  if (nothingDeletable && filter === 'all' && !query) return emptyState('🌈🦄', t('branches.empty.tidy'));
  return emptyState('🌙', t('branches.empty.branches'));
}

function worktreesEmptyState() {
  const { filter, query } = ui.beds.worktrees;
  if (!ui.data.worktrees.length && filter === 'all' && !query) return emptyState('🏡', t('branches.empty.no_worktrees'));
  return emptyState('🌙', t('branches.empty.worktrees'));
}

const badge = (klass, text, title) => `<span class="badge ${klass}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;
const button = (action, text, { danger = false, extra = '' } = {}) =>
  `<button type="button" class="btn btn-small${danger ? ' btn-danger' : ''}" data-action="${action}"${extra}>${esc(text)}</button>`;

function branchCard(b) {
  const selected = ui.beds.branches.selected.has(b.key);
  const lead = canDelete(b)
    ? picker('branches', b.key, b.name)
    : `<span class="lock" role="img" title="${esc(lockReason(b))}" aria-label="${esc(lockReason(b))}">${b.default ? '👑' : b.worktree ? '🔒' : '📍'}</span>`;
  const deleteButton = canDelete(b) ? button('delete-branch', t('branches.card.delete'), { danger: true }) : '';
  return `
    <article class="card${selected ? ' is-selected' : ''}" data-key="${esc(b.key)}">
      <div class="card-top">${lead}<h3>${esc(b.name)}</h3></div>
      <p class="subject">${esc(b.subject)}</p>
      <div class="badges">${branchBadges(b)}</div>
      <div class="card-foot">
        <span class="age" title="${esc(b.date)}"><span aria-hidden="true">${ageEmoji(b.date)}</span> ${esc(ago(b.date))}</span>
        ${deleteButton}
      </div>
    </article>`;
}

const PR_STYLES = { MERGED: ['b-pink', 'pr_merged'], OPEN: ['b-mint', 'pr_open'], CLOSED: ['b-coral', 'pr_closed'] };

function prBadge(pr) {
  if (!pr) return '';
  const style = PR_STYLES[pr.state];
  const [klass, label] = style
    ? [style[0], t(`branches.badges.${style[1]}`, { number: pr.number })]
    : ['b-lav', `${pr.state.toLowerCase()} #${pr.number}`];
  return `<a class="badge ${klass}" href="${esc(pr.url)}" target="_blank" rel="noopener" title="${esc(pr.title)}">${esc(label)}</a>`;
}

function branchBadges(b) {
  const badges = [];
  if (b.default) badges.push(badge('b-gold', t('branches.badges.default')));
  if (b.current) badges.push(badge('b-lav', t('branches.badges.checked_out')));
  badges.push(prBadge(b.pr));
  if (b.merged && !b.default && b.pr?.state !== 'MERGED') badges.push(badge('b-pink', t('branches.badges.merged_in_git')));
  if (b.gone) badges.push(badge('b-lav', t('branches.badges.upstream_gone')));
  else if (!b.upstream && !b.default) badges.push(badge('b-gold', t('branches.badges.local_only')));
  if (b.ahead !== null && b.ahead !== undefined && !b.default) badges.push(aheadBehindBadge(b));
  if (b.worktree) badges.push(badge('b-lav', `🏡 ${tildify(b.worktree)}`));
  return badges.join('');
}

function aheadBehindBadge(b) {
  const tooltip = t('branches.badges.ahead_behind', { ahead: b.ahead, behind: b.behind, base: b.base });
  return badge('b-mint', `⬆️ ${b.ahead} ⬇️ ${b.behind}`, tooltip);
}

function worktreeCard(w) {
  const selected = ui.beds.worktrees.selected.has(w.path);
  const title = w.branch ? esc(w.branch) : esc(t('branches.card.detached_at', { head: w.head }));
  const lead = canRemove(w) ? picker('worktrees', w.path, tildify(w.path)) : `<span class="lock" aria-hidden="true">${w.main ? '🏰' : '🍂'}</span>`;
  return `
    <article class="card${selected ? ' is-selected' : ''}" data-key="${esc(w.path)}">
      <div class="card-top">${lead}<h3>${title}</h3></div>
      <p class="path">${esc(tildify(w.path))}</p>
      <div class="badges">${worktreeBadges(w)}</div>
      ${w.main ? '' : worktreeActions(w)}
    </article>`;
}

function worktreeBadges(w) {
  const badges = [];
  if (w.main) badges.push(badge('b-gold', t('branches.badges.main_checkout')));
  if (w.missing) badges.push(badge('b-coral', t('branches.badges.folder_gone')));
  else if (w.dirty > 0) badges.push(badge('b-coral', tp('branches.badges.unsaved', w.dirty)));
  else badges.push(badge('b-mint', t('branches.badges.clean')));
  if (w.prunable) badges.push(badge('b-lav', t('branches.badges.prunable')));
  if (w.locked) badges.push(badge('b-gold', t('branches.badges.locked')));
  if (w.info) {
    badges.push(prBadge(w.info.pr));
    badges.push(`<span class="badge b-lav"><span aria-hidden="true">${ageEmoji(w.info.date)}</span> ${esc(ago(w.info.date))}</span>`);
  }
  return badges.join('');
}

function worktreeActions(w) {
  if (w.missing) return `<div class="card-foot"><span class="age">${esc(t('branches.card.ghost_hint'))}</span></div>`;
  const withBranch = ownsDeletableBranch(w)
    ? button('remove-worktree', t('branches.card.remove_with_branch'), { danger: true, extra: ' data-with-branch="1"' })
    : '';
  return `
    <div class="card-foot"><span></span><div class="actions">
      ${button('remove-worktree', t('branches.card.remove'))}
      ${withBranch}
    </div></div>`;
}

function renderBulkbar() {
  const count = ui.beds[PAGE].selected.size;
  $('#bulkbar').hidden = count === 0;
  $('#bulk-count').innerHTML = `<span aria-hidden="true">💝</span> ${esc(tp('branches.bulkbar.picked', count))}`;
  $(`#bulk-tidy-${PAGE}`).textContent = tp(`branches.bulkbar.tidy_${PAGE}`, count);
}

function rerenderSelection(bedName) {
  renderItems(bedName);
  renderBulkbar();
}

const goodbye = (name) => pick('branches.goodbyes').replace('%{name}', () => name);

/* ---------- single actions ---------- */

async function deleteBranch(key, point, force = false) {
  const b = branchByKey(key);
  if (!b) return false;
  const result = await deleteBranchRequest(b, force);
  if (result.ok) {
    sparkle(point);
    toast(goodbye(b.name));
    forgetBranch(b);
    render();
    return true;
  }
  const unmerged = /not fully merged/i.test(failureMessage(result));
  if (!force && unmerged && (await confirmForceDelete(b, result))) return deleteBranch(key, point, true);
  if (force || !unmerged) toast(t('branches.toasts.delete_failed', { name: b.name, error: failureMessage(result) }), 'error');
  return false;
}

function confirmForceDelete(b, result) {
  const squashed = b.pr?.state === 'MERGED';
  const advice = t(squashed ? 'branches.dialogs.force_delete.squashed' : 'branches.dialogs.force_delete.unmerged');
  return openDialog({
    title: t('branches.dialogs.force_delete.title', { name: b.name }),
    body: `${gitSays(result)}<p>${esc(advice)}</p>`,
    confirm: t('branches.dialogs.force_delete.confirm'),
    danger: true,
  });
}

async function removeWorktree(path, withBranch, point) {
  const worktree = worktreeByPath(path);
  const commands = [`git worktree remove ${tildify(path)}`];
  if (withBranch) commands.push(`git branch -d ${worktree.branch}`);
  const confirmed = await openDialog({
    title: t(withBranch ? 'branches.dialogs.remove_worktree.title_with_branch' : 'branches.dialogs.remove_worktree.title'),
    body: `<p>${esc(t('branches.dialogs.remove_worktree.will_run'))}</p><pre>${esc(commands.join('\n'))}</pre>`
      + `<p>${esc(t('branches.dialogs.remove_worktree.safe'))}</p>`,
    confirm: t('branches.dialogs.remove_worktree.confirm'),
  });
  if (!confirmed) return;

  if (await removeWorktreeFolder(worktree)) {
    sparkle(point);
    toast(t('branches.toasts.worktree_removed', { path: tildify(path) }));
    if (withBranch && worktree.info) await deleteBranch(worktree.info.key, point);
  }
  await loadState({ repos: [worktree.repo], quiet: true });
}

async function removeWorktreeFolder(worktree, force = false) {
  const result = await removeWorktreeRequest(worktree, force);
  if (result.ok) return true;
  if (!force && isGitFailure(result) && (await confirmForceRemove(worktree, result))) return removeWorktreeFolder(worktree, true);
  if (force || !isGitFailure(result)) toast(t('branches.toasts.remove_failed', { error: failureMessage(result) }), 'error');
  return false;
}

function confirmForceRemove(worktree, result) {
  const loss = worktree.dirty > 0
    ? tp('branches.dialogs.force_remove.loss_dirty_html', worktree.dirty)
    : esc(t('branches.dialogs.force_remove.loss_clean'));
  return openDialog({
    title: t('branches.dialogs.force_remove.title'),
    body: `${gitSays(result)}<p>${loss}</p>`,
    confirm: t('branches.dialogs.force_remove.confirm'),
    danger: true,
  });
}

async function pruneWorktrees(point) {
  const confirmed = await openDialog({
    title: t('branches.dialogs.prune.title'),
    body: `<p>${t('branches.dialogs.prune.body_html', { command: code('git worktree prune') })}</p>`,
    confirm: t('branches.dialogs.prune.confirm'),
  });
  if (!confirmed) return;
  const repos = [...new Set(ui.data.worktrees.filter((w) => w.prunable || w.missing).map((w) => w.repo))];
  const results = await Promise.all(repos.map((repo) => api('/api/branches/prune', { repo })));
  const output = results.filter((result) => result.ok).map((result) => result.output).filter(Boolean).join('\n');
  results.forEach((result, index) => {
    if (!result.ok) toast(t('branches.toasts.prune_failed', { error: `${repoName(repos[index])}: ${failureMessage(result)}` }), 'error');
  });
  if (results.some((result) => result.ok)) {
    sparkle(point);
    toast(output ? t('branches.toasts.pruned', { output }) : t('branches.toasts.no_ghosts'));
  }
  await loadState({ repos, quiet: true });
}

/* ---------- bulk actions ---------- */

async function bulkTidyBranches() {
  const branches = [...ui.beds.branches.selected].map(branchByKey).filter(Boolean);
  const allSquashed = branches.every((b) => b.pr?.state === 'MERGED');
  const form = await openDialog({
    title: tp('branches.dialogs.bulk_branches.title', branches.length),
    body: `
      <p>${t('branches.dialogs.bulk_branches.intro_html', { command: code('git branch -d') })}</p>
      <ul class="dialog-list">${branches.map((b) => `<li>🌿 ${code(b.name)}</li>`).join('')}</ul>
      ${toggle('force', t('branches.dialogs.bulk_branches.force_html', { flag: code('-D') }), allSquashed)}`,
    confirm: t('branches.dialogs.bulk_branches.confirm'),
  });
  if (!form) return;
  const force = form.get('force') === 'on';
  await runBulk({
    items: branches.map((b) => ({ key: b.key, repo: b.repo, label: `🌿 ${b.name}`, branch: b })),
    perform: (item, retrying) => tidyBranch(item.branch, force || retrying),
    retryKey: force ? null : 'branches.dialogs.bulk_branches.retry',
  });
}

async function tidyBranch(b, force) {
  const result = await deleteBranchRequest(b, force);
  if (result.ok) ui.beds.branches.selected.delete(b.key);
  return { ok: result.ok, message: failureMessage(result) };
}

async function bulkTidyWorktrees() {
  const worktrees = [...ui.beds.worktrees.selected].map(worktreeByPath).filter(Boolean);
  const dirtyCount = worktrees.filter((w) => w.dirty > 0).length;
  const allSquashed = worktrees.filter(ownsDeletableBranch).every((w) => w.info.pr?.state === 'MERGED');
  const form = await openDialog({
    title: tp('branches.dialogs.bulk_worktrees.title', worktrees.length),
    body: `
      <p>${t('branches.dialogs.bulk_worktrees.intro_html', { command: code('git worktree remove') })}</p>
      <ul class="dialog-list">${worktrees.map(worktreeListItem).join('')}</ul>
      ${toggle('branches', esc(t('branches.dialogs.bulk_worktrees.also_branches')), true)}
      ${toggle('force-branches', t('branches.dialogs.bulk_worktrees.force_branches_html', { flag: code('-D') }), allSquashed)}
      ${dirtyCount ? toggle('force-worktrees', esc(tp('branches.dialogs.bulk_worktrees.force_worktrees', dirtyCount))) : ''}`,
    confirm: t('branches.dialogs.bulk_worktrees.confirm'),
  });
  if (!form) return;
  const options = {
    branches: form.get('branches') === 'on',
    forceBranches: form.get('force-branches') === 'on',
    forceWorktrees: form.get('force-worktrees') === 'on',
  };
  await runBulk({
    items: worktrees.map((w) => ({ key: w.path, repo: w.repo, label: `🏡 ${tildify(w.path)}`, worktree: w, removed: false })),
    perform: (item, retrying) => tidyWorktree(item, retrying ? { ...options, forceBranches: true, forceWorktrees: true } : options),
    retryKey: 'branches.dialogs.bulk_worktrees.retry',
  });
}

function worktreeListItem(w) {
  const branch = w.branch ? ` · 🌿 ${esc(w.branch)}` : '';
  const dirty = w.dirty ? ` · ${esc(tp('branches.badges.unsaved', w.dirty))}` : '';
  return `<li>🏡 ${code(tildify(w.path))}${branch}${dirty}</li>`;
}

async function tidyWorktree(item, options) {
  const w = item.worktree;
  if (!item.removed) {
    const result = await removeWorktreeRequest(w, options.forceWorktrees);
    if (!result.ok) return { ok: false, message: failureMessage(result) };
    item.removed = true;
    ui.beds.worktrees.selected.delete(w.path);
  }
  if (!options.branches || !ownsDeletableBranch(w)) return { ok: true };
  const result = await deleteBranchRequest(w.info, options.forceBranches);
  return { ok: result.ok, message: t('branches.dialogs.bulk_worktrees.branch_stayed', { error: failureMessage(result) }) };
}

async function runBulk({ items, perform, retryKey, retrying = false }) {
  const finished = openDialog({
    title: t(retrying ? 'branches.dialogs.progress.force_tidying' : 'branches.dialogs.progress.tidying'),
    body: `<ul class="dialog-list">${items.map((i) => `<li data-key="${esc(i.key)}"><span aria-hidden="true">🫧</span> ${code(i.label)}<span class="msg"></span></li>`).join('')}</ul>`,
    confirm: null,
    cancel: t('branches.dialogs.progress.working'),
  });
  setDialogBusy(true);
  $('#dialog-cancel').disabled = true;

  const failed = [];
  for (const item of items) {
    const outcome = await perform(item, retrying);
    const row = dialogItem(item.key);
    row.firstElementChild.textContent = outcome.ok ? '✅' : '❌';
    if (!outcome.ok) {
      failed.push(item);
      row.querySelector('.msg').textContent = outcome.message;
    }
  }

  setDialogBusy(false);
  finishBulk(items.length - failed.length, failed.length, retrying ? null : retryKey);
  const retry = await finished;
  await loadState({ repos: [...new Set(items.map((item) => item.repo))], quiet: true });
  if (retry && failed.length) await runBulk({ items: failed, perform, retryKey, retrying: true });
}

function bulkResultTitle(tidied, failedCount) {
  if (failedCount) return tp('branches.dialogs.progress.some_stayed', failedCount, { tidied });
  return tp('branches.dialogs.progress.all_tidied', tidied);
}

function finishBulk(tidied, failedCount, retryKey) {
  if (tidied) sparkle();
  $('#dialog-title').textContent = bulkResultTitle(tidied, failedCount);
  $('#dialog-cancel').disabled = false;
  $('#dialog-cancel').textContent = t('branches.dialogs.progress.done');
  const confirmButton = $('#dialog-confirm');
  confirmButton.hidden = !retryKey || failedCount === 0;
  confirmButton.className = 'btn btn-danger';
  confirmButton.textContent = retryKey && failedCount ? tp(retryKey, failedCount) : '';
}

/* ---------- wiring ---------- */

function selectRepoTab(path, { focus = false } = {}) {
  ui.repoTab = path;
  store.set(`${PAGE}-repo-tab`, path);
  render();
  sprout($(`#${PAGE}`));
  if (focus) document.getElementById(`repo-tab-${scopedPaths().indexOf(path)}`)?.focus();
}

$('#repo-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[role="tab"]');
  if (tab && tab.dataset.repo !== activeRepo()) selectRepoTab(tab.dataset.repo);
});

$('#repo-tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const paths = scopedPaths();
  const index = paths.indexOf(activeRepo());
  const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: paths.length - 1 }[event.key];
  event.preventDefault();
  selectRepoTab(paths[(next + paths.length) % paths.length], { focus: true });
});

$('#refresh').addEventListener('click', () => loadState({ refresh: true, quiet: true }));

[PAGE].forEach((bedName) => {
  const state = () => ui.beds[bedName];

  $(`#${bedName}-search`).value = state().query;
  $(`#${bedName}-search`).addEventListener('input', (event) => {
    state().query = event.target.value;
    remember(`${bedName}-search`, state().query);
    renderItems(bedName);
  });

  $(`#${bedName}-sort`).value = state().sort;
  $(`#${bedName}-sort`).addEventListener('change', (event) => {
    state().sort = event.target.value;
    store.set(`${bedName}-sort`, event.target.value);
    renderItems(bedName);
  });

  $(`#${bedName}-filters`).addEventListener('click', (event) => {
    const chip = event.target.closest('[data-filter]');
    if (!chip) return;
    state().filter = chip.dataset.filter;
    remember(`${bedName}-filter`, state().filter);
    renderBed(bedName);
  });

  $(`#${bedName}-select-visible`).addEventListener('click', () => {
    const bed = BEDS[bedName];
    visibleItems(bedName).filter(bed.selectable).forEach((item) => state().selected.add(bed.key(item)));
    rerenderSelection(bedName);
  });

  $(`#${bedName}`).addEventListener('change', (event) => {
    if (event.target.dataset.action !== 'select') return;
    const card = event.target.closest('[data-key]');
    if (event.target.checked) state().selected.add(card.dataset.key);
    else state().selected.delete(card.dataset.key);
    card.classList.toggle('is-selected', event.target.checked);
    renderBulkbar();
  });
});

$('#branches')?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action="delete-branch"]');
  if (!button) return;
  button.disabled = true;
  const deleted = await deleteBranch(button.closest('[data-key]').dataset.key, pointOf(button));
  if (!deleted) button.disabled = false;
});

$('#worktrees')?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action="remove-worktree"]');
  if (!button) return;
  await removeWorktree(button.closest('[data-key]').dataset.key, button.dataset.withBranch === '1', pointOf(button));
});

$('#prune')?.addEventListener('click', (event) => pruneWorktrees(pointOf(event.currentTarget)));

$('#bulk-clear').addEventListener('click', () => {
  ui.beds[PAGE].selected.clear();
  renderItems(PAGE);
  renderBulkbar();
});

$(`#bulk-tidy-${PAGE}`).addEventListener('click', () => (PAGE === 'worktrees' ? bulkTidyWorktrees() : bulkTidyBranches()));

loadRepos();
