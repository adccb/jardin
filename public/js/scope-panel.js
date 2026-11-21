import { $, store, esc, t, toast } from './garden.js';

function savedSet(key) {
  try { return new Set((JSON.parse(store.get(key)) || []).map(String)); } catch { return new Set(); }
}

// The side panel of things a page can show (repos, sprints…). Items come from the page's data,
// so each one is in scope unless you've unchecked (excluded) or hidden it, and new ones show up checked.
// Items: { id, name, detail, tally }. Text comes from `${prefix}.*`; markup ids come from the page.
export class ScopePanel {
  constructor({ prefix, storeKey, onChange }) {
    this.prefix = prefix;
    this.storeKey = storeKey;
    this.onChange = onChange;
    this.excluded = savedSet(`${storeKey}-excluded`);
    this.hidden = savedSet(`${storeKey}-hidden`);
    this.items = [];
    this.state = 'loading';
    this.failure = '';
    this.showHidden = false;
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

  inScope(id) { return !this.excluded.has(String(id)) && !this.hidden.has(String(id)); }

  scoped() { return this.items.filter((item) => this.inScope(item.id)); }

  /* ---------- rendering ---------- */

  text(key, vars) { return t(`${this.prefix}.${key}`, vars); }

  shown() { return this.items.filter((item) => !this.hidden.has(item.id)); }

  render() {
    $('#repo-list').innerHTML = this.body();
    const shown = this.shown();
    $('#repo-count').textContent = this.state === 'ready' && this.items.length
      ? this.text('count', { selected: shown.filter((item) => this.inScope(item.id)).length, total: shown.length })
      : '';
  }

  body() {
    if (this.state === 'loading') return this.note(this.text('loading'));
    if (this.state === 'failed') return this.note(this.failure);
    if (!this.items.length) return this.note(this.text('none'));
    const shown = this.shown();
    return this.group(this.text('in_scope'), shown.filter((item) => this.inScope(item.id)), this.text('nothing_picked'))
      + this.group(this.text('filtered_out'), shown.filter((item) => !this.inScope(item.id)), this.text('none_filtered'))
      + this.hiddenGroup();
  }

  note(message) { return `<p class="repo-empty">${esc(message)}</p>`; }

  label(item) {
    const detail = item.detail ? `<span class="slug">${esc(item.detail)}</span>` : '';
    return `<span><span class="name">${esc(item.name)}</span>${detail}</span>`;
  }

  option(item) {
    const tally = item.tally === undefined ? '' : `<span class="tally">${item.tally}</span>`;
    return `
      <li class="repo-row">
        <label class="repo-option">
          <input type="checkbox" data-id="${esc(item.id)}" ${this.inScope(item.id) ? 'checked' : ''}>
          ${this.label(item)}${tally}
        </label>
        <button type="button" class="repo-hide" data-hide="${esc(item.id)}" aria-label="${esc(this.text('hide_label', { name: item.name }))}" title="${esc(this.text('hide_title'))}">🙈</button>
      </li>`;
  }

  group(title, items, emptyText) {
    const list = items.length ? `<ul class="repo-list">${items.map((item) => this.option(item)).join('')}</ul>` : this.note(emptyText);
    return `<h3 class="repo-group">${esc(title)} <span class="count">${items.length}</span></h3>${list}`;
  }

  // Only hidden items still in the data are listed; we'd have no name for the rest.
  hiddenGroup() {
    const hidden = this.items.filter((item) => this.hidden.has(item.id));
    if (!hidden.length) return '';
    const rows = hidden.map((item) => `
      <li class="repo-row is-hidden">
        <span class="repo-option">${this.label(item)}</span>
        <button type="button" class="link-btn" data-unhide="${esc(item.id)}" aria-label="${esc(this.text('bring_back_label', { name: item.name }))}">${esc(this.text('bring_back'))}</button>
      </li>`).join('');
    return `<details class="repo-hidden" id="repo-hidden"${this.showHidden ? ' open' : ''}>
      <summary class="repo-group">${esc(this.text('hidden'))} <span class="count">${hidden.length}</span></summary>
      <ul class="repo-list">${rows}</ul>
    </details>`;
  }

  /* ---------- changes ---------- */

  changed({ focus } = {}) {
    store.set(`${this.storeKey}-excluded`, JSON.stringify([...this.excluded]));
    store.set(`${this.storeKey}-hidden`, JSON.stringify([...this.hidden]));
    this.render();
    if (focus) this.focus(focus);
    this.onChange();
  }

  hide(id) {
    const rows = [...document.querySelectorAll('#repo-list .repo-row:not(.is-hidden) input')].map((input) => input.dataset.id);
    const neighbor = rows[rows.indexOf(id) + 1] || rows[rows.indexOf(id) - 1];
    this.hidden.add(id);
    this.changed({ focus: neighbor });
    toast(this.text('tucked_away', { name: this.items.find((item) => item.id === id)?.name || id }));
  }

  unhide(id) {
    this.hidden.delete(id);
    this.changed({ focus: id });
  }

  focus(id) {
    [...document.querySelectorAll('#repo-list input')].find((input) => input.dataset.id === id)?.focus();
  }

  wire() {
    $('#repo-list').addEventListener('change', (event) => {
      const { id } = event.target.dataset;
      if (!id) return;
      if (event.target.checked) this.excluded.delete(id);
      else this.excluded.add(id);
      this.changed({ focus: id });
    });
    $('#repo-list').addEventListener('click', (event) => {
      const hide = event.target.closest('[data-hide]');
      const unhide = event.target.closest('[data-unhide]');
      if (hide) this.hide(hide.dataset.hide);
      if (unhide) this.unhide(unhide.dataset.unhide);
    });
    $('#repo-list').addEventListener('toggle', (event) => {
      if (event.target.id === 'repo-hidden') this.showHidden = event.target.open;
    }, true);
    $('#repos-all').addEventListener('click', () => {
      this.shown().forEach((item) => this.excluded.delete(item.id));
      this.changed();
    });
    $('#repos-none').addEventListener('click', () => {
      this.shown().forEach((item) => this.excluded.add(item.id));
      this.changed();
    });
    if (matchMedia('(max-width: 860px)').matches) $('#repo-details').open = false;
  }
}
