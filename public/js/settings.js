import {
  $, store, esc, t, tp, api, failureMessage, toast, locale, stateBox, remembered, remember, markFresh,
  skeleton, skeletonGroups, regionShape, loadingNote,
} from './garden.js';

// Repos hidden here never reach any page: the server leaves them out of every repo panel and review list.
// The list of repos comes from GitHub, not from whichever folders this machine happens to have.
const TABS = ['look', 'repos'];
const ui = {
  repos: [], loading: true, error: null,
  query: remembered('settings-search', ''), owner: remembered('settings-owner', null),
  tab: TABS.includes(store.get('settings-tab')) ? store.get('settings-tab') : 'look',
};

const ownerOf = (repo) => repo.slug.split('/')[0];
// The remembered owner chip, if GitHub still lists that owner; otherwise every owner shows.
const activeOwner = () => (ui.owner && ui.repos.some((repo) => ownerOf(repo) === ui.owner) ? ui.owner : null);
const matches = (repo) => {
  const query = ui.query.trim().toLowerCase();
  return (!activeOwner() || ownerOf(repo) === activeOwner()) && (!query || repo.slug.toLowerCase().includes(query));
};

async function load({ refresh = false } = {}) {
  $('#refresh').disabled = true;
  const result = await api(`/api/settings/repos${refresh ? '?refresh=1' : ''}`);
  $('#refresh').disabled = false;
  ui.loading = false;
  ui.repos = result.repos || [];
  ui.error = result.httpOk ? (result.error_key ? t(result.error_key) : null) : failureMessage(result);
  if (!ui.error) markFresh();
  render();
}

function render() {
  renderTabs();
  const hidden = ui.repos.filter((repo) => repo.hidden);
  $('#hidden-count').textContent = ui.loading ? '' : hidden.length;
  if (ui.loading) {
    $('#owner-chips').hidden = false;
    $('#owner-chips').innerHTML = skeleton('chip', 3);
    const repos = $('#settings-repos');
    repos.innerHTML = skeletonGroups(regionShape(repos, [2, 8]), { list: 'repo-list settings-repos-list', empty: 'state-box' })
      + loadingNote(t('settings.repos.loading'));
    return;
  }
  renderOwners();
  const shown = ui.repos.filter(matches);
  $('#repos-shown').textContent = tp('settings.repos.shown', ui.repos.length, { shown: shown.length });
  const error = ui.error ? stateBox('failed', '🥀', ui.error) : '';
  const filtering = ui.query || activeOwner();
  $('#settings-repos').innerHTML = error
    + group(t('settings.repos.hidden_group'), shown.filter((repo) => repo.hidden), t(filtering ? 'settings.repos.no_match' : 'settings.repos.none_hidden'))
    + group(t('settings.repos.shown_group'), shown.filter((repo) => !repo.hidden), t('settings.repos.no_match'));
}

function renderTabs() {
  TABS.forEach((name) => {
    const selected = name === ui.tab;
    const tab = $(`#settings-tab-${name}`);
    tab.setAttribute('aria-selected', selected);
    tab.tabIndex = selected ? 0 : -1;
  });
  $('#settings-look').hidden = ui.tab !== 'look';
  $('#settings-repos-panel').hidden = ui.tab !== 'repos';
}

// One chip per GitHub owner, most repos first.
function renderOwners() {
  const counts = ui.repos.reduce((tally, repo) => tally.set(ownerOf(repo), (tally.get(ownerOf(repo)) || 0) + 1), new Map());
  const owners = [...counts.entries()].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  $('#owner-chips').hidden = !owners.length;
  const pressed = activeOwner();
  const chip = (key, label, count) =>
    `<button type="button" class="chip" data-owner="${esc(key ?? '')}" aria-pressed="${pressed === key}">${esc(label)}<span class="count">${count}</span></button>`;
  $('#owner-chips').innerHTML = owners.length
    ? chip(null, t('common.all'), ui.repos.length) + owners.map(([owner, count]) => chip(owner, `👤 ${owner}`, count)).join('')
    : '';
}

function selectTab(name, { focus = false } = {}) {
  ui.tab = name;
  store.set('settings-tab', name);
  renderTabs();
  if (focus) $(`#settings-tab-${name}`).focus();
}

