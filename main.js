// DoBBleYou Central Configuration & Dynamic Interactions
window.DoBBleYouConfig = {
  brand: {
    name: 'DoBBleYou',
    tagline: 'Construye un negocio desde eso que te hace ser tú.',
    descriptor: 'Be + Build',
    owner: 'María Fernanda Cortés Espinosa',
    palette: {
      charcoal: '#31333B',
      cyan: '#5CE1E6',
      white: '#FFFFFF'
    }
  },
  contact: {
    email: 'contacto@dobbleyou.com',
    whatsapp: '+56 9 XXXX XXXX',
    location: 'Santiago, Chile · Atención remota global'
  },
  ecosystem: {
    eresSingular: 'https://eressingular.com',
    netThinking: 'https://netthinking.cl'
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // ==================== 1. VIRTTUX-STYLE DETACHING NAVBAR ON SCROLL ====================
  const siteHeader = document.querySelector('.site-header');
  
  function updateHeaderScroll() {
    if (window.scrollY > 40) {
      siteHeader.classList.add('is-scrolled');
    } else {
      siteHeader.classList.remove('is-scrolled');
    }
  }

  window.addEventListener('scroll', updateHeaderScroll, { passive: true });
  updateHeaderScroll();

  // Mobile Nav Toggle
  const mobileToggle = document.getElementById('mobileToggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      siteHeader.classList.toggle('mobile-menu-active');
      const expanded = mobileToggle.getAttribute('aria-expanded') === 'true';
      mobileToggle.setAttribute('aria-expanded', !expanded);
    });
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (siteHeader && siteHeader.classList.contains('mobile-menu-active')) {
        siteHeader.classList.remove('mobile-menu-active');
      }
    });
  });

  // ==================== 2. TRAMA TECNOLÓGICA INTEGRADA (LIVING PARTICLE NETWORK) ====================
  // Check user preference for reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initTechCanvas(canvasId, isDark = false) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    const particleCount = isDark ? 42 : 55;
    const maxDistance = isDark ? 120 : 135;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      width = canvas.width = rect.width;
      height = canvas.height = rect.height;
    }

    window.addEventListener('resize', resize);
    resize();

    // Create particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 2 + 1.2,
        isCyan: Math.random() < 0.22,
        cyanPulse: Math.random() * Math.PI
      });
    }

    if (prefersReducedMotion) {
      // Draw static single frame
      drawStatic();
      return;
    }

    function drawStatic() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDistance) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(49,51,59,0.06)';
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Connect lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * (isDark ? 0.16 : 0.12);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = (particles[i].isCyan || particles[j].isCyan)
              ? `rgba(92, 225, 230, ${alpha * 1.5})`
              : (isDark ? `rgba(255, 255, 255, ${alpha})` : `rgba(49, 51, 59, ${alpha})`);
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Draw points
      for (let p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around bounds
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        p.cyanPulse += 0.03;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        if (p.isCyan) {
          const glowAlpha = 0.5 + Math.sin(p.cyanPulse) * 0.35;
          ctx.fillStyle = `rgba(92, 225, 230, ${glowAlpha})`;
        } else {
          ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(49, 51, 59, 0.18)';
        }
        ctx.fill();
      }

      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  // Initialize Canvas networks
  initTechCanvas('heroTechCanvas', false);
  initTechCanvas('darkTechCanvas', true);

  // ==================== 3. YOU Y SUS CINCO DOBLES DIGITALES (ENGINE & WORKFLOW) ====================
  // Clean stroke SVG icons - STRICTLY ZERO EMOJIS
  const strokeIcons = {
    search: '<svg width="16" height="16" fill="none" stroke="#5CE1E6" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    chat: '<svg width="16" height="16" fill="none" stroke="#5CE1E6" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>',
    edit: '<svg width="16" height="16" fill="none" stroke="#5CE1E6" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    chart: '<svg width="16" height="16" fill="none" stroke="#5CE1E6" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    tasks: '<svg width="16" height="16" fill="none" stroke="#5CE1E6" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>'
  };

  const doubleEntities = [
    {
      id: 'investigacion',
      role: 'Investigación',
      text: 'Resumen de oportunidades preparado',
      iconSvg: strokeIcons.search,
      requiresApproval: false
    },
    {
      id: 'atencion',
      role: 'Atención al cliente',
      text: 'Respuesta preparada con el historial',
      iconSvg: strokeIcons.chat,
      requiresApproval: true
    },
    {
      id: 'marketing',
      role: 'Marketing',
      text: 'Borrador de contenido listo',
      iconSvg: strokeIcons.edit,
      requiresApproval: false
    },
    {
      id: 'ventas',
      role: 'Ventas',
      text: 'Cotización preparada para enviar',
      iconSvg: strokeIcons.chart,
      requiresApproval: true
    },
    {
      id: 'admin',
      role: 'Administración',
      text: 'Vencimientos y tareas organizados',
      iconSvg: strokeIcons.tasks,
      requiresApproval: false
    }
  ];

  const youCentral = document.getElementById('youCentralFigure');
  const youEyes = document.querySelectorAll('.you-eye');
  const youMouth = document.querySelector('.you-mouth');
  const doubleDoms = document.querySelectorAll('.double-figure');
  const allFlowArrows = document.querySelectorAll('.you-flow-arrow');
  const approvalBox = document.getElementById('hitlApprovalBox');
  const btnApprove = document.getElementById('btnApproveAction');

  let currentDoubleIndex = 0;
  let isWaitingApproval = false;
  let workflowTimer = null;

  // A. Entrance Animation: YOU appears, then 5 doubles emerge from center to their spot
  function runEntranceAnimation() {
    doubleDoms.forEach(d => d.classList.add('collapsed'));

    setTimeout(() => {
      doubleDoms.forEach((d, idx) => {
        setTimeout(() => {
          d.classList.remove('collapsed');
        }, 120 * idx + 200);
      });

      // Once all settled, start periodic activity cycle and facial blinks
      setTimeout(() => {
        startFacialBlinks();
        if (!prefersReducedMotion) {
          startActivityCycle();
        }
      }, 1400);
    }, 400);
  }

  // B. YOU Central Facial Animations: Smooth, natural, frequent blinks & smile expressions
  function startFacialBlinks() {
    function blink() {
      youEyes.forEach(eye => eye.classList.add('blink'));
      setTimeout(() => {
        youEyes.forEach(eye => eye.classList.remove('blink'));
      }, 160);

      // Natural blink intervals (2.5s to 5.5s)
      const nextBlink = Math.random() * 3000 + 2500;
      setTimeout(blink, nextBlink);
    }

    setTimeout(blink, 1800);
  }

  function triggerYouApprovalSmile() {
    if (youMouth) {
      youMouth.classList.add('smile-broad');
      setTimeout(() => {
        youMouth.classList.remove('smile-broad');
      }, 1400);
    }
  }

  // C. Activity Sequence: One function at a time with two separated arrows (Encargo & Entrega)
  function runFunctionCycle(index) {
    if (isWaitingApproval) return;

    // 1. Reset all flow arrows and capsules to inactive state
    allFlowArrows.forEach(arrow => {
      arrow.classList.remove('active');
      arrow.classList.remove('dimmed');
      arrow.setAttribute('marker-end', 'url(#arrowhead-dim)');
    });

    doubleEntities.forEach(ent => {
      const badge = document.querySelector(`#double${ent.id.charAt(0).toUpperCase() + ent.id.slice(1)} .double-badge`);
      if (badge) {
        badge.classList.remove('result-active');
        badge.textContent = ent.role;
      }
      const fig = document.querySelector(`.pos-${ent.id}`);
      if (fig) fig.classList.remove('active');
    });

    const item = doubleEntities[index];
    const arrowOut = document.getElementById(`arrow-out-${item.id}`);
    const arrowIn = document.getElementById(`arrow-in-${item.id}`);
    const figDom = document.querySelector(`.pos-${item.id}`);
    const badgeDom = figDom ? figDom.querySelector('.double-badge') : null;

    if (!arrowOut || !arrowIn || !figDom) return;

    // Dim other arrows so the active connection shines clearly
    allFlowArrows.forEach(arrow => {
      if (arrow !== arrowOut && arrow !== arrowIn) {
        arrow.classList.add('dimmed');
      }
    });

    // STEP 1: Se ilumina en cian la flecha YOU -> Doble (El encargo)
    arrowOut.classList.add('active');
    arrowOut.setAttribute('marker-end', 'url(#arrowhead-out)');
    figDom.classList.add('active');

    // STEP 2: Después se ilumina la flecha Doble -> YOU (La entrega del resultado) y aparece el resultado en la cápsula
    setTimeout(() => {
      if (isWaitingApproval) return;

      // Deactivate outgoing arrow
      arrowOut.classList.remove('active');
      arrowOut.setAttribute('marker-end', 'url(#arrowhead-dim)');

      // Activate returning arrow: Doble -> YOU
      arrowIn.classList.add('active');
      arrowIn.setAttribute('marker-end', 'url(#arrowhead-in)');

      // La cápsula muestra el resultado breve
      if (badgeDom) {
        badgeDom.classList.add('result-active');
        badgeDom.textContent = '«' + item.text + '»';
      }

      // STEP 3: Cuando la tarea requiere aprobación, el retorno llega a YOU y la secuencia espera
      if (item.requiresApproval) {
        setTimeout(() => {
          isWaitingApproval = true;
          if (approvalBox) {
            approvalBox.classList.add('visible');
          }
        }, 1200);
      } else {
        // Avance automático tras mostrar el resultado
        setTimeout(() => {
          // Reset arrow & capsule
          arrowIn.classList.remove('active');
          arrowIn.setAttribute('marker-end', 'url(#arrowhead-dim)');
          if (badgeDom) {
            badgeDom.classList.remove('result-active');
            badgeDom.textContent = item.role;
          }
          figDom.classList.remove('active');

          currentDoubleIndex = (currentDoubleIndex + 1) % doubleEntities.length;
          workflowTimer = setTimeout(startActivityCycle, 1600);
        }, 3400);
      }
    }, 1800);
  }

  function startActivityCycle() {
    if (!isWaitingApproval) {
      runFunctionCycle(currentDoubleIndex);
    }
  }

  // Handle Human-in-the-loop 'Aprobar' Button
  if (btnApprove) {
    btnApprove.addEventListener('click', () => {
      if (!isWaitingApproval) return;
      isWaitingApproval = false;

      // Hide approval box
      if (approvalBox) approvalBox.classList.remove('visible');

      // Show delighted smile on YOU
      triggerYouApprovalSmile();

      // Reset returning arrow and capsule back to normal
      const item = doubleEntities[currentDoubleIndex];
      const arrowIn = document.getElementById(`arrow-in-${item.id}`);
      const figDom = document.querySelector(`.pos-${item.id}`);
      const badgeDom = figDom ? figDom.querySelector('.double-badge') : null;

      if (arrowIn) {
        arrowIn.classList.remove('active');
        arrowIn.setAttribute('marker-end', 'url(#arrowhead-dim)');
      }
      if (badgeDom) {
        badgeDom.classList.remove('result-active');
        badgeDom.textContent = item.role;
      }
      if (figDom) figDom.classList.remove('active');

      allFlowArrows.forEach(a => a.classList.remove('dimmed'));

      // Advance to next double
      currentDoubleIndex = (currentDoubleIndex + 1) % doubleEntities.length;
      workflowTimer = setTimeout(startActivityCycle, 1400);
    });
  }

  // Trigger entrance when hero comes into view
  const heroStage = document.getElementById('heroYouStage');
  if (heroStage) {
    if ('IntersectionObserver' in window) {
      const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            runEntranceAnimation();
            heroObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      heroObserver.observe(heroStage);
    } else {
      runEntranceAnimation();
    }
  }

  // ==================== 4. B12 DRAGGABLE APP SHOWCASE TRACK ====================
  const slider = document.getElementById('showcaseSlider');
  let isDown = false;
  let startX;
  let scrollLeft;

  if (slider) {
    slider.addEventListener('mousedown', (e) => {
      isDown = true;
      slider.classList.add('active');
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
      isDown = false;
      slider.classList.remove('active');
    });

    slider.addEventListener('mouseup', () => {
      isDown = false;
      slider.classList.remove('active');
    });

    slider.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 1.5;
      slider.scrollLeft = scrollLeft - walk;
    });
  }

  // ==================== 5. SQUARESPACE-STYLE 4-STEP GUIDED BUILDER ====================
  const builderState = {
    step: 1,
    momento: 'Tengo experiencia y quiero poner en marcha mi negocio propio',
    momentoCode: 'empezando',
    objetivos: ['Recibir consultas calificadas', 'Organizar contactos en un CRM'],
    herramientas: ['Google Workspace / Gmail', 'WhatsApp']
  };

  const stepIndicators = document.querySelectorAll('.builder-step-indicator');
  const progressLine = document.getElementById('builderProgressLine');
  const stepPanels = document.querySelectorAll('.builder-step-panel');

  function renderBuilderStep(stepNumber) {
    builderState.step = stepNumber;

    stepIndicators.forEach(ind => {
      const s = parseInt(ind.dataset.step);
      ind.classList.remove('active', 'completed');
      if (s === stepNumber) {
        ind.classList.add('active');
      } else if (s < stepNumber) {
        ind.classList.add('completed');
      }
    });

    if (progressLine) {
      const percentage = ((stepNumber - 1) / 3) * 100;
      progressLine.style.width = `${percentage}%`;
    }

    stepPanels.forEach(panel => {
      if (parseInt(panel.dataset.step) === stepNumber) {
        panel.style.display = 'block';
      } else {
        panel.style.display = 'none';
      }
    });

    if (stepNumber === 4) {
      updateBuilderSummary();
    }
  }

  document.querySelectorAll('.builder-option-radio').forEach(opt => {
    opt.addEventListener('click', () => {
      const parentStep = opt.closest('.builder-step-panel');
      parentStep.querySelectorAll('.builder-option-radio').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      builderState.momento = opt.dataset.title;
      builderState.momentoCode = opt.dataset.val;
    });
  });

  document.querySelectorAll('.builder-option-check').forEach(opt => {
    opt.addEventListener('click', () => {
      opt.classList.toggle('selected');
      const stepType = opt.dataset.type;
      const title = opt.dataset.title;

      if (stepType === 'objetivo') {
        if (opt.classList.contains('selected')) {
          if (!builderState.objetivos.includes(title)) builderState.objetivos.push(title);
        } else {
          builderState.objetivos = builderState.objetivos.filter(t => t !== title);
        }
      } else if (stepType === 'herramienta') {
        if (opt.classList.contains('selected')) {
          if (!builderState.herramientas.includes(title)) builderState.herramientas.push(title);
        } else {
          builderState.herramientas = builderState.herramientas.filter(t => t !== title);
        }
      }
    });
  });

  document.querySelectorAll('[data-builder-next]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextStep = parseInt(btn.dataset.builderNext);
      renderBuilderStep(nextStep);
    });
  });

  document.querySelectorAll('[data-builder-prev]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prevStep = parseInt(btn.dataset.builderPrev);
      renderBuilderStep(prevStep);
    });
  });

  function updateBuilderSummary() {
    const summaryMomento = document.getElementById('summaryMomento');
    const summaryObjetivos = document.getElementById('summaryObjetivos');
    const summaryHerramientas = document.getElementById('summaryHerramientas');
    const simOutput = document.getElementById('simOutput');
    const prefillInput = document.getElementById('mensaje');

    if (summaryMomento) summaryMomento.textContent = builderState.momento;

    if (summaryObjetivos) {
      summaryObjetivos.innerHTML = builderState.objetivos.length > 0
        ? builderState.objetivos.map(obj => `<li>${obj}</li>`).join('')
        : '<li>Estructura base general</li>';
    }

    if (summaryHerramientas) {
      summaryHerramientas.innerHTML = builderState.herramientas.length > 0
        ? builderState.herramientas.map(tool => `<li>${tool}</li>`).join('')
        : '<li>Partir desde cero con stack recomendado</li>';
    }

    if (simOutput) {
      simOutput.innerHTML = `
        <div style="margin-bottom: 0.6rem; color: var(--color-cyan); font-weight: 700;">Simulación activa para tu configuración:</div>
        <p>1. <strong>Captación:</strong> Una persona visita tu web y envía su consulta.</p>
        <p>2. <strong>CRM Inmediato:</strong> La ficha se crea automáticamente vinculando tu historial en ${builderState.herramientas.slice(0, 2).join(' y ') || 'el sistema'}.</p>
        <p>3. <strong>Tu Criterio:</strong> Se genera un borrador de propuesta enfocado en <em>${builderState.objetivos[0] || 'tu servicio'}</em> para que lo apruebes en 1 clic antes de responder.</p>
      `;
    }

    if (prefillInput) {
      prefillInput.value = `Hola Fer, completé el recorrido guiado en DoBBleYou:
- Momento: ${builderState.momento}
- Qué quiero conseguir: ${builderState.objetivos.join(', ')}
- Mis herramientas actuales: ${builderState.herramientas.join(', ')}
Me gustaría conversar sobre esta propuesta inicial.`;
    }
  }

  const btnFinalizarRecorrido = document.getElementById('btnFinalizarRecorrido');
  if (btnFinalizarRecorrido) {
    btnFinalizarRecorrido.addEventListener('click', () => {
      const contactSection = document.getElementById('contacto');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // ==================== 6. SCROLL REVEAL OBSERVER ====================
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -50px 0px',
      threshold: 0.1
    });

    revealElements.forEach(el => revealObserver.observe(el));
  } else {
    revealElements.forEach(el => el.classList.add('is-visible'));
  }

  // ==================== 7. ACCORDION FAQS ====================
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    questionBtn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach(other => other.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // ==================== 8. DEMO FORM HANDLING ====================
  const contactForm = document.getElementById('contactDemoForm');
  const formSuccess = document.getElementById('formSuccessNotice');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      submitBtn.innerHTML = 'Conectando con tu propuesta...';
      submitBtn.disabled = true;

      setTimeout(() => {
        contactForm.style.display = 'none';
        if (formSuccess) {
          formSuccess.style.display = 'block';
          formSuccess.classList.add('reveal-on-scroll', 'is-visible');
        }
      }, 700);
    });
  }
});
