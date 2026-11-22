/* Native navigation remains usable without JavaScript. Close the extra menu on dismissal. */
(() => {
  const menu = document.querySelector('.public-more');
  if (!menu) return;
  const summary = menu.querySelector('summary');
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      summary.focus();
    }
  });
  document.addEventListener('click', event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
  document.querySelectorAll('.public-links a').forEach(link => {
    if (new URL(link.href).pathname === location.pathname && !new URL(link.href).hash) link.setAttribute('aria-current', 'page');
  });
})();
