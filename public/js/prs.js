import { $, store, esc, ago, t, tp, locale, api, failureMessage, toast, sprout } from './garden.js';

const STATES = ['open', 'merged', 'closed'];
const GROUPS = ['mergeable', 'needs_work', 'waiting', 'drafts'];

const nameList = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
const names = (logins) => nameList.format(logins);
const repoMessage = (repo) => (repo.error_key ? t(repo.error_key) : repo.error || t('errors.wilted'));
const repoFailure = (repo) => t('prs.repo_failed', { slug: repo.slug, message: repoMessage(repo) });

const DEFAULT_REPOS = ['kolide/k2'];

function savedSet(key, fallback) {
  try { return new Set(JSON.parse(store.get(key)) || fallback); } catch { return new Set(fallback); }
}

const ui = {
  repos: [],
  selected: savedSet('prs-repos', DEFAULT_REPOS),
  hidden: savedSet('prs-hidden', []),
  showHidden: false,
  tab: store.get('prs-tab') || 'all',
  state: 'open',
  query: '',
  results: { open: new Map(), merged: new Map(), closed: new Map() },
  loading: false,
  loadId: 0,
};

const shownRepos = () => ui.repos.filter((r) => !ui.hidden.has(r.slug));
const selectedRepos = () => ui.repos.filter((r) => ui.selected.has(r.slug));
const tabSlugs = () => (ui.tab === 'all' ? selectedRepos().map((r) => r.slug) : [ui.tab]);
const prsFor = (state, slugs) => slugs.flatMap((slug) => ui.results[state].get(slug)?.prs || []);

/* ---------- loading ---------- */

async function loadRepos() {
  const result = await api('/api/prs/repos');
  ui.repos = result.repos || [];
  const known = new Set(ui.repos.map((r) => r.slug));
  ui.selected = new Set([...ui.selected].filter((slug) => known.has(slug) && !ui.hidden.has(slug)));
  if (!['all', ...ui.selected].includes(ui.tab)) ui.tab = 'all';
  renderRepoPanel();
  await loadMissing();
}

async function loadMissing({ refresh = false } = {}) {
  const states = refresh ? Object.keys(ui.results).filter((s) => s === 'open' || s === ui.state || ui.results[s].size) : [...new Set(['open', ui.state])];
  const loadId = ++ui.loadId;
  const requests = states.map((state) => {
    const slugs = selectedRepos().map((r) => r.slug).filter((slug) => refresh || !ui.results[state].has(slug));
    return slugs.length ? fetchState(state, slugs, refresh) : null;
  }).filter(Boolean);
  if (!requests.length) return render();

  ui.loading = true;
  $('#refresh').disabled = true;
  render();
  await Promise.all(requests);
  if (loadId !== ui.loadId) return;
  ui.loading = false;
  $('#refresh').disabled = false;
  render();
  sprout($('#prs'));
}

async function fetchState(state, slugs, refresh) {
  const params = new URLSearchParams({ repos: slugs.join(','), state, ...(refresh ? { refresh: '1' } : {}) });
  const result = await api(`/api/prs/list?${params}`);
  if (!result.httpOk) return toast(t('prs.load_failed', { reason: failureMessage(result) }), 'error');
  result.repos.forEach((repo) => {
    ui.results[state].set(repo.slug, repo);
    if (!repo.ok) toast(repoFailure(repo), 'error');
  });
}

/* ---------- rendering ---------- */

function render() {
  renderStats();
  renderTabs();
  renderStateChips();
  renderPrs();
}

function repoOption(repo) {
  return `
    <li class="repo-row">
      <label class="repo-option">
        <input type="checkbox" data-slug="${esc(repo.slug)}" ${ui.selected.has(repo.slug) ? 'checked' : ''}>
        <span><span class="name">${esc(repo.name)}</span><span class="slug">${esc(repo.slug)}</span></span>
      </label>
      <button type="button" class="repo-hide" data-hide="${esc(repo.slug)}" aria-label="${esc(t('prs.panel.hide_label', { name: repo.name }))}" title="${esc(t('prs.panel.hide_title'))}">🙈</button>
    </li>`;
}

