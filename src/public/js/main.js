(() => {
  const flashMessages = document.querySelectorAll('.flash');
  flashMessages.forEach((message) => {
    setTimeout(() => {
      message.classList.add('flash-hide');
    }, 6000);
  });

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (prefersReducedMotion.matches) {
    document.documentElement.classList.add('reduced-motion');
  }
})();
