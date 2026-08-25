(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const itemSelector = '.card, .lens, .experiment-card, .evolution-event, .evidence-grid article';
  let revealObserver;
  let motionFrame;

  root.classList.add('motion-enhanced');

  function makeElement(className, parent = document.body) {
    const element = document.createElement('div');
    element.className = className;
    element.setAttribute('aria-hidden', 'true');
    parent.append(element);
    return element;
  }

  function createAmbientField() {
    if (reducedMotion.matches || document.querySelector('.ambient-field')) return;
    const field = makeElement('ambient-field');
    const count = matchMedia('(max-width: 760px)').matches ? 10 : 22;
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement('i');
      particle.className = 'ambient-particle';
      particle.style.setProperty('--x', `${(index * 43 + 7) % 98}%`);
      particle.style.setProperty('--y', `${(index * 67 + 11) % 94}%`);
      particle.style.setProperty('--size', `${index % 5 === 0 ? 2 : 1}px`);
      particle.style.setProperty('--drift-x', `${(index % 2 ? 1 : -1) * (18 + index % 7 * 6)}px`);
      particle.style.setProperty('--drift-y', `${-28 - index % 6 * 9}px`);
      particle.style.setProperty('--duration', `${12 + index % 8 * 1.7}s`);
      particle.style.setProperty('--delay', `${-(index % 9) * 1.4}s`);
      field.append(particle);
    }
  }

  function reveal(element, delay = 0) {
    if (element.dataset.motionReady) return;
    element.dataset.motionReady = 'true';
    element.classList.add(element.matches('.section') ? 'motion-section' : 'motion-item');
    element.style.setProperty('--motion-delay', `${Math.min(delay, 420)}ms`);
    if (reducedMotion.matches || !revealObserver) element.classList.add('is-visible');
    else revealObserver.observe(element);
  }

  function enhanceGraph(rootNode = document) {
    rootNode.querySelectorAll?.('.node').forEach((node, index) => {
      node.style.setProperty('--node-delay', `${-(index % 8) * .52}s`);
    });
    rootNode.querySelectorAll?.('.edge').forEach((edge, index) => {
      edge.style.setProperty('--edge-delay', `${-(index % 10) * .37}s`);
    });
  }

  function enhanceItems(rootNode = document) {
    const items = [];
    if (rootNode instanceof Element && rootNode.matches(itemSelector)) items.push(rootNode);
    rootNode.querySelectorAll?.(itemSelector).forEach(item => items.push(item));
    items.forEach((item, index) => reveal(item, (index % 7) * 55));
    enhanceGraph(rootNode);
  }

  function createProgress() {
    const progress = makeElement('', document.body);
    progress.id = 'motionProgress';
    const update = () => {
      motionFrame = null;
      const distance = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${distance > 0 ? Math.min(scrollY / distance, 1) : 0})`;
    };
    const requestUpdate = () => {
      if (!motionFrame) motionFrame = requestAnimationFrame(update);
    };
    addEventListener('scroll', requestUpdate, { passive: true });
    addEventListener('resize', requestUpdate, { passive: true });
    update();
  }

  function createPointerGlow() {
    if (reducedMotion.matches || !matchMedia('(pointer: fine)').matches) return;
    const glow = makeElement('motion-glow');
    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let frame;
    const paint = () => {
      frame = null;
      glow.style.left = `${x}px`;
      glow.style.top = `${y}px`;
      glow.style.opacity = '.9';
    };
    addEventListener('pointermove', event => {
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { glow.style.opacity = '0'; });
  }

  revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -7% 0px' })
    : null;

  document.querySelectorAll('.section').forEach(section => reveal(section));
  enhanceItems();
  createAmbientField();
  createProgress();
  createPointerGlow();

  const dynamicContent = new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => {
        if (node instanceof Element) enhanceItems(node);
      });
    }
  });
  dynamicContent.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('motion-paused', document.hidden);
  });

  reducedMotion.addEventListener('change', event => {
    root.classList.toggle('motion-reduced', event.matches);
    document.querySelectorAll('.motion-section, .motion-item').forEach(element => element.classList.add('is-visible'));
    if (event.matches) {
      document.querySelector('.ambient-field')?.remove();
      document.querySelector('.motion-glow')?.remove();
    } else {
      createAmbientField();
    }
  });
})();