function repoGroup(title, repos, emptyText) {
  const list = repos.length ? `<ul class="repo-list">${repos.map(repoOption).join('')}</ul>` : `<p class="repo-empty">${esc(emptyText)}</p>`;
  return `<h3 class="repo-group">${esc(title)} <span class="count">${repos.length}</span></h3>${list}`;
}

function hiddenGroup() {
  const hidden = ui.repos.filter((r) => ui.hidden.has(r.slug));
  if (!hidden.length) return '';
  const rows = hidden.map((repo) => `
    <li class="repo-row is-hidden">
      <span class="repo-option"><span><span class="name">${esc(repo.name)}</span><span class="slug">${esc(repo.slug)}</span></span></span>
      <button type="button" class="link-btn" data-unhide="${esc(repo.slug)}" aria-label="${esc(t('prs.panel.bring_back_label', { name: repo.name }))}">${esc(t('prs.panel.bring_back'))}</button>
    </li>`).join('');
  return `<details class="repo-hidden" id="repo-hidden"${ui.showHidden ? ' open' : ''}>
    <summary class="repo-group">${esc(t('prs.panel.hidden'))} <span class="count">${hidden.length}</span></summary>
    <ul class="repo-list">${rows}</ul>
  </details>`;
}

function renderRepoPanel() {
  const shown = shownRepos();
  const inScope = shown.filter((r) => ui.selected.has(r.slug));
  const others = shown.filter((r) => !ui.selected.has(r.slug));
  $('#repo-list').innerHTML =
    repoGroup(t('prs.panel.in_scope'), inScope, t('prs.panel.nothing_picked'))
    + repoGroup(t('prs.panel.everything_else'), others, t('prs.panel.picked_all'))
    + hiddenGroup();
  renderRepoCount();
}

function renderRepoCount() {
  $('#repo-count').textContent = t('prs.repo_count', { selected: ui.selected.size, total: shownRepos().length });
}

function hideRepo(slug) {
  const rows = [...document.querySelectorAll('#repo-list .repo-row:not(.is-hidden) input')].map((input) => input.dataset.slug);
  const neighbor = rows[rows.indexOf(slug) + 1] || rows[rows.indexOf(slug) - 1];
  ui.hidden.add(slug);
  ui.selected.delete(slug);
  if (ui.tab === slug) ui.tab = 'all';
  store.set('prs-hidden', JSON.stringify([...ui.hidden]));
  saveSelection();
  renderRepoPanel();
  render();
  if (neighbor) focusRepoCheckbox(neighbor);
  toast(t('prs.panel.tucked_away', { name: slug.split('/')[1] }));
}

function unhideRepo(slug) {
  ui.hidden.delete(slug);
  store.set('prs-hidden', JSON.stringify([...ui.hidden]));
  renderRepoPanel();
  focusRepoCheckbox(slug);
}
function focusRepoCheckbox(slug) {
  [...document.querySelectorAll('#repo-list input')].find((input) => input.dataset.slug === slug)?.focus();
}

function renderStats() {
  const open = prsFor('open', selectedRepos().map((r) => r.slug));
  const inGroup = (key) => open.filter((pr) => pr.group === key).length;
  const stats = [
    ['💌', open.length, 'open'],
    ['💖', inGroup('mergeable'), 'ready'],
    ['🛠️', inGroup('needs_work'), 'needs_work'],
    ['👀', inGroup('waiting'), 'waiting'],
    ['🧸', inGroup('drafts'), 'drafts'],
  ];
  $('#stats').innerHTML = stats
    .map(([emoji, count, key]) => `<div class="stat"><b>${count}</b><span><span aria-hidden="true">${emoji}</span> ${esc(tp(`prs.stats.${key}`, count))}</span></div>`)
    .join('');
}

function renderTabs() {
  const tabs = [{ slug: 'all', name: t('prs.all_repos') }, ...selectedRepos().map((r) => ({ slug: r.slug, name: `📦 ${r.name}` }))];
  $('#repo-tabs').innerHTML = tabs.map(({ slug, name }) => {
    const active = slug === ui.tab;
    const count = prsFor(ui.state, slug === 'all' ? selectedRepos().map((r) => r.slug) : [slug]).length;
    return `<button type="button" class="tab" role="tab" id="tab-${esc(slug)}" data-tab="${esc(slug)}" aria-controls="pr-panel"
      aria-selected="${active}" tabindex="${active ? 0 : -1}">${esc(name)} <span class="tab-count">${count}</span></button>`;
  }).join('');
  $('#pr-panel').setAttribute('aria-labelledby', `tab-${ui.tab}`);
}

