// A sidebar button that opens a small menu of choices (WAI-ARIA menu button with menuitemradio items).
// Arrow keys, Home and End move between choices; Escape, Tab or a click elsewhere closes it.
// Keys pressed inside the menu stay there, so page shortcuts (like `c` for a new task) don't fire.
export function sidebarMenu(button, { onChoose }) {
  const menu = document.getElementById(button.getAttribute('aria-controls'));
  const items = () => [...menu.querySelectorAll('[role="menuitemradio"]')];
  const checked = () => items().find((item) => item.getAttribute('aria-checked') === 'true') || items()[0];

  function open() {
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    checked().focus();
  }

  function close({ focus = true } = {}) {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus();
  }

  function choose(item) {
    items().forEach((other) => other.setAttribute('aria-checked', String(other === item)));
    close();
    onChoose(item);
  }

  function moveFocus(key) {
    const list = items();
    const index = list.indexOf(document.activeElement);
    const target = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.length - 1 }[key];
    if (target === undefined) return false;
    list[(target + list.length) % list.length].focus();
    return true;
  }

  button.addEventListener('click', () => (menu.hidden ? open() : close()));
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    open();
  });

  menu.addEventListener('click', (event) => {
    const item = event.target.closest('[role="menuitemradio"]');
    if (item) choose(item);
  });
  menu.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (moveFocus(event.key)) event.preventDefault();
    else if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') close({ focus: false });
  });

  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target) && !button.contains(event.target)) close({ focus: false });
  });
}
