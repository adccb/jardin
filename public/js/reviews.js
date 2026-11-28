import {
  $, store, esc, ago, t, tp, api, failureMessage, toast, sprout, stateBox, remembered, remember, markFresh,
  skeleton, skeletonGrids, regionShape, loadingNote,
} from './garden.js';
import { ScopePanel } from './scope-panel.js';

const TABS = ['you', 'team'];
const TAB_EMOJI = { you: '🙋‍♀️', team: '👥' };

const ui = {
  requests: [], loaded: false, failure: null, query: remembered('reviews-search', ''), chip: remembered('reviews-chip', null),
  tab: TABS.includes(store.get('reviews-tab')) ? store.get('reviews-tab') : 'you',
};

const panel = new ScopePanel({ prefix: 'reviews.panel', storeKey: 'reviews', onChange: () => render() });

const repoName = (slug) => slug.split('/')[1];
const tally = (slug) => ui.requests.filter((pr) => pr.repo === slug).length;
const allRepos = () => [...new Set(ui.requests.map((pr) => pr.repo))].sort((a, b) => repoName(a).localeCompare(repoName(b)));
const scopedRequests = () => ui.requests.filter((pr) => panel.inScope(pr.repo));
const viaCount = (via) => scopedRequests().filter((pr) => pr.via === via).length;

/* ---------- loading ---------- */

async function load({ refresh = false } = {}) {
  $('#refresh').disabled = true;
  render();
  const result = await api(`/api/reviews/list${refresh ? '?refresh=1' : ''}`);
  $('#refresh').disabled = false;
  if (result.httpOk && result.ok) {
    ui.requests = result.requests;
    ui.failure = null;
    markFresh();
  } else {
    ui.failure = failureMessage(result);
    toast(t('reviews.load_failed', { reason: ui.failure }), 'error');
  }
  ui.loaded = true;
  panel.setItems(allRepos().map((slug) => ({ id: slug, name: repoName(slug), detail: slug, tally: tally(slug) })));
  render();
  sprout(...document.querySelectorAll('#reviews .grid'));
}

/* ---------- rendering ---------- */

function render() {
  renderStats();
  renderTabs();
  renderRequests();
}

function renderTabs() {
  $('#via-tabs').innerHTML = TABS.map((via) => {
    const active = via === ui.tab;
    const count = ui.loaded ? viaCount(via) : '';
    return `<button type="button" class="tab" role="tab" id="tab-${via}" data-tab="${via}" aria-controls="review-panel"
      aria-selected="${active}" tabindex="${active ? 0 : -1}"><span aria-hidden="true">${TAB_EMOJI[via]}</span> ${esc(t(`reviews.tabs.${via}.title`))} <span class="tab-count">${count}</span></button>`;
  }).join('');
  $('#review-panel').setAttribute('aria-labelledby', `tab-${ui.tab}`);
}

function selectTab(via, { focus = false } = {}) {
  ui.tab = via;
  store.set('reviews-tab', via);
  renderTabs();
  renderRequests();
  sprout(...document.querySelectorAll('#reviews .grid'));
  if (focus) document.getElementById(`tab-${via}`)?.focus();
}

function renderStats() {
  if (!ui.loaded) {
    $('#stats').innerHTML = skeleton('stat', 3);
    return;
  }
  const stats = [
    ['👀', scopedRequests().length, 'waiting'],
    ['🙋‍♀️', viaCount('you'), 'you'],
    ['👥', viaCount('team'), 'team'],
  ];
  $('#stats').innerHTML = stats
    .map(([emoji, count, key]) => `<div class="stat"><b>${count}</b><span><span aria-hidden="true">${emoji}</span> ${esc(tp(`reviews.stats.${key}`, count))}</span></div>`)
    .join('');
}

function matchesQuery(pr) {
  const query = ui.query.trim().toLowerCase();
  return !query || [pr.title, pr.repo, pr.author, `#${pr.number}`, ...pr.labels].join(' ').toLowerCase().includes(query);
}

// The remembered repo chip, if the open tab has that repo at all; otherwise the tab shows every repo.
const tabRequests = () => scopedRequests().filter((pr) => pr.via === ui.tab);
const activeChip = (prs) => (ui.chip && prs.some((pr) => pr.repo === ui.chip) ? ui.chip : null);

