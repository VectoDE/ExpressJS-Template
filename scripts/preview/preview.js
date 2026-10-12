// Only in the static preview on GitHub Pages: there is no server, so forms and some links cannot work.
// A notice says so at the top of every page, and is announced again when someone tries one of them.
(() => {
  const TEXT = {
    en: 'Static preview: signing in, forms and changes need the running app. Start it locally with “npm run preview”.',
    de: 'Statische Vorschau: Anmelden, Formulare und Änderungen brauchen die laufende App. Lokal startet sie mit „npm run preview“.',
  };
  const text = TEXT[document.documentElement.lang] || TEXT.en;

  const notice = document.createElement('div');
  notice.className = 'flash flash--info';
  notice.setAttribute('role', 'status');
  const icon = document.createElement('span');
  icon.className = 'flash__icon';
  icon.setAttribute('aria-hidden', 'true');
  const message = document.createElement('p');
  message.textContent = text;
  notice.append(icon, message);
  const list = document.createElement('div');
  list.className = 'flash-list';
  list.append(notice);
  document.querySelector('main')?.prepend(list);

  const remind = (event) => {
    event.preventDefault();
    notice.setAttribute('role', 'alert');
    // Re-inserting the text makes screen readers announce it again.
    message.textContent = '';
    requestAnimationFrame(() => {
      message.textContent = text;
    });
    notice.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  document.addEventListener('submit', remind, true);
  document.addEventListener(
    'click',
    (event) => {
      if (event.target.closest('a[data-preview-missing]')) remind(event);
    },
    true
  );
})();