function renderStateChips() {
  $('#state-chips').innerHTML = STATES.map((state) =>
    `<button type="button" class="chip" data-state="${state}" aria-pressed="${ui.state === state}">${esc(t(`prs.states.${state}`))}</button>`).join('');
}

function matchesQuery(pr) {
  const query = ui.query.trim().toLowerCase();
  return !query || [pr.title, pr.head, pr.repo, `#${pr.number}`, ...pr.labels].join(' ').toLowerCase().includes(query);
}

const placeholder = (kind, emoji, key) =>
  `<div class="${kind}"><span class="big" aria-hidden="true">${emoji}</span>${esc(t(key))}</div>`;

function renderPrs() {
  if (!ui.selected.size) {
    $('#shown').textContent = '';
    $('#prs').innerHTML = placeholder('empty', '🗂️', 'prs.empty.no_repos');
    return;
  }
  const slugs = tabSlugs();
  const loaded = slugs.every((slug) => ui.results[ui.state].has(slug));
  if (!loaded && ui.loading) {
    $('#shown').textContent = '';
    $('#prs').innerHTML = placeholder('loading', '💌', 'prs.empty.loading');
    return;
  }
  const prs = prsFor(ui.state, slugs).filter(matchesQuery);
  $('#shown').textContent = tp(`prs.shown.${ui.state}`, prs.length);
  const body = ui.state === 'open' ? openSections(prs) : flatList(prs);
  $('#prs').innerHTML = repoErrors(slugs) + (prs.length ? body : emptyState());
}

function repoErrors(slugs) {
  return slugs
    .map((slug) => ui.results[ui.state].get(slug))
    .filter((repo) => repo && !repo.ok)
    .map((repo) => `<p class="repo-error">🫥 ${esc(repoFailure(repo))}</p>`)
    .join('');
}

const EMPTY_EMOJI = { open: '🏖️', merged: '🌱', closed: '🧹' };

function emptyState() {
  if (ui.query) return placeholder('empty', '🌙', 'prs.empty.no_match');
  return placeholder('empty', EMPTY_EMOJI[ui.state], `prs.empty.${ui.state}`);
}

function openSections(prs) {
  return GROUPS.map((group) => {
    const members = prs.filter((pr) => pr.group === group).sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
    if (!members.length) return '';
    const title = esc(t(`prs.groups.${group}.title`));
    return `
      <section class="pr-section" aria-label="${title}">
        <h3>${title}<span class="count">${members.length}</span><small>${esc(t(`prs.groups.${group}.hint`))}</small></h3>
        <div class="grid">${members.map(prCard).join('')}</div>
      </section>`;
  }).join('');
}

function flatList(prs) {
  const when = (pr) => Date.parse(pr.merged || pr.closed || pr.updated);
  return `<div class="grid">${[...prs].sort((a, b) => when(b) - when(a)).map(prCard).join('')}</div>`;
}

const badge = (color, text) => `<span class="badge ${color}">${esc(text)}</span>`;

function reviewBadge(review) {
  if (review.changes_by.length) return badge('b-coral', t('prs.review.changes_requested', { names: names(review.changes_by) }));
  if (review.decision === 'APPROVED') return badge('b-mint', approvedText(review.approved_by));
  if (review.requested.length) return badge('b-gold', t('prs.review.waiting_on', { names: names(review.requested) }));
  if (review.commented_by.length) return badge('b-lav', t('prs.review.comments_from', { names: names(review.commented_by) }));
  if (review.decision === 'REVIEW_REQUIRED') return badge('b-lav', t('prs.review.no_reviewers'));
  return '';
}

function approvedText(approvers) {
  return approvers.length ? t('prs.review.approved_by', { names: names(approvers) }) : t('prs.review.approved');
}

function checksBadge(checks) {
  if (checks.verdict === 'failing') return badge('b-coral', tp('prs.checks.failing', checks.failing));
  if (checks.verdict === 'pending') return badge('b-gold', tp('prs.checks.running', checks.pending));
  if (checks.verdict === 'passing') return badge('b-mint', tp('prs.checks.passing', checks.passing));
  return '';
}

