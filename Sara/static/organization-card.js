(() => {
 'use strict';
 const dialog = document.getElementById('organization-details');
 const opener = document.querySelector('[data-organization-open]');
 if (!dialog || !opener) return;
 opener.addEventListener('click', () => { if (!dialog.open) dialog.showModal(); });
 dialog.querySelector('[data-organization-close]').addEventListener('click', () => dialog.close());
 dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
 });
 dialog.addEventListener('close', () => opener.focus({preventScroll:true}));
})();
