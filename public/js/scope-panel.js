import { $, store, esc, t, skeletonGroups, regionShape, loadingNote } from './garden.js';

function savedSet(key) {
  try { return new Set((JSON.parse(store.get(key)) || []).map(String)); } catch { return new Set(); }
}

// The side panel of things a page can show (repos, sprints, lists…). Items come from the page's data,
// so each one is in scope unless you've unchecked (excluded) it, and new ones show up checked.
// Repos hidden everywhere are set on the ⚙️ settings page, and never reach a panel at all.
// Items: { id, name, detail, tally }. Text comes from `${prefix}.*`; markup ids come from the page.
export class ScopePanel {
  constructor({ prefix, storeKey, onChange }) {
    this.prefix = prefix;
    this.storeKey = storeKey;
    this.onChange = onChange;
    this.excluded = savedSet(`${storeKey}-excluded`);
    this.items = [];
    this.state = 'loading';
    this.failure = '';
    this.wire();
    this.render();
  }

  setItems(items) {
    this.items = items.map((item) => ({ ...item, id: String(item.id) }));
    this.state = 'ready';
    this.render();
  }

  fail(message) {
    this.failure = message;
    this.state = 'failed';
    this.render();
  }

  inScope(id) { return !this.excluded.has(String(id)); }

  scoped() { return this.items.filter((item) => this.inScope(item.id)); }

  /* ---------- rendering ---------- */

  text(key, vars) { return t(`${this.prefix}.${key}`, vars); }

  render() {
    if (this.state === 'loading') return this.renderLoading();
    $('#repo-list').innerHTML = this.body();
    $('#repo-count').textContent = this.state === 'ready' && this.items.length
      ? this.text('count', { selected: this.scoped().length, total: this.items.length })
      : '';
  }

  // As tall as the list was last time, so it doesn't push anything when the items arrive.
  renderLoading() {
    const list = $('#repo-list');
    list.innerHTML = skeletonGroups(regionShape(list, [3, 1])) + loadingNote(this.text('loading'));
  }

  body() {
    if (this.state === 'failed') return this.note(this.failure);
    if (!this.items.length) return this.note(this.text('none'));
    return this.group(this.text('in_scope'), this.scoped(), this.text('nothing_picked'))
      + this.group(this.text('filtered_out'), this.items.filter((item) => !this.inScope(item.id)), this.text('none_filtered'));
  }

  note(message) { return `<p class="repo-empty">${esc(message)}</p>`; }

  option(item) {
    const detail = item.detail ? `<span class="slug">${esc(item.detail)}</span>` : '';
    const tally = item.tally === undefined ? '' : `<span class="tally">${item.tally}</span>`;
    return `
      <li class="repo-row">
        <label class="repo-option">
          <input type="checkbox" data-id="${esc(item.id)}" ${this.inScope(item.id) ? 'checked' : ''}>
          <span><span class="name">${esc(item.name)}</span>${detail}</span>${tally}
        </label>
      </li>`;
  }

  group(title, items, emptyText) {
    const list = items.length ? `<ul class="repo-list">${items.map((item) => this.option(item)).join('')}</ul>` : this.note(emptyText);
    return `<h3 class="repo-group">${esc(title)} <span class="count">${items.length}</span></h3>${list}`;
  }

  /* ---------- changes ---------- */

  changed({ focus } = {}) {
    store.set(`${this.storeKey}-excluded`, JSON.stringify([...this.excluded]));
    this.render();
    if (focus) [...document.querySelectorAll('#repo-list input')].find((input) => input.dataset.id === focus)?.focus();
    this.onChange();
  }

  wire() {
    $('#repo-list').addEventListener('change', (event) => {
      const { id } = event.target.dataset;
      if (!id) return;
      if (event.target.checked) this.excluded.delete(id);
      else this.excluded.add(id);
      this.changed({ focus: id });
    });
    $('#repos-all').addEventListener('click', () => {
      this.items.forEach((item) => this.excluded.delete(item.id));
      this.changed();
    });
    $('#repos-none').addEventListener('click', () => {
      this.items.forEach((item) => this.excluded.add(item.id));
      this.changed();
    });
  }
}
