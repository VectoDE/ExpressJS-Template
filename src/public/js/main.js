// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

// Interface behaviour and the motion controller. No dependencies, no inline styles (CSP style-src 'self'):
// values reach CSS through custom properties set via the CSSOM, which the policy allows.
(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const moving = () => root.classList.contains('motion');

  // Gives each child its position so CSS can stagger it with calc(var(--i) * ...).
  const indexChildren = (elements) => {
    elements.forEach((element, index) => element.style.setProperty('--i', String(index)));
  };

  // Headlines: wrap every word so it can rise out of its own mask. Screen readers keep the original text.
  const splitWords = (heading) => {
    const text = heading.textContent.trim();
    heading.setAttribute('aria-label', text);
    heading.textContent = '';
    text.split(/\s+/).forEach((word, index) => {
      const outer = document.createElement('span');
      outer.className = 'word';
      outer.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.className = 'word__inner';
      inner.textContent = word;
      inner.style.setProperty('--i', String(index));
      outer.append(inner);
      heading.append(outer, ' ');
    });
    heading.classList.add('is-split');
  };

  const setupMenu = () => {
    const toggle = document.querySelector('[data-menu-toggle]');
    const menu = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
    if (!menu) return;
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menu.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  };

  // Messages never disappear on their own (WCAG 2.2.1); closing one plays the exit first.
  const setupFlash = () => {
    indexChildren(document.querySelectorAll('.flash'));
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-dismiss]');
      const flash = button?.closest('.flash');
      if (!flash) return;
      if (!moving()) {
        flash.remove();
        return;
      }
      flash.classList.add('is-leaving');
      flash.addEventListener('animationend', () => flash.remove(), { once: true });
    });
  };

  const setupReveal = () => {
    const blocks = [...document.querySelectorAll('[data-reveal]')];
    // Siblings that appear together are staggered; nested lists get their own sequence.
    blocks.forEach((block) => {
      const siblings = [...block.parentElement.children].filter((child) => 'reveal' in child.dataset);
      block.style.setProperty('--i', String(Math.min(siblings.indexOf(block), 5)));
      indexChildren(block.querySelectorAll('.check-list li, .terminal__line, .session-list__item, .timeline__item'));
    });
    if (!('IntersectionObserver' in window)) {
      blocks.forEach((block) => block.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
    );
    blocks.forEach((block) => observer.observe(block));
  };

  const setupSequences = () => {
    indexChildren(document.querySelectorAll('.header-check__item'));
    document.querySelectorAll('.header-check__item').forEach((item, index) => {
      item.querySelector('.header-check__status')?.style.setProperty('--i', String(index));
    });
    indexChildren(document.querySelectorAll('.data-table tbody tr'));
    indexChildren(document.querySelectorAll('.recovery-codes code'));
    indexChildren(document.querySelectorAll('.error-code span'));
    document.querySelectorAll('.check-chain').forEach((chain) => {
      const steps = [...chain.querySelectorAll('.check-chain__step')];
      indexChildren(steps);
      steps.forEach((step, index) => {
        step.querySelector('.check-chain__node')?.style.setProperty('--i', String(index));
      });
      const current = steps.findIndex((step) => step.classList.contains('check-chain__step--current'));
      const reached = current === -1 ? steps.length - 1 : current;
      chain.style.setProperty('--chain-progress', String(steps.length > 1 ? reached / (steps.length - 1) : 0));
    });
    const qr = document.querySelector('.qr');
    if (qr) qr.style.setProperty('--qr-size', `${qr.clientHeight}px`);
  };

  // Scrollytelling: progress runs from the first step reaching the middle of the screen to the last one.
  const setupStory = () => {
    const story = document.querySelector('[data-story]');
    if (!story) return;
    const steps = [...story.querySelectorAll('[data-step]')];
    const nodes = [...story.querySelectorAll('.story__node')];
    const codes = [...story.querySelectorAll('[data-step-code]')];
    let active = -1;
    let frame = 0;

    const update = () => {
      frame = 0;
      if (!moving() || steps.length === 0) return;
      const middle = window.innerHeight / 2;
      const centres = steps.map((step) => {
        const box = step.getBoundingClientRect();
        return box.top + box.height / 2;
      });
      const first = centres[0];
      const last = centres.at(-1);
      const span = last - first;
      const progress = span > 0 ? Math.min(Math.max((middle - first) / span, 0), 1) : 0;
      story.style.setProperty('--story-progress', progress.toFixed(4));
      const current = Math.round(progress * (steps.length - 1));
      if (current === active) return;
      active = current;
      steps.forEach((step, index) => step.classList.toggle('is-active', index === current));
      nodes.forEach((node, index) => {
        node.classList.toggle('is-passed', index <= current);
        node.classList.toggle('is-active', index === current);
      });
      codes.forEach((code, index) => code.classList.toggle('is-active', index === current));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
  };

  // Account section nav: marks the section in view and moves the marker next to its link.
  const setupScrollspy = () => {
    const nav = document.querySelector('[data-scrollspy]');
    if (!nav || !('IntersectionObserver' in window)) return;
    const links = [...nav.querySelectorAll('a[href^="#"]')];
    const sections = links.map((link) => document.getElementById(link.hash.slice(1))).filter(Boolean);
    const marker = document.createElement('span');
    marker.className = 'section-nav__marker';
    marker.setAttribute('aria-hidden', 'true');
    nav.append(marker);

    const select = (id) => {
      const link = links.find((candidate) => candidate.hash === `#${id}`);
      if (!link) return;
      links.forEach((candidate) => candidate.removeAttribute('aria-current'));
      link.setAttribute('aria-current', 'true');
      marker.style.setProperty('--marker-y', `${link.offsetTop}px`);
      marker.style.setProperty('--marker-height', `${link.offsetHeight}px`);
    };
    const visible = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) =>
          visible.set(entry.target.id, entry.isIntersecting ? entry.boundingClientRect.top : null)
        );
        const inView = [...visible].filter(([, top]) => top !== null).sort((a, b) => a[1] - b[1]);
        if (inView.length) select(inView[0][0]);
      },
      { rootMargin: '-20% 0px -55% 0px' }
    );
    sections.forEach((section) => observer.observe(section));
    if (sections[0]) select(sections[0].id);
  };

  // The ring follows the real 30-second TOTP window, so it matches the authenticator app.
  const setupCodeTimer = () => {
    const timer = document.querySelector('[data-code-timer]');
    if (!timer) return;
    const tick = () => {
      const elapsed = (Date.now() / 1000) % 30;
      if (elapsed < 1) {
        timer.classList.add('is-resetting');
        // The jump back runs without transition; two frames later it is painted and the transition returns.
        requestAnimationFrame(() => requestAnimationFrame(() => timer.classList.remove('is-resetting')));
      }
      timer.style.setProperty('--timer-offset', String(Math.min(((elapsed + 1) / 30) * 100, 100)));
    };
    tick();
    window.setInterval(tick, 1000);
  };

  // Footer switch for comparing animation styles. Reloading replays every entrance in the new style.
  const setupMotionSwitch = () => {
    const group = document.querySelector('[data-motion-switch]');
    if (!group) return;
    const buttons = [...group.querySelectorAll('[data-motion-style]')];
    buttons.forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.motionStyle === root.dataset.motion))
    );
    group.hidden = false;
    group.addEventListener('click', (event) => {
      const button = event.target.closest('[data-motion-style]');
      if (!button || button.dataset.motionStyle === root.dataset.motion) return;
      try {
        window.localStorage.setItem('motion-style', button.dataset.motionStyle);
      } catch {
        // Storage blocked, so a reload would forget the choice: apply it to this page only. The new timing applies
        // at once; "off" also drops the motion class so every element shows its final state.
        root.dataset.motion = button.dataset.motionStyle;
        if (button.dataset.motionStyle === 'off') root.classList.remove('motion');
        buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
        return;
      }
      // Start from the top so the whole page plays in the new style.
      window.history.scrollRestoration = 'manual';
      window.location.reload();
    });
  };

  // Marks the submit button as busy so a slow response does not invite a second submit.
  const setupForms = () => {
    document.addEventListener('submit', (event) => {
      if (event.defaultPrevented) return;
      const button = event.submitter || event.target.querySelector('[type="submit"]');
      if (!button || button.getAttribute('aria-busy') === 'true') return;
      button.setAttribute('aria-busy', 'true');
    });
    // Coming back through the history cache must not leave buttons spinning.
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        document.querySelectorAll('[aria-busy="true"]').forEach((button) => button.removeAttribute('aria-busy'));
      }
    });
  };

  // The pages cross-fade (motion.css), but Swagger UI under /docs cannot opt in, and Chrome aborts a transition
  // into a page without the opt-in with an error. Leaving for /docs therefore skips the transition.
  const setupPageSwap = () => {
    window.addEventListener('pageswap', (event) => {
      const target = event.activation?.entry?.url;
      if (event.viewTransition && target && new URL(target).pathname.startsWith('/docs')) {
        event.viewTransition.skipTransition();
      }
    });
  };

  const start = () => {
    if (moving()) {
      document.querySelectorAll('[data-split]').forEach(splitWords);
    }
    setupMenu();
    setupFlash();
    setupReveal();
    setupSequences();
    setupStory();
    setupScrollspy();
    setupCodeTimer();
    setupMotionSwitch();
    setupForms();
    setupPageSwap();
  };

  // A visitor who switches reduced motion on mid-visit gets the final state right away.
  reducedMotion.addEventListener('change', (event) => {
    root.classList.toggle('motion', !event.matches && root.dataset.motion !== 'off');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
