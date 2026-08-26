(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer: fine)');
  const root = document.documentElement;
  const itemSelector = '.card, .lens, .experiment-card, .evolution-event, .evidence-grid article, .transition, .watch, .phase';
  let revealObserver;
  let motionFrame;
  let pointerFrame;
  let pointerGlow;
  let pointerBound = false;
  let pointerX = innerWidth / 2;
  let pointerY = innerHeight / 2;

  root.classList.add('motion-enhanced');
  root.classList.toggle('motion-reduced', reducedMotion.matches);

  function makeElement(className, parent = document.body) {
    const element = document.createElement('div');
    element.className = className;
    element.setAttribute('aria-hidden', 'true');
    parent.append(element);
    return element;
  }

  function matchingElements(rootNode, selector) {
    const elements = [];
    if (rootNode instanceof Element && rootNode.matches(selector)) elements.push(rootNode);
    rootNode.querySelectorAll?.(selector).forEach(element => elements.push(element));
    return elements;
  }

  function createAmbientField() {
    if (reducedMotion.matches || document.querySelector('.ambient-field')) return;
    const field = makeElement('ambient-field');
    const count = matchMedia('(max-width: 760px)').matches ? 14 : 34;
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement('i');
      particle.className = `ambient-particle particle-${index % 3}`;
      particle.style.setProperty('--x', `${(index * 43 + 7) % 98}%`);
      particle.style.setProperty('--y', `${(index * 67 + 11) % 94}%`);
      particle.style.setProperty('--size', `${index % 9 === 0 ? 3 : index % 5 === 0 ? 2 : 1}px`);
      particle.style.setProperty('--drift-x', `${(index % 2 ? 1 : -1) * (18 + index % 7 * 6)}px`);
      particle.style.setProperty('--drift-y', `${-28 - index % 6 * 9}px`);
      particle.style.setProperty('--duration', `${10 + index % 8 * 1.55}s`);
      particle.style.setProperty('--delay', `${-(index % 11) * 1.15}s`);
      field.append(particle);
    }
  }

  function portalBurst(anchor, variant = '') {
    if (reducedMotion.matches) return;
    const rect = anchor?.getBoundingClientRect?.();
    const burst = makeElement(`portal-burst${variant ? ` ${variant}` : ''}`);
    burst.style.left = `${rect ? rect.left + rect.width / 2 : innerWidth / 2}px`;
    burst.style.top = `${rect ? rect.top + rect.height / 2 : innerHeight / 2}px`;
    burst.addEventListener('animationend', event => {
      if (event.animationName === 'burstRing') burst.remove();
    });
    setTimeout(() => burst.remove(), 1800);
  }

  function reveal(element, delay = 0) {
    if (element.dataset.motionReady) return;
    element.dataset.motionReady = 'true';
    element.classList.add(element.matches('.section') ? 'motion-section' : 'motion-item');
    element.style.setProperty('--motion-delay', `${Math.min(delay, 440)}ms`);
    if (reducedMotion.matches || !revealObserver) element.classList.add('is-visible');
    else revealObserver.observe(element);
  }

  function bindKineticSurface(element) {
    if (element.dataset.kineticReady) return;
    element.dataset.kineticReady = 'true';
    element.addEventListener('pointermove', event => {
      if (reducedMotion.matches || !finePointer.matches) return;
      const rect = element.getBoundingClientRect();
      const horizontal = (event.clientX - rect.left) / rect.width;
      const vertical = (event.clientY - rect.top) / rect.height;
      element.style.setProperty('--tilt-x', `${(horizontal - .5) * 7}deg`);
      element.style.setProperty('--tilt-y', `${(.5 - vertical) * 6}deg`);
      element.style.setProperty('--glint-x', `${horizontal * 100}%`);
      element.style.setProperty('--glint-y', `${vertical * 100}%`);
      element.classList.add('is-kinetic');
    }, { passive: true });
    element.addEventListener('pointerleave', () => {
      element.style.setProperty('--tilt-x', '0deg');
      element.style.setProperty('--tilt-y', '0deg');
      element.classList.remove('is-kinetic');
    }, { passive: true });
  }

  function enhanceGraph(rootNode = document) {
    const nodes = matchingElements(rootNode, '.node');
    const edges = matchingElements(rootNode, '.edge');
    nodes.forEach((node, index) => {
      if (node.dataset.graphMotion) return;
      node.dataset.graphMotion = 'true';
      node.style.setProperty('--node-entry-delay', `${Math.min(index, 18) * 48}ms`);
      node.style.setProperty('--node-delay', `${.85 - (index % 8) * .52}s`);
    });
    edges.forEach((edge, index) => {
      if (edge.dataset.graphMotion) return;
      edge.dataset.graphMotion = 'true';
      edge.style.setProperty('--edge-entry-delay', `${Math.min(index, 20) * 32}ms`);
      edge.style.setProperty('--edge-delay', `${.7 - (index % 10) * .37}s`);
    });
    const graph = nodes[0]?.closest('.graph') || edges[0]?.closest('.graph') || (rootNode instanceof Element && rootNode.matches('.graph') ? rootNode : null);
    if (graph && !graph.querySelector('.graph-scan')) {
      const scan = document.createElement('span');
      scan.className = 'graph-scan';
      scan.setAttribute('aria-hidden', 'true');
      graph.append(scan);
    }
  }

  function animateCounters(rootNode = document) {
    matchingElements(rootNode, '.phase b').forEach(counter => {
      if (counter.dataset.counted) return;
      counter.dataset.counted = 'true';
      const target = Number.parseInt(counter.textContent, 10);
      if (reducedMotion.matches || !Number.isFinite(target) || target < 1) return;
      const started = performance.now();
      const duration = 820;
      const tick = now => {
        const progress = Math.min((now - started) / duration, 1);
        const eased = 1 - (1 - progress) ** 3;
        counter.textContent = String(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      counter.textContent = '0';
      requestAnimationFrame(tick);
    });
  }

  function enhanceItems(rootNode = document) {
    matchingElements(rootNode, itemSelector).forEach((item, index) => {
      reveal(item, (index % 8) * 52);
      bindKineticSurface(item);
    });
    enhanceGraph(rootNode);
    animateCounters(rootNode);
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

  function paintPointer() {
    pointerFrame = null;
    if (pointerGlow) {
      pointerGlow.style.left = `${pointerX}px`;
      pointerGlow.style.top = `${pointerY}px`;
      pointerGlow.style.opacity = '.95';
    }
    root.style.setProperty('--portal-shift-x', `${(pointerX / innerWidth - .5) * 24}px`);
    root.style.setProperty('--portal-shift-y', `${(pointerY / innerHeight - .5) * 18}px`);
  }

  function createPointerGlow() {
    if (reducedMotion.matches || !finePointer.matches) return;
    if (!pointerGlow) pointerGlow = makeElement('motion-glow');
    if (pointerBound) return;
    pointerBound = true;
    addEventListener('pointermove', event => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(paintPointer);
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => {
      if (pointerGlow) pointerGlow.style.opacity = '0';
      root.style.setProperty('--portal-shift-x', '0px');
      root.style.setProperty('--portal-shift-y', '0px');
    });
  }

  function bindActionMotion() {
    const hero = document.querySelector('.hero');
    const enter = document.getElementById('enterGraph');
    const curatorButton = document.getElementById('openCurator');
    const generate = document.getElementById('generate');
    const graph = document.getElementById('graph');

    enter?.addEventListener('click', () => {
      root.classList.remove('portal-entering');
      void hero?.offsetWidth;
      root.classList.add('portal-entering');
      portalBurst(hero, 'entry');
      setTimeout(() => root.classList.remove('portal-entering'), 1450);
    });
    curatorButton?.addEventListener('click', () => portalBurst(curatorButton, 'encounter'));

    document.addEventListener('portal:encounter-start', () => {
      root.classList.add('encounter-generating');
      portalBurst(generate, 'encounter');
    });
    document.addEventListener('portal:encounter-created', () => {
      root.classList.remove('encounter-generating');
      root.classList.add('encounter-created');
      portalBurst(document.getElementById('curator'), 'success');
      setTimeout(() => root.classList.remove('encounter-created'), 1600);
    });
    document.addEventListener('portal:encounter-failed', () => portalBurst(generate, 'failed'));
    document.addEventListener('portal:encounter-end', () => root.classList.remove('encounter-generating'));
    document.addEventListener('portal:serendipity-start', () => {
      root.classList.add('graph-searching');
      portalBurst(graph, 'serendipity');
    });
    document.addEventListener('portal:serendipity-end', () => {
      setTimeout(() => root.classList.remove('graph-searching'), 720);
    });
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
  bindActionMotion();

  requestAnimationFrame(() => {
    root.classList.add('portal-awake');
    portalBurst(document.querySelector('.portal-aperture'), 'ignition');
    setTimeout(() => {
      root.classList.remove('portal-awake');
      root.classList.add('portal-ready');
    }, 1750);
  });

  const dynamicContent = new MutationObserver(records => {
    const changedRoots = new Set();
    for (const record of records) {
      if (record.target instanceof Element) changedRoots.add(record.target);
      record.addedNodes.forEach(node => {
        if (node instanceof Element) changedRoots.add(node);
      });
    }
    changedRoots.forEach(changedRoot => enhanceItems(changedRoot));
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
      pointerGlow?.remove();
      pointerGlow = null;
      root.style.setProperty('--portal-shift-x', '0px');
      root.style.setProperty('--portal-shift-y', '0px');
    } else {
      createAmbientField();
      createPointerGlow();
    }
  });
})();