function group(title, repos, emptyText) {
  const list = repos.length
    ? `<ul class="repo-list settings-repos-list">${repos.map(row).join('')}</ul>`
    : stateBox('empty', '🌙', emptyText);
  return `<h3 class="repo-group">${esc(title)} <span class="count">${repos.length}</span></h3>${list}`;
}

function row(repo) {
  const [owner, name] = repo.slug.split('/');
  const badges = [
    repo.private && t('settings.repos.badges.private'),
    repo.archived && t('settings.repos.badges.archived'),
    repo.gone && t('settings.repos.badges.gone'),
  ].filter(Boolean).map((text) => `<span class="badge b-lav">${esc(text)}</span>`).join('');
  return `
    <li class="repo-row">
      <label class="repo-option">
        <input type="checkbox" data-slug="${esc(repo.slug)}" ${repo.hidden ? 'checked' : ''} aria-label="${esc(t('settings.repos.hide_label', { slug: repo.slug }))}">
        <span><span class="name">${esc(name)}</span><span class="slug">${esc(owner)}</span>${badges ? `<span class="settings-badges">${badges}</span>` : ''}</span>
      </label>
    </li>`;
}

async function setHidden(slug, hidden) {
  const result = await api('/api/settings/hide', { slug, hidden });
  if (!result.ok) {
    toast(failureMessage(result), 'error');
    return render();
  }
  const repo = ui.repos.find((r) => r.slug === slug);
  if (repo) repo.hidden = hidden;
  // A repo GitHub no longer lists only stays while it's hidden.
  ui.repos = ui.repos.filter((r) => r.hidden || !r.gone);
  render();
  [...document.querySelectorAll('#settings-repos input')].find((input) => input.dataset.slug === slug)?.focus();
  toast(t(hidden ? 'settings.repos.toasts.hidden' : 'settings.repos.toasts.shown', { slug }));
}

$('#settings-repos').addEventListener('change', (event) => {
  const { slug } = event.target.dataset;
  if (slug) setHidden(slug, event.target.checked);
});

$('#repo-search').value = ui.query;
$('#repo-search').addEventListener('input', (event) => {
  ui.query = event.target.value;
  remember('settings-search', ui.query);
  render();
});

$('#owner-chips').addEventListener('click', (event) => {
  const chip = event.target.closest('[data-owner]');
  if (!chip) return;
  ui.owner = chip.dataset.owner || null;
  remember('settings-owner', ui.owner);
  render();
});

$('#settings-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[role="tab"]');
  if (tab) selectTab(tab.dataset.tab);
});

$('#settings-tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const index = TABS.indexOf(ui.tab);
  const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: TABS.length - 1 }[event.key];
  event.preventDefault();
  selectTab(TABS[(next + TABS.length) % TABS.length], { focus: true });
});

$('#refresh').addEventListener('click', () => load({ refresh: true }));

/* ---------- pages in the sidebar ---------- */

// Saved in settings.json, so every page draws the same sidebar; this one updates its own straight away.
document.querySelectorAll('input[name="page"]').forEach((input) => input.addEventListener('change', async () => {
  const shown = input.checked;
  const result = await api('/api/settings/page', { slug: input.value, shown });
  if (!result.ok) {
    input.checked = !shown;
    return toast(failureMessage(result), 'error');
  }
  const item = document.querySelector(`.sidebar li[data-page="${input.value}"]`);
  if (item) item.hidden = !shown;
  toast(t(shown ? 'settings.pages.toasts.shown' : 'settings.pages.toasts.hidden', { name: input.dataset.name }));
}));

/* ---------- colors and language ---------- */

// Both live in cookies, so the server renders every page in your colors and language from the first byte.
const setCookie = (name, value) => { document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=strict`; };

// Colors switch in place.
document.querySelectorAll('input[name="palette"]').forEach((input) => input.addEventListener('change', () => {
  const { name, emoji } = input.dataset;
  document.documentElement.dataset.palette = input.value;
  setCookie('garden_palette', input.value);
  toast(t('common.palette.now_wearing', { name, emoji }));
}));

// Every string on the page is in the old language, so a new language reloads.
document.querySelectorAll('input[name="locale"]').forEach((input) => input.addEventListener('change', () => {
  if (input.value === locale) return;
  setCookie('garden_locale', input.value);
  location.reload();
}));

render();
load();
