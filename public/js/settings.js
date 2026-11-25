import { $, esc, t, tp, api, failureMessage, toast, locale } from './garden.js';

// Repos hidden here never reach any page: the server leaves them out of every repo panel and review list.
// The list of repos comes from GitHub, not from whichever folders this machine happens to have.
const ui = { repos: [], query: '', loading: true, error: null };

const matches = (repo) => !ui.query || repo.slug.toLowerCase().includes(ui.query);

async function load({ refresh = false } = {}) {
  $('#refresh').disabled = true;
  const result = await api(`/api/settings/repos${refresh ? '?refresh=1' : ''}`);
  $('#refresh').disabled = false;
  ui.loading = false;
  ui.repos = result.repos || [];
  ui.error = result.httpOk ? (result.error_key ? t(result.error_key) : null) : failureMessage(result);
  render();
}

function render() {
  const hidden = ui.repos.filter((repo) => repo.hidden);
  $('#hidden-count').textContent = ui.loading ? '' : tp('settings.repos.count', hidden.length);
  if (ui.loading) return note(t('settings.repos.loading'));
  const shown = ui.repos.filter(matches);
  $('#repos-shown').textContent = ui.query ? tp('settings.repos.shown', ui.repos.length, { shown: shown.length }) : '';
  const error = ui.error ? `<p class="repo-error">${esc(ui.error)}</p>` : '';
  $('#settings-repos').innerHTML = error
    + group(t('settings.repos.hidden_group'), shown.filter((repo) => repo.hidden), t(ui.query ? 'settings.repos.no_match' : 'settings.repos.none_hidden'))
    + group(t('settings.repos.shown_group'), shown.filter((repo) => !repo.hidden), t('settings.repos.no_match'));
}

function note(message) {
  $('#settings-repos').innerHTML = `<p class="repo-empty">${esc(message)}</p>`;
}

function group(title, repos, emptyText) {
  const list = repos.length
    ? `<ul class="repo-list settings-repos-list">${repos.map(row).join('')}</ul>`
    : `<p class="repo-empty">${esc(emptyText)}</p>`;
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

$('#repo-search').addEventListener('input', (event) => {
  ui.query = event.target.value.trim().toLowerCase();
  render();
});

$('#refresh').addEventListener('click', () => load({ refresh: true }));

/* ---------- colors and language ---------- */

// Both live in cookies, so the server renders every page in your colors and language from the first byte.
const remember = (name, value) => { document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=strict`; };

// Colors switch in place.
document.querySelectorAll('input[name="palette"]').forEach((input) => input.addEventListener('change', () => {
  const { name, emoji } = input.dataset;
  document.documentElement.dataset.palette = input.value;
  remember('garden_palette', input.value);
  toast(t('common.palette.now_wearing', { name, emoji }));
}));

// Every string on the page is in the old language, so a new language reloads.
document.querySelectorAll('input[name="locale"]').forEach((input) => input.addEventListener('change', () => {
  if (input.value === locale) return;
  remember('garden_locale', input.value);
  location.reload();
}));

render();
load();