function renderRequests() {
  if (!ui.loaded) {
    $('#shown').textContent = '';
    $('#review-chips').hidden = false;
    $('#review-chips').innerHTML = skeleton('chip', 3);
    $('#reviews').innerHTML = skeletonGrids(regionShape($('#reviews'), [4]), 'review-card') + loadingNote(t('reviews.empty.loading'));
    return;
  }
  const all = tabRequests();
  const chip = activeChip(all);
  const prs = all.filter((pr) => !chip || pr.repo === chip).filter(matchesQuery);
  $('#shown').textContent = tp('reviews.shown', prs.length);
  renderChips(all, chip);
  $('#reviews').innerHTML = failureNote() + (prs.length ? `<div class="grid">${prs.map(requestCard).join('')}</div>` : emptyState());
}

// One chip per repo in the open tab, busiest first.
function renderChips(all, pressed) {
  const counts = all.reduce((tally, pr) => tally.set(pr.repo, (tally.get(pr.repo) || 0) + 1), new Map());
  const repos = [...counts.entries()].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  $('#review-chips').hidden = !repos.length;
  const chip = (key, label, count) =>
    `<button type="button" class="chip" data-chip="${esc(key ?? '')}" aria-pressed="${pressed === key}">${esc(label)}<span class="count">${count}</span></button>`;
  $('#review-chips').innerHTML = repos.length
    ? chip(null, t('common.all'), all.length) + repos.map(([repo, count]) => chip(repo, `📦 ${repoName(repo)}`, count)).join('')
    : '';
}

const failureNote = () => (ui.failure ? stateBox('failed', '🥀', ui.failure) : '');

function emptyState() {
  if (ui.failure) return '';
  if (ui.query || ui.chip) return stateBox('empty', '🌙', t('reviews.empty.no_match'));
  if (!ui.requests.length) return stateBox('empty', '🏖️', t('reviews.empty.none'));
  if (!scopedRequests().length) return stateBox('empty', '🗂️', t('reviews.empty.all_filtered'));
  return stateBox('empty', '🍃', t(`reviews.empty.${ui.tab}`));
}

const badge = (color, text) => `<span class="badge ${color}">${esc(text)}</span>`;

function requestBadges(pr) {
  const badges = [badge('b-lav', `👤 ${pr.author}`)];
  if (pr.comments) badges.push(badge('b-gold', tp('reviews.badges.comments', pr.comments)));
  pr.labels.slice(0, 3).forEach((label) => badges.push(badge('b-lav', `🏷️ ${label}`)));
  return badges.join('');
}

function requestCard(pr) {
  const draft = pr.draft ? badge('draft-badge', t('reviews.badges.draft')) : '';
  return `
    <a class="card pr-card${pr.draft ? ' is-draft' : ''}" href="${esc(pr.url)}" target="_blank" rel="noopener">
      <span class="card-top"><span class="pr-number">#${pr.number}</span>${badge('b-lav', `📦 ${repoName(pr.repo)}`)}${draft}</span>
      <h3>${esc(pr.title)}</h3>
      <span class="badges">${requestBadges(pr)}</span>
      <span class="card-foot">
        <span class="age" title="${esc(pr.created)}">${esc(t('reviews.badges.opened', { ago: ago(pr.created) }))}</span>
        <span class="age" title="${esc(pr.updated)}">${esc(t('reviews.badges.updated', { ago: ago(pr.updated) }))}</span>
      </span>
    </a>`;
}

/* ---------- wiring ---------- */

$('#via-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[role="tab"]');
  if (tab) selectTab(tab.dataset.tab);
});

$('#via-tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const index = TABS.indexOf(ui.tab);
  const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: TABS.length - 1 }[event.key];
  event.preventDefault();
  selectTab(TABS[(next + TABS.length) % TABS.length], { focus: true });
});

$('#search').value = ui.query;
$('#search').addEventListener('input', (event) => {
  ui.query = event.target.value;
  remember('reviews-search', ui.query);
  renderRequests();
});

$('#review-chips').addEventListener('click', (event) => {
  const chip = event.target.closest('[data-chip]');
  if (!chip) return;
  ui.chip = chip.dataset.chip || null;
  remember('reviews-chip', ui.chip);
  renderRequests();
});
$('#refresh').addEventListener('click', () => load({ refresh: true }));

load();
