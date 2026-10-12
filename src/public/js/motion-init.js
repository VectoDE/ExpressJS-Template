// Runs before the first paint (loaded without defer) so animated elements never flash in their final state
// and then jump back. Kept tiny on purpose; everything else lives in main.js.
(() => {
  const root = document.documentElement;
  const STYLES = ['film', 'precise', 'playful', 'calm', 'off'];
  root.classList.add('js');
  // A style picked in the footer wins over the server default. Storage can be blocked; then the default stays.
  if ('motionSwitchable' in root.dataset) {
    try {
      const saved = window.localStorage.getItem('motion-style');
      if (STYLES.includes(saved)) {
        root.dataset.motion = saved;
      }
    } catch {
      // keep the server default
    }
  }
  if (root.dataset.motion !== 'off' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('motion');
  }
})();