function prBadges(pr) {
  const badges = [];
  if (pr.state === 'OPEN') {
    badges.push(reviewBadge(pr.review), checksBadge(pr.checks));
    if (pr.conflicts) badges.push(badge('b-coral', t('prs.badges.conflicts')));
    if (pr.behind) badges.push(badge('b-gold', t('prs.badges.behind')));
  }
  if (pr.state === 'MERGED') badges.push(badge('b-pink', t('prs.badges.merged', { ago: ago(pr.merged) })));
  if (pr.state === 'CLOSED') badges.push(badge('b-coral', t('prs.badges.closed', { ago: ago(pr.closed) })));
  pr.labels.slice(0, 3).forEach((label) => badges.push(badge('b-lav', `🏷️ ${label}`)));
  return badges.join('');
}

function prCard(pr) {
  const repoBadge = ui.tab === 'all' ? badge('b-lav', `📦 ${pr.repo.split('/')[1]}`) : '';
  const draft = pr.draft ? badge('draft-badge', t('prs.badges.draft')) : '';
  return `
    <a class="card pr-card${pr.draft ? ' is-draft' : ''}" href="${esc(pr.url)}" target="_blank" rel="noopener">
      <span class="card-top"><span class="pr-number">#${pr.number}</span>${repoBadge}${draft}</span>
      <h3>${esc(pr.title)}</h3>
      <span class="badges">${prBadges(pr)}</span>
      <span class="pr-branch">🌿 ${esc(pr.head)} → ${esc(pr.base)}</span>
      <span class="card-foot">
        <span class="age" title="${esc(pr.updated)}">${esc(t('prs.badges.updated', { ago: ago(pr.updated) }))}</span>
        <span class="pr-diff"><span class="add">+${pr.additions}</span> <span class="del">−${pr.deletions}</span></span>
      </span>
    </a>`;
}

/* ---------- wiring ---------- */

function saveSelection() {
  store.set('prs-repos', JSON.stringify([...ui.selected]));
  renderRepoCount();
}

function selectTab(slug, { focus = false } = {}) {
  ui.tab = slug;
  store.set('prs-tab', slug);
  renderTabs();
  renderPrs();
  if (focus) document.getElementById(`tab-${slug}`)?.focus();
}

$('#repo-list').addEventListener('change', (event) => {
  const slug = event.target.dataset.slug;
  if (!slug) return;
  if (event.target.checked) ui.selected.add(slug);
  else ui.selected.delete(slug);
  if (!ui.selected.has(ui.tab)) ui.tab = 'all';
  saveSelection();
  renderRepoPanel();
  focusRepoCheckbox(slug);
  loadMissing();
});

$('#repo-list').addEventListener('click', (event) => {
  const hide = event.target.closest('[data-hide]');
  const unhide = event.target.closest('[data-unhide]');
  if (hide) hideRepo(hide.dataset.hide);
  if (unhide) unhideRepo(unhide.dataset.unhide);
});

$('#repo-list').addEventListener('toggle', (event) => {
  if (event.target.id === 'repo-hidden') ui.showHidden = event.target.open;
}, true);

$('#repos-all').addEventListener('click', () => {
  shownRepos().forEach((r) => ui.selected.add(r.slug));
  saveSelection();
  renderRepoPanel();
  loadMissing();
});

$('#repos-none').addEventListener('click', () => {
  ui.selected.clear();
  ui.tab = 'all';
  saveSelection();
  renderRepoPanel();
  render();
});

$('#repo-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[role="tab"]');
  if (tab) selectTab(tab.dataset.tab);
});

$('#repo-tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const slugs = ['all', ...selectedRepos().map((r) => r.slug)];
  const index = slugs.indexOf(ui.tab);
  const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: slugs.length - 1 }[event.key];
  event.preventDefault();
  selectTab(slugs[(next + slugs.length) % slugs.length], { focus: true });
});

$('#state-chips').addEventListener('click', (event) => {
  const chip = event.target.closest('[data-state]');
  if (!chip) return;
  ui.state = chip.dataset.state;
  loadMissing();
});

$('#search').addEventListener('input', (event) => { ui.query = event.target.value; renderPrs(); });
$('#refresh').addEventListener('click', () => loadMissing({ refresh: true }));

if (matchMedia('(max-width: 860px)').matches) $('#repo-details').open = false;

loadRepos();
