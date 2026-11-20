/**
 * DoBBleYou — Diagnóstico de Procesos de Negocio
 * Motor dinámico de formulario por etapas, bifurcaciones inteligentes,
 * persistencia local, conexión a Firebase Firestore y panel privado para Fer.
 *
 * Tono: Primera persona singular de Fer (yo, te acompaño, revisaré, cuéntame).
 */

(function () {
  'use strict';

  // ==================== CONFIGURACIÓN & FIREBASE ====================
  const STORAGE_KEYS = {
    DRAFT: 'dobbleyou_diag_draft',
    SUBMISSIONS: 'dobbleyou_diag_submissions',
    FER_AUTH: 'dobbleyou_fer_authenticated',
    FER_NOTES: 'dobbleyou_fer_notes',
    FER_PROPOSALS: 'dobbleyou_fer_proposals'
  };

  const FER_DEFAULT_PIN = 'fer2026'; // Clave de acceso privado para Fer

  // Configuración de Firebase Proyecto dobbleyou-web
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAl6cP5Ox1ydoxCUV75cuBrYz4gGBBQY18",
    authDomain: "dobbleyou-web.firebaseapp.com",
    projectId: "dobbleyou-web",
    storageBucket: "dobbleyou-web.firebasestorage.app",
    messagingSenderId: "111679210297",
    appId: "1:111679210297:web:9674e675fc3bccf86a5ee8",
    measurementId: "G-JD851KTSTE"
  };

  let firestoreDb = null;
  let isFirebaseReady = false;

  // Inicialización segura de Firebase Firestore
  function initFirebase() {
    try {
      if (window.firebase && !window.firebase.apps.length) {
        window.firebase.initializeApp(FIREBASE_CONFIG);
        firestoreDb = window.firebase.firestore();
        isFirebaseReady = true;
        console.log('[DoBBleYou] Firebase inicializado con éxito para dobbleyou-web.');
      } else if (window.firebase && window.firebase.apps.length) {
        firestoreDb = window.firebase.firestore();
        isFirebaseReady = true;
      }
    } catch (err) {
      console.warn('[DoBBleYou] Firebase Firestore no está disponible en este momento. Se utilizará persistencia local segura.', err);
      isFirebaseReady = false;
    }
  }

  // ==================== ESTADO DEL FORMULARIO ====================
  const state = {
    currentStageId: 'inicio', // inicio, etapa1, etapa2, etapa3A, etapa3B, etapa3AB, etapa4, etapa5, etapa6, etapa7, resumen, exito
    pricingModel: 'fixed',    // 'fixed', 'quote', 'both', 'defining'
    offeringType: 'servicios', // 'productos', 'servicios', 'ambos'
    data: {},
    priorities: [], // hasta 4 prioridades ordenadas
    isReviewing: false
  };

  // Prioridades predeterminadas
  const PRESET_PRIORITIES = [
    'Atención inmediata a consultas frecuentes',
    'Elaboración y envío ágil de cotizaciones',
    'Generación y seguimiento de pagos / comprobantes',
    'Coordinación de agenda, reservas o despachos',
    'Informar el avance y estado al cliente',
    'Actualización de CRM o planillas sin recaptura',
    'Seguimiento a presupuestos no respondidos',
    'Recordatorios de renovación o recompra'
  ];

  // ==================== DEFINICIÓN DE ETAPAS DINÁMICAS ====================
  function getActiveStageSequence() {
    // Retorna la secuencia ordenada de etapas según las respuestas de la Etapa 1
    const seq = [
      { id: 'inicio', label: 'Inicio', title: 'Conozcamos tu negocio' },
      { id: 'etapa1', label: 'Etapa 1', title: 'Cómo vendes' },
      { id: 'etapa2', label: 'Etapa 2', title: 'Cómo llegan tus clientes' }
    ];

    if (state.pricingModel === 'fixed') {
      seq.push({ id: 'etapa3A', label: 'Etapa 3', title: 'Venta con precios definidos' });
    } else if (state.pricingModel === 'quote') {
      seq.push({ id: 'etapa3B', label: 'Etapa 3', title: 'Venta mediante cotización' });
    } else if (state.pricingModel === 'both') {
      seq.push({ id: 'etapa3AB', label: 'Etapa 3', title: 'Precios definidos y cotizaciones' });
    } else if (state.pricingModel === 'defining') {
      // Salta directamente a Cobro
    }

    seq.push(
      { id: 'etapa4', label: 'Etapa 4', title: 'Cobro' },
      { id: 'etapa5', label: 'Etapa 5', title: getStage5Title() },
      { id: 'etapa6', label: 'Etapa 6', title: 'Seguimiento y organización' },
      { id: 'etapa7', label: 'Etapa 7', title: 'Prioridades' },
      { id: 'resumen', label: 'Revisión', title: 'Resumen y envío' }
    );

    return seq;
  }

  function getStage5Title() {
    if (state.offeringType === 'productos') return 'Entrega de productos';
    if (state.offeringType === 'servicios') return 'Prestación de servicios';
    return 'Entrega y prestación';
  }

  // ==================== ALMACENAMIENTO & RECUPERACIÓN LOCAL ====================
  function saveDraft() {
    try {
      const draftObj = {
        updatedAt: new Date().toISOString(),
        currentStageId: state.currentStageId,
        pricingModel: state.pricingModel,
        offeringType: state.offeringType,
        priorities: state.priorities,
        data: state.data
      };
      localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(draftObj));
      indicateAutoSave('Guardado en este navegador');
    } catch (e) {
      console.warn('Error al guardar borrador local:', e);
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DRAFT);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data) {
        state.data = parsed.data || {};
        state.pricingModel = parsed.pricingModel || 'fixed';
        state.offeringType = parsed.offeringType || 'servicios';
        state.priorities = parsed.priorities || [];
        return true;
      }
    } catch (e) {
      console.warn('Error al cargar borrador:', e);
    }
    return false;
  }

  function clearDraft() {
    localStorage.removeItem(STORAGE_KEYS.DRAFT);
    state.data = {};
    state.priorities = [];
    state.pricingModel = 'fixed';
    state.offeringType = 'servicios';
  }

  function indicateAutoSave(text, isSaving = false) {
    const bar = document.getElementById('diagAutosaveText');
    const dot = document.getElementById('diagAutosaveDot');
    if (bar) bar.textContent = text;
    if (dot) {
      if (isSaving) dot.classList.add('saving');
      else dot.classList.remove('saving');
    }
  }

  // ==================== CONTROL DE NAVEGACIÓN ENTRE ETAPAS ====================
  function goToStage(stageId) {
    saveCurrentInputsToState();
    state.currentStageId = stageId;
    saveDraft();
    renderCurrentStage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goNext() {
    saveCurrentInputsToState();

    // Validar etapa actual
    const validationError = validateCurrentStage();
    if (validationError) {
      alert(validationError);
      return;
    }

    const seq = getActiveStageSequence();
    const currIdx = seq.findIndex(s => s.id === state.currentStageId);

    if (state.isReviewing) {
      state.isReviewing = false;
      goToStage('resumen');
      return;
    }

    if (currIdx >= 0 && currIdx < seq.length - 1) {
      goToStage(seq[currIdx + 1].id);
    }
  }

  function goPrev() {
    saveCurrentInputsToState();
    const seq = getActiveStageSequence();
    const currIdx = seq.findIndex(s => s.id === state.currentStageId);

    if (state.currentStageId === 'resumen' && state.isReviewing) {
      state.isReviewing = false;
    }

    if (currIdx > 0) {
      goToStage(seq[currIdx - 1].id);
    }
  }

  // ==================== RECOLECCIÓN DE DATOS ====================
  function saveCurrentInputsToState() {
    const card = document.getElementById('diagStageCard');
    if (!card) return;

    // Inputs de texto, email, number, textarea, select
    const inputs = card.querySelectorAll('input[type="text"], input[type="email"], input[type="number"], textarea, select');
    inputs.forEach(inp => {
      if (inp.name) {
        state.data[inp.name] = inp.value.trim();
      }
    });

    // Radios
    const radios = card.querySelectorAll('input[type="radio"]:checked');
    radios.forEach(rad => {
      if (rad.name) {
        state.data[rad.name] = rad.value;
      }
    });

    // Checkboxes múltiples (por ejemplo canales de llegada)
    const checkboxGroups = {};
    const checkboxes = card.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      if (cb.name && cb.name !== 'consentimiento_diagnostico') {
        if (!checkboxGroups[cb.name]) checkboxGroups[cb.name] = [];
        if (cb.checked) {
          checkboxGroups[cb.name].push(cb.value);
        }
      }
    });
    Object.keys(checkboxGroups).forEach(k => {
      state.data[k] = checkboxGroups[k];
    });

    // Detectar cambios en bifurcaciones clave
    if (state.data['etapa1_modelo_precio']) {
      state.pricingModel = state.data['etapa1_modelo_precio'];
    }
    if (state.data['etapa1_que_vendes']) {
      state.offeringType = state.data['etapa1_que_vendes'];
    }
  }

  function validateCurrentStage() {
    const cId = state.currentStageId;

    if (cId === 'etapa1') {
      if (!state.data['etapa1_modelo_precio']) {
        return 'Por favor selecciona cómo defines el precio de tus productos o servicios.';
      }
      if (!state.data['etapa1_nombre_persona']) {
        return 'Por favor ingresa tu nombre.';
      }
      if (!state.data['etapa1_nombre_negocio']) {
        return 'Por favor ingresa el nombre de tu negocio o proyecto.';
      }
      if (!state.data['etapa1_correo'] || !state.data['etapa1_correo'].includes('@')) {
        return 'Por favor ingresa un correo de contacto válido.';
      }
      if (!state.data['etapa1_que_vendes']) {
        return 'Por favor indica qué vendes (Productos, Servicios o Ambos).';
      }
      if (!state.data['etapa1_descripcion_oferta']) {
        return 'Por favor describe brevemente qué ofreces y a quién.';
      }
    }

    if (cId === 'resumen') {
      const consent = document.getElementById('consentCheckbox');
      if (consent && !consent.checked) {
        return 'Para enviar el diagnóstico, por favor marca el consentimiento para que Fer revise tus respuestas.';
      }
    }

    return null;
  }

  // ==================== RENDERIZADO DEL ENCABEZADO Y PROGRESO ====================
  function updateProgressCard() {
    const seq = getActiveStageSequence();
    const currIdx = seq.findIndex(s => s.id === state.currentStageId);
    const progressCard = document.getElementById('diagProgressCard');

    if (!progressCard) return;

    if (state.currentStageId === 'inicio' || state.currentStageId === 'exito') {
      progressCard.style.display = 'none';
      return;
    }
    progressCard.style.display = 'block';

    const stageNumElem = document.getElementById('diagStageNum');
    const stageTitleElem = document.getElementById('diagStageName');
    const progressPctElem = document.getElementById('diagProgressPct');
    const progressFill = document.getElementById('diagProgressFill');
    const pillsWrap = document.getElementById('diagPillsWrap');

    const total = seq.length - 1; // sin contar inicio
    const currentStepNum = currIdx; // 1-based index
    const pct = Math.round((currentStepNum / total) * 100);

    if (stageNumElem) stageNumElem.textContent = `${seq[currIdx].label} · Paso ${currentStepNum} de ${total}`;
    if (stageTitleElem) stageTitleElem.textContent = seq[currIdx].title;
    if (progressPctElem) progressPctElem.textContent = `${pct}%`;
    if (progressFill) progressFill.style.width = `${pct}%`;

    // Breadcrumbs interactivos
    if (pillsWrap) {
      pillsWrap.innerHTML = seq.map((s, idx) => {
        if (s.id === 'inicio') return '';
        const isCurrent = s.id === state.currentStageId;
        const isDone = idx < currIdx;
        const cls = isCurrent ? 'active' : isDone ? 'completed' : '';
        return `
          <button type="button" class="diag-step-pill ${cls}" data-stage="${s.id}" ${idx > currIdx ? 'disabled' : ''}>
            ${isDone ? '✓ ' : ''}${s.label}
          </button>
        `;
      }).join('');

      pillsWrap.querySelectorAll('.diag-step-pill:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-stage');
          if (target) goToStage(target);
        });
      });
    }
  }

  // ==================== RENDERIZADO DE LAS ETAPAS ====================
  function renderCurrentStage() {
    updateProgressCard();
    const card = document.getElementById('diagStageCard');
    if (!card) return;

    const cId = state.currentStageId;

    if (cId === 'inicio') {
      renderStageInicio(card);
    } else if (cId === 'etapa1') {
      renderStage1(card);
    } else if (cId === 'etapa2') {
      renderStage2(card);
    } else if (cId === 'etapa3A') {
      renderStage3A(card);
    } else if (cId === 'etapa3B') {
      renderStage3B(card);
    } else if (cId === 'etapa3AB') {
      renderStage3AB(card);
    } else if (cId === 'etapa4') {
      renderStage4(card);
    } else if (cId === 'etapa5') {
      renderStage5(card);
    } else if (cId === 'etapa6') {
      renderStage6(card);
    } else if (cId === 'etapa7') {
      renderStage7(card);
    } else if (cId === 'resumen') {
      renderStageResumen(card);
    } else if (cId === 'exito') {
      renderStageExito(card);
    }

    // Attach listeners to update auto-save on change
    card.querySelectorAll('input, textarea, select').forEach(elem => {
      elem.addEventListener('input', () => {
        saveCurrentInputsToState();
        saveDraft();
      });
      elem.addEventListener('change', () => {
        saveCurrentInputsToState();
        saveDraft();
      });
    });
  }

  // ---------- ETAPA 0: INICIO ----------
  function renderStageInicio(card) {
    const hasExistingDraft = localStorage.getItem(STORAGE_KEYS.DRAFT);

    card.innerHTML = `
      <div style="text-align: center; max-width: 640px; margin: 0 auto; padding: 1.5rem 0;">
        <div class="diag-header-badge">
          <span class="badge-dot"></span>
          Diagnóstico Operativo & Automatizaciones · DoBBleYou
        </div>
        
        <h1 style="font-size: 2.2rem; font-weight: 800; color: var(--color-charcoal); line-height: 1.25; margin-bottom: 1.25rem;">
          Conozcamos cómo funciona tu negocio
        </h1>
        
        <p style="font-size: 1.1rem; color: var(--diag-text-muted); line-height: 1.7; margin-bottom: 2rem;">
          Cuéntame cómo atiendes, vendes y organizas tu trabajo. Tus respuestas me ayudarán a entender tu proceso y evaluar qué tareas podemos simplificar o automatizar.
        </p>

        <div style="background: var(--color-offwhite); border-radius: var(--radius-md); padding: 1.25rem 1.5rem; text-align: left; margin-bottom: 2.5rem; border: 1px solid var(--diag-border);">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--color-charcoal); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            ¿Cómo trabajaremos en este diagnóstico?
          </h4>
          <ul style="font-size: 0.88rem; color: var(--diag-text-main); margin-left: 1.25rem; line-height: 1.6;">
            <li><strong>Todo queda guardado en tu navegador:</strong> puedes pausar, cerrar la pestaña y continuar cuando quieras.</li>
            <li><strong>Preguntas adaptadas a ti:</strong> solo verás lo relevante según vendas productos, servicios o ambos.</li>
            <li><strong>Revisión final:</strong> antes de enviarlo, verás un resumen editable completo.</li>
            <li><strong>Privacidad garantizada:</strong> nunca te pediré contraseñas ni datos sensibles de tus clientes.</li>
          </ul>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.85rem; align-items: center;">
          <button type="button" class="btn-diag btn-diag-primary" id="btnComenzar" style="font-size: 1.1rem; padding: 1rem 2.5rem;">
            Comenzar diagnóstico →
          </button>
          
          ${hasExistingDraft ? `
            <button type="button" class="btn-link-subtle" id="btnRetomarBorrador" style="font-size: 0.9rem;">
              ↺ Continuar borrador guardado en este navegador
            </button>
          ` : ''}
        </div>
      </div>
    `;

    document.getElementById('btnComenzar').addEventListener('click', () => {
      goToStage('etapa1');
    });

    const btnRetomar = document.getElementById('btnRetomarBorrador');
    if (btnRetomar) {
      btnRetomar.addEventListener('click', () => {
        loadDraft();
        goToStage(state.currentStageId || 'etapa1');
      });
    }
  }

  // ---------- ETAPA 1: CÓMO VENDES ----------
  function renderStage1(card) {
    const d = state.data;
    const model = d['etapa1_modelo_precio'] || 'fixed';
    const queVendes = d['etapa1_que_vendes'] || 'servicios';

    card.innerHTML = `
      <div class="diag-stage-intro">
        <h2>Etapa 1. Cómo vendes</h2>
        <p>Empecemos por el corazón de tus ingresos: cómo defines tus precios y qué ofreces al mercado.</p>
      </div>

      <!-- Pregunta 1 Principal con Bifurcación -->
      <div class="diag-q-group">
        <label class="diag-q-label">
          ¿Cómo defines el precio de tus productos o servicios? <span class="diag-q-req">*</span>
        </label>
        <p class="diag-q-hint">Esta respuesta ajustará automáticamente las siguientes preguntas a tu modelo real.</p>
        
        <div class="diag-options-grid">
          <label class="diag-option-card ${model === 'fixed' ? 'is-selected' : ''}">
            <input type="radio" name="etapa1_modelo_precio" value="fixed" ${model === 'fixed' ? 'checked' : ''}>
            <div class="diag-option-info">
              <span class="diag-option-title">1. Tengo productos o servicios con precios definidos en una lista o catálogo.</span>
              <span class="diag-option-desc">Precios estandarizados, listas públicas o valores fijos por ítem.</span>
            </div>
          </label>

          <label class="diag-option-card ${model === 'quote' ? 'is-selected' : ''}">
            <input type="radio" name="etapa1_modelo_precio" value="quote" ${model === 'quote' ? 'checked' : ''}>
            <div class="diag-option-info">
              <span class="diag-option-title">2. Preparo un presupuesto o cotización según lo que necesita cada cliente.</span>
              <span class="diag-option-desc">Valores variables calculados por horas, insumos, complejidad o alcance a medida.</span>
            </div>
          </label>

          <label class="diag-option-card ${model === 'both' ? 'is-selected' : ''}">
            <input type="radio" name="etapa1_modelo_precio" value="both" ${model === 'both' ? 'checked' : ''}>
            <div class="diag-option-info">
              <span class="diag-option-title">3. Combino precios definidos y cotizaciones a medida.</span>
              <span class="diag-option-desc">Tengo ofertas fijas de entrada y servicios o proyectos personalizados.</span>
            </div>
          </label>

          <label class="diag-option-card ${model === 'defining' ? 'is-selected' : ''}">
            <input type="radio" name="etapa1_modelo_precio" value="defining" ${model === 'defining' ? 'checked' : ''}>
            <div class="diag-option-info">
              <span class="diag-option-title">4. Todavía estoy definiendo cómo cobrar.</span>
              <span class="diag-option-desc">Aún no cuento con una tarifa fija ni un cotizador establecido.</span>
            </div>
          </label>
        </div>

        <!-- Campo condicional si está definiendo cómo cobrar -->
        <div id="boxCobroDefiniendo" class="diag-subfield" style="display: ${model === 'defining' ? 'block' : 'none'};">
          <label class="diag-subfield-label">¿Cómo lo resuelves actualmente en el día a día?</label>
          <textarea class="diag-textarea" name="etapa1_cobro_definiendo_detalle" placeholder="Ej: Cobro según conversación previa, acuerdo de palabra o todavía estoy experimentando tarifas...">${d['etapa1_cobro_definiendo_detalle'] || ''}</textarea>
        </div>
      </div>

      <!-- Datos del negocio y contacto -->
      <div class="diag-q-group">
        <label class="diag-q-label">Tus datos y los de tu negocio</label>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.75rem;">
          <div>
            <label class="diag-subfield-label">Tu nombre y apellido <span class="diag-q-req">*</span></label>
            <input type="text" class="diag-input" name="etapa1_nombre_persona" placeholder="Ej: Carla Morales" value="${d['etapa1_nombre_persona'] || ''}" required>
          </div>
          <div>
            <label class="diag-subfield-label">Nombre del negocio o proyecto <span class="diag-q-req">*</span></label>
            <input type="text" class="diag-input" name="etapa1_nombre_negocio" placeholder="Ej: Estudio Botánico" value="${d['etapa1_nombre_negocio'] || ''}" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
          <div>
            <label class="diag-subfield-label">Correo electrónico de contacto <span class="diag-q-req">*</span></label>
            <input type="email" class="diag-input" name="etapa1_correo" placeholder="carla@negocio.cl" value="${d['etapa1_correo'] || ''}" required>
          </div>
          <div>
            <label class="diag-subfield-label">Sitio web o red social principal (opcional)</label>
            <input type="text" class="diag-input" name="etapa1_web_social" placeholder="www.estudiobotanico.cl o @estudiobotanico" value="${d['etapa1_web_social'] || ''}">
          </div>
        </div>
      </div>

      <!-- Qué vendes -->
      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué vendes principalmente? <span class="diag-q-req">*</span></label>
        <div class="diag-options-grid grid-2" style="grid-template-columns: repeat(3, 1fr);">
          <label class="diag-option-card ${queVendes === 'productos' ? 'is-selected' : ''}">
            <input type="radio" name="etapa1_que_vendes" value="productos" ${queVendes === 'productos' ? 'checked' : ''}>
            <div class="diag-option-info">
              <span class="diag-option-title">Productos</span>
            </div>
          </label>
          <label class="diag-option-card ${queVendes === 'servicios' ? 'is-selected' : ''}">
            <input type="radio" name="etapa1_que_vendes" value="servicios" ${queVendes === 'servicios' ? 'checked' : ''}>
            <div class="diag-option-info">
              <span class="diag-option-title">Servicios</span>
            </div>
          </label>
          <label class="diag-option-card ${queVendes === 'ambos' ? 'is-selected' : ''}">
            <input type="radio" name="etapa1_que_vendes" value="ambos" ${queVendes === 'ambos' ? 'checked' : ''}>
            <div class="diag-option-info">
              <span class="diag-option-title">Ambos</span>
            </div>
          </label>
        </div>
      </div>

      <!-- Descripción de la oferta -->
      <div class="diag-q-group">
        <label class="diag-q-label">
          Describe brevemente qué ofreces y a quién <span class="diag-q-req">*</span>
        </label>
        <p class="diag-q-hint">Ej: “Diseño arreglos florales para eventos y novias” o “Asesoro a pymes gastronómicas en optimización de costos”.</p>
        <textarea class="diag-textarea" name="etapa1_descripcion_oferta" placeholder="Cuéntame en 2 o 3 líneas tu propuesta central..." required>${d['etapa1_descripcion_oferta'] || ''}</textarea>
      </div>

      ${renderNavButtons(false, true)}
    `;

    // Interacción dinámica en selector de precios
    card.querySelectorAll('input[name="etapa1_modelo_precio"]').forEach(rad => {
      rad.addEventListener('change', (e) => {
        state.pricingModel = e.target.value;
        const boxDef = document.getElementById('boxCobroDefiniendo');
        if (boxDef) boxDef.style.display = (e.target.value === 'defining') ? 'block' : 'none';
        updateOptionCardsSelection(card, 'etapa1_modelo_precio');
        updateProgressCard();
      });
    });

    card.querySelectorAll('input[name="etapa1_que_vendes"]').forEach(rad => {
      rad.addEventListener('change', (e) => {
        state.offeringType = e.target.value;
        updateOptionCardsSelection(card, 'etapa1_que_vendes');
        updateProgressCard();
      });
    });

    attachNavListeners();
  }

  // ---------- ETAPA 2: CÓMO LLEGAN TUS CLIENTES ----------
  function renderStage2(card) {
    const d = state.data;
    const canales = d['etapa2_canales_consulta'] || [];

    card.innerHTML = `
      <div class="diag-stage-intro">
        <h2>Etapa 2. Cómo llegan tus clientes</h2>
        <p>Mapeemos los canales por los que te contactan y el primer contacto hasta que se abre una oportunidad.</p>
      </div>

      <!-- Canales de consulta -->
      <div class="diag-q-group">
        <label class="diag-q-label">¿Por dónde llegan las consultas?</label>
        <p class="diag-q-hint">Selecciona todos los que uses frecuentemente.</p>
        
        <div class="diag-options-grid grid-2">
          ${[
            ['WhatsApp', 'whatsapp'],
            ['Formulario web / Sitio web', 'formulario_web'],
            ['Teléfono / Llamadas', 'telefono'],
            ['Correo electrónico', 'correo'],
            ['Redes sociales (Instagram, LinkedIn, etc.)', 'redes_sociales'],
            ['Recomendaciones / Boca a boca', 'recomendaciones'],
            ['Local físico / Presencial', 'local_fisico'],
            ['Plataformas de venta (MercadoLibre, Shopify, etc.)', 'plataformas_venta']
          ].map(([label, val]) => `
            <label class="diag-option-card ${canales.includes(val) ? 'is-selected' : ''}">
              <input type="checkbox" name="etapa2_canales_consulta" value="${val}" ${canales.includes(val) ? 'checked' : ''}>
              <div class="diag-option-info">
                <span class="diag-option-title">${label}</span>
              </div>
            </label>
          `).join('')}
        </div>

        <div class="diag-subfield" style="margin-top: 1rem;">
          <label class="diag-subfield-label">¿Otro canal? Indícalo aquí:</label>
          <input type="text" class="diag-input" name="etapa2_canales_otro" placeholder="Ej: Ferias, convenios de empresa..." value="${d['etapa2_canales_otro'] || ''}">
        </div>
      </div>

      <!-- Registro de origen -->
      <div class="diag-q-group">
        <label class="diag-q-label">¿Cómo registras de dónde llegó cada persona?</label>
        <div class="diag-options-grid">
          ${[
            ['En un CRM o software de clientes', 'crm'],
            ['En una planilla (Excel / Google Sheets)', 'planilla'],
            ['En un cuaderno, agenda o notas personales', 'notas'],
            ['Solo en mi memoria / no lo registro formalmente', 'memoria'],
            ['Todavía no tengo un proceso definido', 'sin_definir']
          ].map(([label, val]) => `
            <label class="diag-option-card ${d['etapa2_registro_origen'] === val ? 'is-selected' : ''}">
              <input type="radio" name="etapa2_registro_origen" value="${val}" ${d['etapa2_registro_origen'] === val ? 'checked' : ''}>
              <div class="diag-option-info"><span class="diag-option-title">${label}</span></div>
            </label>
          `).join('')}
        </div>
        <div class="diag-subfield">
          <label class="diag-subfield-label">Detalle o herramienta específica que usas (opcional):</label>
          <input type="text" class="diag-input" name="etapa2_registro_origen_detalle" placeholder="Ej: Notion, HubSpot, libreta..." value="${d['etapa2_registro_origen_detalle'] || ''}">
        </div>
      </div>

      <!-- Volumen de consultas y conversión -->
      <div class="diag-q-group">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
          <div>
            <label class="diag-q-label">Aproximadamente, ¿cuántas consultas recibes por semana?</label>
            <select class="diag-select" name="etapa2_volumen_semanal">
              <option value="">Selecciona un rango...</option>
              <option value="menos_10" ${d['etapa2_volumen_semanal'] === 'menos_10' ? 'selected' : ''}>Menos de 10 consultas / semana</option>
              <option value="10_a_30" ${d['etapa2_volumen_semanal'] === '10_a_30' ? 'selected' : ''}>Entre 10 y 30 consultas / semana</option>
              <option value="30_a_100" ${d['etapa2_volumen_semanal'] === '30_a_100' ? 'selected' : ''}>Entre 30 y 100 consultas / semana</option>
              <option value="mas_100" ${d['etapa2_volumen_semanal'] === 'mas_100' ? 'selected' : ''}>Más de 100 consultas / semana</option>
            </select>
          </div>
          <div>
            <label class="diag-q-label">Aproximadamente, ¿cuántas terminan en venta?</label>
            <input type="text" class="diag-input" name="etapa2_tasa_conversion" placeholder="Ej: 3 de cada 10, o el 25%..." value="${d['etapa2_tasa_conversion'] || ''}">
          </div>
        </div>
      </div>

      <!-- Primeros pasos con consulta nueva -->
      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué haces cuando recibes una consulta nueva?</label>
        <p class="diag-q-hint">Describe tu reacción inmediata: ¿respondes manual, tienes un mensaje predefinido, solicitas datos?</p>
        <textarea class="diag-textarea" name="etapa2_reaccion_consulta" placeholder="Ej: Leo el mensaje, envío un saludo con las preguntas clave o el PDF de precios...">${d['etapa2_reaccion_consulta'] || ''}</textarea>
      </div>

      <!-- Preguntas frecuentes de clientes -->
      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué preguntas te hacen con mayor frecuencia?</label>
        <textarea class="diag-textarea" name="etapa2_preguntas_frecuentes" placeholder="Ej: Disponibilidad de fechas, tiempos de entrega, formas de pago, si incluye tal detalle...">${d['etapa2_preguntas_frecuentes'] || ''}</textarea>
      </div>

      <!-- Datos o documentos necesarios y dónde los guardas -->
      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué datos o documentos necesitas del cliente para atender su solicitud?</label>
        <input type="text" class="diag-input" name="etapa2_datos_necesarios" placeholder="Ej: RUT/ID, dirección, medidas, archivos de diseño, fecha del evento..." value="${d['etapa2_datos_necesarios'] || ''}">
        
        <div style="margin-top: 1rem;">
          <label class="diag-q-label">¿Dónde guardas esa información?</label>
          <input type="text" class="diag-input" name="etapa2_donde_guardas_datos" placeholder="Ej: En el chat de WhatsApp, en una carpeta de Google Drive, en una planilla..." value="${d['etapa2_donde_guardas_datos'] || ''}">
        </div>
      </div>

      ${renderNavButtons(true, true)}
    `;

    attachOptionCardsCheckboxListeners(card);
    attachOptionCardsRadioListeners(card, 'etapa2_registro_origen');
    attachNavListeners();
  }

  // ---------- ETAPA 3A: VENTA CON PRECIOS DEFINIDOS ----------
  function renderStage3A(card) {
    const d = state.data;

    card.innerHTML = `
      <div class="diag-stage-intro">
        <h2>Etapa 3. Venta con precios definidos</h2>
        <p>Analicemos cómo mantienes, comunicas y actualizas tu catálogo o lista de precios fijos.</p>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Dónde mantienes tu catálogo y lista de precios?</label>
        <div class="diag-options-grid grid-2">
          ${[
            ['Documento PDF o presentación digital', 'pdf'],
            ['Planilla Excel o Google Sheets', 'sheets'],
            ['En mi sitio web o tienda online', 'web_ecommerce'],
            ['Catálogo de WhatsApp Business', 'catalogo_wsp'],
            ['Lista física o impresa', 'fisica'],
            ['Mensajes de texto guardados o notas en el móvil', 'notas_movil'],
            ['Todavía no tengo un proceso definido', 'sin_definir']
          ].map(([label, val]) => `
            <label class="diag-option-card ${d['etapa3A_donde_catalogo'] === val ? 'is-selected' : ''}">
              <input type="radio" name="etapa3A_donde_catalogo" value="${val}" ${d['etapa3A_donde_catalogo'] === val ? 'checked' : ''}>
              <div class="diag-option-info"><span class="diag-option-title">${label}</span></div>
            </label>
          `).join('')}
        </div>
        <div class="diag-subfield">
          <label class="diag-subfield-label">¿Otro lugar o detalle? Explica brevemente:</label>
          <input type="text" class="diag-input" name="etapa3A_donde_catalogo_otro" value="${d['etapa3A_donde_catalogo_otro'] || ''}">
        </div>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Cuántos productos o servicios ofreces aproximadamente?</label>
        <input type="text" class="diag-input" name="etapa3A_cantidad_ofertas" placeholder="Ej: 15 productos activos, o 3 planes mensuales..." value="${d['etapa3A_cantidad_ofertas'] || ''}">
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Cómo consulta el cliente los precios?</label>
        <textarea class="diag-textarea" name="etapa3A_como_consulta_precios" placeholder="Ej: Los ve directo en la web, o me escribe al chat y le envío el PDF o la lista por mensaje...">${d['etapa3A_como_consulta_precios'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Cómo elige y realiza su pedido o reserva?</label>
        <textarea class="diag-textarea" name="etapa3A_como_elige_pedido" placeholder="Ej: Me dice por WhatsApp los códigos que quiere, o usa un carrito de compras, o llena un formulario...">${d['etapa3A_como_elige_pedido'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿El precio cambia por cantidad, variante, personalización, descuentos o traslado?</label>
        <p class="diag-q-hint">Explica qué factores modifican el valor final y cómo calculas esa variación.</p>
        <textarea class="diag-textarea" name="etapa3A_factores_cambio_precio" placeholder="Ej: Cobro despacho según comuna, 10% descuento por más de 3 unidades, recargo por personalización...">${d['etapa3A_factores_cambio_precio'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Necesitas comprobar disponibilidad, stock o agenda antes de confirmar?</label>
        <div class="diag-options-grid grid-2">
          ${[
            ['Sí, siempre debo revisar stock o agenda', 'siempre'],
            ['A veces, solo para ciertas fechas o productos especiales', 'a_veces'],
            ['No, siempre está disponible o es digital', 'no_aplica']
          ].map(([label, val]) => `
            <label class="diag-option-card ${d['etapa3A_comprobar_disponibilidad'] === val ? 'is-selected' : ''}">
              <input type="radio" name="etapa3A_comprobar_disponibilidad" value="${val}" ${d['etapa3A_comprobar_disponibilidad'] === val ? 'checked' : ''}>
              <div class="diag-option-info"><span class="diag-option-title">${label}</span></div>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Cómo registras el pedido y confirmas el importe final?</label>
        <textarea class="diag-textarea" name="etapa3A_registro_pedido_importe" placeholder="Ej: Escribo el resumen en el chat, saco la cuenta con calculadora y lo anoto en Excel...">${d['etapa3A_registro_pedido_importe'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué pasos requieren obligatoriamente tu revisión personal?</label>
        <textarea class="diag-textarea" name="etapa3A_pasos_revision_humana" placeholder="Ej: Aprobar descuentos especiales, confirmar que haya insumos, verificar dirección de entrega...">${d['etapa3A_pasos_revision_humana'] || ''}</textarea>
      </div>

      ${renderNavButtons(true, true)}
    `;

    attachOptionCardsRadioListeners(card, 'etapa3A_donde_catalogo');
    attachOptionCardsRadioListeners(card, 'etapa3A_comprobar_disponibilidad');
    attachNavListeners();
  }

  // ---------- ETAPA 3B: VENTA MEDIANTE COTIZACIÓN ----------
  function renderStage3B(card) {
    const d = state.data;

    card.innerHTML = `
      <div class="diag-stage-intro">
        <h2>Etapa 3. Venta mediante cotización</h2>
        <p>Revisemos cómo armas propuestas personalizadas, calculas costos y cierras acuerdos a medida.</p>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué necesitas saber del cliente para poder cotizar?</label>
        <textarea class="diag-textarea" name="etapa3B_que_necesitas_saber" placeholder="Ej: Metros cuadrados, número de asistentes, horas estimadas, plazo de entrega, objetivos...">${d['etapa3B_que_necesitas_saber'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">Describe, en orden, cómo preparas una cotización</label>
        <p class="diag-q-hint">Paso 1, Paso 2, Paso 3... desde que tienes los datos hasta que el cliente la recibe.</p>
        <textarea class="diag-textarea diag-textarea-lg" name="etapa3B_pasos_preparacion" placeholder="1. Reúno requerimientos. 2. Abro mi plantilla. 3. Calculo costos y margen. 4. Exporto a PDF y envío...">${d['etapa3B_pasos_preparacion'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿De dónde obtienes los precios?</label>
        <div class="diag-options-grid grid-2">
          ${[
            ['Cálculo propio según horas y costos estimados', 'calculo_horas'],
            ['Planilla con fórmulas automáticas', 'planilla'],
            ['Consulto listas de proveedores o terceros', 'proveedor'],
            ['Plataforma externa o cotizador online', 'plataforma'],
            ['Lista de precios de referencia', 'lista_referencia'],
            ['Otro método / Todavía no tengo un proceso definido', 'otro']
          ].map(([label, val]) => `
            <label class="diag-option-card ${d['etapa3B_origen_precios'] === val ? 'is-selected' : ''}">
              <input type="radio" name="etapa3B_origen_precios" value="${val}" ${d['etapa3B_origen_precios'] === val ? 'checked' : ''}>
              <div class="diag-option-info"><span class="diag-option-title">${label}</span></div>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="diag-q-group">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label class="diag-q-label">¿Qué factores modifican el importe?</label>
            <input type="text" class="diag-input" name="etapa3B_factores_modifican" placeholder="Urgencia, alcance, insumos..." value="${d['etapa3B_factores_modifican'] || ''}">
          </div>
          <div>
            <label class="diag-q-label">¿Qué herramientas usas para calcularlo?</label>
            <input type="text" class="diag-input" name="etapa3B_herramientas_calculo" placeholder="Google Sheets, Excel, Notion..." value="${d['etapa3B_herramientas_calculo'] || ''}">
          </div>
        </div>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Dependes de información o aprobación de otra persona o empresa?</label>
        <input type="text" class="diag-input" name="etapa3B_depende_aprobacion" placeholder="Ej: No, decido yo / Sí, cotización de un proveedor externo o socio..." value="${d['etapa3B_depende_aprobacion'] || ''}">
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Presentas una propuesta única o varias alternativas?</label>
        <div class="diag-options-grid grid-2">
          ${[
            ['Propuesta única con el alcance solicitado', 'unica'],
            ['2 o 3 alternativas / paquetes con distinto alcance', 'paquetes'],
            ['Depende de cada cliente y presupuesto', 'depende']
          ].map(([label, val]) => `
            <label class="diag-option-card ${d['etapa3B_alternativas_propuesta'] === val ? 'is-selected' : ''}">
              <input type="radio" name="etapa3B_alternativas_propuesta" value="${val}" ${d['etapa3B_alternativas_propuesta'] === val ? 'checked' : ''}>
              <div class="diag-option-info"><span class="diag-option-title">${label}</span></div>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Cómo preparas y envías la cotización?</label>
        <textarea class="diag-textarea" name="etapa3B_como_envias" placeholder="Ej: PDF adjunto por correo, mensaje detallado de WhatsApp, enlace web interactivo...">${d['etapa3B_como_envias'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label class="diag-q-label">¿Cuánto tardas aproximadamente en preparar una?</label>
            <input type="text" class="diag-input" name="etapa3B_tiempo_preparacion" placeholder="Ej: 30 minutos, 2 horas, 1 día..." value="${d['etapa3B_tiempo_preparacion'] || ''}">
          </div>
          <div>
            <label class="diag-q-label">¿Cuántas cotizaciones haces por semana?</label>
            <input type="text" class="diag-input" name="etapa3B_cotizaciones_semana" placeholder="Ej: 3 a 5 cotizaciones/semana..." value="${d['etapa3B_cotizaciones_semana'] || ''}">
          </div>
        </div>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿La cotización tiene vigencia? ¿Cómo manejas los cambios?</label>
        <textarea class="diag-textarea" name="etapa3B_vigencia_cambios" placeholder="Ej: Validez por 15 días; si piden cambios rehago el documento y actualizo la versión...">${d['etapa3B_vigencia_cambios'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Cómo confirma el cliente que acepta?</label>
        <textarea class="diag-textarea" name="etapa3B_como_confirma_cliente" placeholder="Ej: Con un mensaje de WhatsApp, firmando la propuesta, pagando el anticipo...">${d['etapa3B_como_confirma_cliente'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué decisiones necesitan siempre tu revisión personal?</label>
        <textarea class="diag-textarea" name="etapa3B_decisiones_revision_humana" placeholder="Ej: Descuentos sobre el margen, plazos de entrega ajustados, condiciones de pago especiales...">${d['etapa3B_decisiones_revision_humana'] || ''}</textarea>
      </div>

      ${renderNavButtons(true, true)}
    `;

    attachOptionCardsRadioListeners(card, 'etapa3B_origen_precios');
    attachOptionCardsRadioListeners(card, 'etapa3B_alternativas_propuesta');
    attachNavListeners();
  }

  // ---------- ETAPA 3 COMBINADA: CATÁLOGO + COTIZACIONES ----------
  function renderStage3AB(card) {
    const d = state.data;

    card.innerHTML = `
      <div class="diag-stage-intro">
        <h2>Etapa 3. Precios definidos y cotizaciones a medida</h2>
        <p>Dado que combinas ambos modelos, comprendamos cómo conviven en tu negocio sin duplicar información.</p>
      </div>

      <!-- Pregunta clave de integración -->
      <div class="diag-q-group" style="background: var(--diag-cyan-subtle); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--color-cyan-border);">
        <label class="diag-q-label" style="color: var(--color-charcoal);">
          ¿A qué productos o servicios corresponde cada modelo?
        </label>
        <p class="diag-q-hint">Indica cuáles vendes con precio fijo y cuáles cotizas a medida.</p>
        <textarea class="diag-textarea" name="etapa3AB_distribucion_modelos" placeholder="Ej: Vendo asesorías iniciales y talleres a precio fijo; pero los proyectos de consultoría a medida los cotizo uno a uno...">${d['etapa3AB_distribucion_modelos'] || ''}</textarea>
      </div>

      <!-- Sección Precios Fijos -->
      <div style="margin-top: 1.75rem;">
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--color-charcoal); margin-bottom: 0.75rem;">
          Parte A · Para tus ofertas con precio definido:
        </h3>
        
        <div class="diag-q-group">
          <label class="diag-q-label">¿Dónde mantienes tu catálogo y cómo lo consulta el cliente?</label>
          <textarea class="diag-textarea" name="etapa3A_donde_catalogo_ambos" placeholder="Web, PDF, lista en WhatsApp...">${d['etapa3A_donde_catalogo_ambos'] || ''}</textarea>
        </div>

        <div class="diag-q-group">
          <label class="diag-q-label">¿El precio cambia por variantes, volumen o traslado? ¿Necesitas confirmar stock/agenda?</label>
          <textarea class="diag-textarea" name="etapa3A_factores_y_stock_ambos" placeholder="Detalla cómo operas con los fijos...">${d['etapa3A_factores_y_stock_ambos'] || ''}</textarea>
        </div>
      </div>

      <!-- Sección Cotizaciones -->
      <div style="margin-top: 2rem;">
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--color-charcoal); margin-bottom: 0.75rem;">
          Parte B · Para tus cotizaciones a medida:
        </h3>
        
        <div class="diag-q-group">
          <label class="diag-q-label">¿Qué necesitas saber del cliente y qué herramientas usas para calcular la cotización?</label>
          <textarea class="diag-textarea" name="etapa3B_calculo_y_herramientas_ambos" placeholder="Requerimientos, planilla, fórmula de horas...">${d['etapa3B_calculo_y_herramientas_ambos'] || ''}</textarea>
        </div>

        <div class="diag-q-group">
          <label class="diag-q-label">¿Cómo envías la cotización, cuánto tardas y cómo confirma la aceptación?</label>
          <textarea class="diag-textarea" name="etapa3B_envio_y_cierre_ambos" placeholder="Formato, tiempos de respuesta, confirmación y vigencia...">${d['etapa3B_envio_y_cierre_ambos'] || ''}</textarea>
        </div>

        <div class="diag-q-group">
          <label class="diag-q-label">En ambos casos, ¿qué pasos requieren siempre tu revisión?</label>
          <textarea class="diag-textarea" name="etapa3AB_puntos_revision_humana" placeholder="Decisiones críticas que nunca automatizarías a ciegas...">${d['etapa3AB_puntos_revision_humana'] || ''}</textarea>
        </div>
      </div>

      ${renderNavButtons(true, true)}
    `;

    attachNavListeners();
  }

  // ---------- ETAPA 4: COBRO ----------
  function renderStage4(card) {
    const d = state.data;
    const mediosPago = d['etapa4_medios_pago'] || [];

    card.innerHTML = `
      <div class="diag-stage-intro">
        <h2>Etapa 4. Cobro</h2>
        <p>Examinemos el flujo del dinero: cuándo cobras, cómo recibes los pagos y cómo los concilias.</p>
      </div>

      <!-- Momento del cobro -->
      <div class="diag-q-group">
        <label class="diag-q-label">¿En qué momento cobras?</label>
        <div class="diag-options-grid grid-2">
          ${[
            ['100% anticipado (antes de iniciar o despachar)', '100_anticipado'],
            ['Al momento de la entrega o término del trabajo', 'contra_entrega'],
            ['Anticipo (seña o pie) y saldo al finalizar', 'anticipo_saldo'],
            ['Pagos periódicos / cuotas mensuales', 'periodico_cuotas'],
            ['Crédito a 30 o 60 días con factura', 'credito_factura'],
            ['Todavía no tengo un proceso definido', 'sin_definir']
          ].map(([label, val]) => `
            <label class="diag-option-card ${d['etapa4_momento_cobro'] === val ? 'is-selected' : ''}">
              <input type="radio" name="etapa4_momento_cobro" value="${val}" ${d['etapa4_momento_cobro'] === val ? 'checked' : ''}>
              <div class="diag-option-info"><span class="diag-option-title">${label}</span></div>
            </label>
          `).join('')}
        </div>
        <div class="diag-subfield">
          <label class="diag-subfield-label">¿Otro esquema? Explícalo aquí:</label>
          <input type="text" class="diag-input" name="etapa4_momento_cobro_otro" value="${d['etapa4_momento_cobro_otro'] || ''}">
        </div>
      </div>

      <!-- Medios de pago -->
      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué medios de pago utilizas?</label>
        <div class="diag-options-grid grid-2">
          ${[
            ['Transferencia bancaria directa', 'transferencia'],
            ['Tarjetas de crédito o débito presenciales', 'pos_tarjeta'],
            ['Efectivo', 'efectivo'],
            ['Enlaces de pago (Transbank, MercadoPago, Flow, Stripe, etc.)', 'enlace_pago'],
            ['Pasarela integrada en e-commerce / web', 'pasarela_web'],
            ['Cheque o documento comercial', 'cheque']
          ].map(([label, val]) => `
            <label class="diag-option-card ${mediosPago.includes(val) ? 'is-selected' : ''}">
              <input type="checkbox" name="etapa4_medios_pago" value="${val}" ${mediosPago.includes(val) ? 'checked' : ''}>
              <div class="diag-option-info"><span class="diag-option-title">${label}</span></div>
            </label>
          `).join('')}
        </div>
      </div>

      <!-- Pasos tras aceptación hasta instrucciones de pago -->
      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué pasos sigues desde que el cliente acepta hasta que recibe las instrucciones de pago?</label>
        <textarea class="diag-textarea" name="etapa4_pasos_instrucciones_pago" placeholder="Ej: Envío mis datos bancarios por WhatsApp, o le genero un link de pago con el total...">${d['etapa4_pasos_instrucciones_pago'] || ''}</textarea>
      </div>

      <!-- Enlaces de pago -->
      <div class="diag-q-group">
        <label class="diag-q-label">Si utilizas enlaces de pago, ¿cómo los generas y de dónde tomas el importe?</label>
        <textarea class="diag-textarea" name="etapa4_como_generas_enlaces" placeholder="Ej: Entro a la app de Flow/Mercado Pago, digito el monto a mano y copio el link / No aplica...">${d['etapa4_como_generas_enlaces'] || ''}</textarea>
      </div>

      <!-- Comprobación y registro del pago -->
      <div class="diag-q-group">
        <label class="diag-q-label">¿Cómo compruebas y registras el pago?</label>
        <textarea class="diag-textarea" name="etapa4_comprobacion_registro_pago" placeholder="Ej: Pido el comprobante de transferencia al cliente y reviso la app del banco para confirmar el abono...">${d['etapa4_comprobacion_registro_pago'] || ''}</textarea>
      </div>

      <!-- Relación pago con pedido/cliente -->
      <div class="diag-q-group">
        <label class="diag-q-label">¿Cómo relacionas cada pago con el cliente y su pedido o cotización?</label>
        <textarea class="diag-textarea" name="etapa4_relacion_pago_cliente" placeholder="Ej: Reviso el correo de la transferencia y lo busco en la planilla o chat para marcarlo como pagado...">${d['etapa4_relacion_pago_cliente'] || ''}</textarea>
      </div>

      <!-- Comprobantes y tributación -->
      <div class="diag-q-group">
        <label class="diag-q-label">¿Emites boletas, facturas u otros comprobantes? ¿Cómo?</label>
        <div class="diag-options-grid grid-2">
          ${[
            ['Boleta o factura electrónica manual en portal del SII', 'sii_manual'],
            ['Software de facturación integrado (Bsale, Defontana, etc.)', 'software_facturacion'],
            ['Boleta de honorarios manual', 'honorarios'],
            ['Comprobante interno sin valor tributario', 'interno'],
            ['No emito comprobantes actualmente / En proceso', 'sin_definir']
          ].map(([label, val]) => `
            <label class="diag-option-card ${d['etapa4_emision_comprobantes'] === val ? 'is-selected' : ''}">
              <input type="radio" name="etapa4_emision_comprobantes" value="${val}" ${d['etapa4_emision_comprobantes'] === val ? 'checked' : ''}>
              <div class="diag-option-info"><span class="diag-option-title">${label}</span></div>
            </label>
          `).join('')}
        </div>
        <div class="diag-subfield">
          <label class="diag-subfield-label">Nombre del software o detalle (si aplica):</label>
          <input type="text" class="diag-input" name="etapa4_emision_detalle" value="${d['etapa4_emision_detalle'] || ''}">
        </div>
      </div>

      <!-- Pagos pendientes y cancelaciones -->
      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué haces con pagos pendientes, diferencias de monto, cancelaciones o devoluciones?</label>
        <textarea class="diag-textarea" name="etapa4_gestion_pendientes_devoluciones" placeholder="Ej: Escribo al cliente para recordar el saldo, o hago transferencia de vuelta si cancela a tiempo...">${d['etapa4_gestion_pendientes_devoluciones'] || ''}</textarea>
      </div>

      ${renderNavButtons(true, true)}
    `;

    attachOptionCardsRadioListeners(card, 'etapa4_momento_cobro');
    attachOptionCardsRadioListeners(card, 'etapa4_emision_comprobantes');
    attachOptionCardsCheckboxListeners(card);
    attachNavListeners();
  }

  // ---------- ETAPA 5: ENTREGA O PRESTACIÓN ----------
  function renderStage5(card) {
    const d = state.data;
    const isProd = state.offeringType === 'productos';
    const isServ = state.offeringType === 'servicios';
    const dynamicSubject = isProd ? 'el producto' : isServ ? 'el servicio' : 'el producto o servicio';

    card.innerHTML = `
      <div class="diag-stage-intro">
        <h2>Etapa 5. ${getStage5Title()}</h2>
        <p>Mapeemos qué ocurre desde que el pago se aprueba hasta que el cliente recibe lo acordado.</p>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué ocurre inmediatamente después de confirmar la compra o el pago?</label>
        <textarea class="diag-textarea" name="etapa5_que_ocurre_tras_pago" placeholder="Ej: Envío mensaje de agradecimiento, creo el proyecto en mi tablero o preparo el paquete para despacho...">${d['etapa5_que_ocurre_tras_pago'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">Describe los pasos hasta entregar ${dynamicSubject} o completar el trabajo</label>
        <textarea class="diag-textarea diag-textarea-lg" name="etapa5_pasos_entrega_prestacion" placeholder="1. Agendamos sesión / armamos pedido. 2. Producción / desarrollo. 3. Despacho o entrega final...">${d['etapa5_pasos_entrega_prestacion'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Quién participa en cada paso?</label>
        <p class="diag-q-hint">¿Trabajas solo, tienes equipo interno o proveedores externos (couriers, imprentas, redactores)?</p>
        <input type="text" class="diag-input" name="etapa5_quien_participa" placeholder="Ej: Yo me encargo del diseño y un courier externo entrega..." value="${d['etapa5_quien_participa'] || ''}">
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Necesitas coordinar fechas, reservas, envíos, proveedores o documentos?</label>
        <textarea class="diag-textarea" name="etapa5_coordinaciones_necesarias" placeholder="Ej: Sí, envío órdenes a talleres, coordino horarios por Google Meet, pido guías de despacho...">${d['etapa5_coordinaciones_necesarias'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Cómo informas al cliente del avance?</label>
        <textarea class="diag-textarea" name="etapa5_como_informas_avance" placeholder="Ej: Escribo por WhatsApp en cada hito, envío correos, o no suelo avisar hasta que está listo...">${d['etapa5_como_informas_avance'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Cómo registras que el trabajo o la entrega terminó?</label>
        <textarea class="diag-textarea" name="etapa5_como_registras_termino" placeholder="Ej: Cambio el estado en mi planilla a 'Completado', o pido confirmación de recepción en el chat...">${d['etapa5_como_registras_termino'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué situaciones excepcionales o imprevistos cambian este recorrido?</label>
        <textarea class="diag-textarea" name="etapa5_situaciones_excepcionales" placeholder="Ej: Retrasos del proveedor, solicitudes de cambio del cliente fuera de plazo, devoluciones...">${d['etapa5_situaciones_excepcionales'] || ''}</textarea>
      </div>

      ${renderNavButtons(true, true)}
    `;

    attachNavListeners();
  }

  // ---------- ETAPA 6: SEGUIMIENTO Y ORGANIZACIÓN ----------
  function renderStage6(card) {
    const d = state.data;

    card.innerHTML = `
      <div class="diag-stage-intro">
        <h2>Etapa 6. Seguimiento y organización</h2>
        <p>Veamos cómo mantienes el orden general, el seguimiento posterior y dónde se te va el tiempo.</p>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Cómo haces seguimiento a consultas y propuestas pendientes que no han respondido?</label>
        <textarea class="diag-textarea" name="etapa6_seguimiento_pendientes" placeholder="Ej: Reviso chats viejos cada viernes y pregunto si tienen dudas, o no suelo hacer seguimiento por falta de tiempo...">${d['etapa6_seguimiento_pendientes'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Realizas recordatorios, renovaciones, recompra o atención posterior a la entrega?</label>
        <textarea class="diag-textarea" name="etapa6_atencion_posterior_recompra" placeholder="Ej: Pido feedback o reseña a los 5 días, ofrezco mantención mensual, o no hago contacto posterior...">${d['etapa6_atencion_posterior_recompra'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label class="diag-q-label">¿Cómo sabes cuándo corresponde contactar nuevamente a un cliente?</label>
            <input type="text" class="diag-input" name="etapa6_cuando_contactar" placeholder="Alertas, memoria, calendario..." value="${d['etapa6_cuando_contactar'] || ''}">
          </div>
          <div>
            <label class="diag-q-label">¿Dónde ves hoy el estado de cada cliente o trabajo?</label>
            <input type="text" class="diag-input" name="etapa6_donde_ves_estado" placeholder="Planilla, WhatsApp, Trello, CRM..." value="${d['etapa6_donde_ves_estado'] || ''}">
          </div>
        </div>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué herramientas utilizas actualmente y para qué?</label>
        <textarea class="diag-textarea" name="etapa6_herramientas_actuales" placeholder="Ej: WhatsApp Web (atención), Gmail (propuestas), Sheets (inventario), Canva (gráficas), Notion (notas)...">${d['etapa6_herramientas_actuales'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Trabajas solo o con otras personas? ¿Cómo se reparten las tareas?</label>
        <textarea class="diag-textarea" name="etapa6_equipo_reparto_tareas" placeholder="Ej: Trabajo solo en todo el proceso / Somos 2 personas: yo cotizo y la otra persona produce...">${d['etapa6_equipo_reparto_tareas'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué información copias o escribes varias veces a lo largo del proceso?</label>
        <p class="diag-q-hint">Esto es oro puro para detectar automatizaciones inmediatas.</p>
        <textarea class="diag-textarea" name="etapa6_informacion_copiada_repetida" placeholder="Ej: Copio los datos de facturación de WhatsApp a la planilla, escribo los mismos datos bancarios 10 veces al día...">${d['etapa6_informacion_copiada_repetida'] || ''}</textarea>
      </div>

      <!-- Las 3 tareas que más tiempo ocupan -->
      <div class="diag-q-group" style="background: var(--color-offwhite); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--diag-border);">
        <label class="diag-q-label" style="margin-bottom: 0.25rem;">
          ¿Cuáles son las tres tareas que más tiempo te ocupan?
        </label>
        <p class="diag-q-hint" style="margin-bottom: 1rem;">Para cada una, indica qué es, con qué frecuencia la haces y cuánto tiempo te toma.</p>

        <!-- Tarea 1 -->
        <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px dashed var(--diag-border);">
          <strong style="font-size: 0.85rem; color: var(--color-charcoal); display: block; margin-bottom: 0.4rem;">Tarea 1:</strong>
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.5rem;">
            <input type="text" class="diag-input" name="etapa6_t1_nombre" placeholder="Nombre de la tarea (ej: Responder dudas iniciales)" value="${d['etapa6_t1_nombre'] || ''}">
            <input type="text" class="diag-input" name="etapa6_t1_frecuencia" placeholder="Frecuencia (ej: Diaria)" value="${d['etapa6_t1_frecuencia'] || ''}">
            <input type="text" class="diag-input" name="etapa6_t1_tiempo" placeholder="Tiempo (ej: 2 hrs/día)" value="${d['etapa6_t1_tiempo'] || ''}">
          </div>
        </div>

        <!-- Tarea 2 -->
        <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px dashed var(--diag-border);">
          <strong style="font-size: 0.85rem; color: var(--color-charcoal); display: block; margin-bottom: 0.4rem;">Tarea 2:</strong>
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.5rem;">
            <input type="text" class="diag-input" name="etapa6_t2_nombre" placeholder="Nombre de la tarea (ej: Armar presupuestos)" value="${d['etapa6_t2_nombre'] || ''}">
            <input type="text" class="diag-input" name="etapa6_t2_frecuencia" placeholder="Frecuencia (ej: 3 veces/sem)" value="${d['etapa6_t2_frecuencia'] || ''}">
            <input type="text" class="diag-input" name="etapa6_t2_tiempo" placeholder="Tiempo (ej: 1 hr cada una)" value="${d['etapa6_t2_tiempo'] || ''}">
          </div>
        </div>

        <!-- Tarea 3 -->
        <div>
          <strong style="font-size: 0.85rem; color: var(--color-charcoal); display: block; margin-bottom: 0.4rem;">Tarea 3:</strong>
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.5rem;">
            <input type="text" class="diag-input" name="etapa6_t3_nombre" placeholder="Nombre de la tarea (ej: Conciliar transferencias)" value="${d['etapa6_t3_nombre'] || ''}">
            <input type="text" class="diag-input" name="etapa6_t3_frecuencia" placeholder="Frecuencia (ej: Semanal)" value="${d['etapa6_t3_frecuencia'] || ''}">
            <input type="text" class="diag-input" name="etapa6_t3_tiempo" placeholder="Tiempo (ej: 3 hrs)" value="${d['etapa6_t3_tiempo'] || ''}">
          </div>
        </div>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Dónde suelen quedar pendientes o necesitar correcciones?</label>
        <textarea class="diag-textarea" name="etapa6_donde_quedan_pendientes" placeholder="Ej: Olvido cobrar saldos finales, o el cliente demora en enviar materiales y se frena el proyecto...">${d['etapa6_donde_quedan_pendientes'] || ''}</textarea>
      </div>

      ${renderNavButtons(true, true)}
    `;

    attachNavListeners();
  }

  // ---------- ETAPA 7: PRIORIDADES ----------
  function renderStage7(card) {
    const d = state.data;

    card.innerHTML = `
      <div class="diag-stage-intro">
        <h2>Etapa 7. Prioridades y visión de mejora</h2>
        <p>Prioricemos lo que te devolvería más tiempo, foco y tranquilidad.</p>
      </div>

      <!-- Componente interactivo de hasta 4 prioridades ordenadas -->
      <div class="diag-q-group">
        <label class="diag-q-label">
          ¿Qué tareas te gustaría simplificar o automatizar? (Ordena hasta cuatro prioridades)
        </label>
        <p class="diag-q-hint">
          Haz clic en las opciones para agregarlas a tus prioridades, y usa las flechas para ordenarlas de mayor a menor urgencia.
        </p>

        <!-- Pool de opciones -->
        <div class="diag-priority-pool" id="priorityPool">
          ${PRESET_PRIORITIES.map(p => {
            const isUsed = state.priorities.includes(p);
            return `
              <button type="button" class="diag-priority-chip ${isUsed ? 'is-used' : ''}" data-priority="${p}">
                + ${p}
              </button>
            `;
          }).join('')}
        </div>

        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem;">
          <input type="text" class="diag-input" id="customPriorityInput" placeholder="O escribe otra prioridad específica...">
          <button type="button" class="btn-diag btn-diag-secondary" id="btnAddCustomPriority" style="padding: 0 1.25rem; font-size: 0.85rem; white-space: nowrap;">
            Agregar
          </button>
        </div>

        <!-- 4 Slots de Prioridad -->
        <div class="diag-priority-slots" id="prioritySlots">
          ${[1, 2, 3, 4].map(slotNum => {
            const item = state.priorities[slotNum - 1];
            return `
              <div class="diag-priority-slot ${item ? 'has-item' : ''}">
                <div class="diag-slot-badge">${slotNum}</div>
                <div class="diag-slot-content">
                  ${item ? item : `<span class="diag-slot-empty">Espacio disponible para Prioridad ${slotNum}</span>`}
                </div>
                ${item ? `
                  <div class="diag-slot-controls">
                    <button type="button" class="btn-slot-move" data-action="up" data-idx="${slotNum - 1}" ${slotNum === 1 ? 'disabled' : ''} title="Subir">▲</button>
                    <button type="button" class="btn-slot-move" data-action="down" data-idx="${slotNum - 1}" ${slotNum === state.priorities.length ? 'disabled' : ''} title="Bajar">▼</button>
                    <button type="button" class="btn-slot-remove" data-action="remove" data-idx="${slotNum - 1}" title="Quitar">✕</button>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <!-- Disclaimer obligatorio -->
        <div class="diag-notice-disclaimer">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0; margin-top:2px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div>
            <strong>Nota de transparencia:</strong> Elegir cuatro prioridades te ayuda a enfocar lo más crítico, pero no constituye una contratación ni una promesa de cuatro automatizaciones.
          </div>
        </div>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué resultado concreto buscas con cada una de estas mejoras?</label>
        <textarea class="diag-textarea" name="etapa7_resultado_buscado" placeholder="Ej: Responder cotizaciones en menos de 1 hora, no volver a perder un comprobante de pago, tener tardes libres...">${d['etapa7_resultado_buscado'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué acciones quieres revisar personalmente antes de que el sistema las realice?</label>
        <p class="diag-q-hint">Control humano: qué decisiones nunca deben ejecutarse sin tu visto bueno.</p>
        <textarea class="diag-textarea" name="etapa7_acciones_revision_humana" placeholder="Ej: La aprobación final de una propuesta, aplicar un descuento especial, responder reclamos...">${d['etapa7_acciones_revision_humana'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué acciones podrían ejecutarse de forma 100% automática sin tu intervención?</label>
        <textarea class="diag-textarea" name="etapa7_acciones_100_automaticas" placeholder="Ej: Enviar acuse de recibo de consulta, registrar contacto en base de datos, enviar link de pago...">${d['etapa7_acciones_100_automaticas'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Hay herramientas que deba mantener o restricciones que deba conocer?</label>
        <p class="diag-q-hint">Por ejemplo si usas un software contable obligatorio o no quieres cambiar de número de WhatsApp.</p>
        <textarea class="diag-textarea" name="etapa7_restricciones_herramientas" placeholder="Ej: Debo seguir usando mi Google Drive actual y no quiero instalar aplicaciones pesadas en mi móvil...">${d['etapa7_restricciones_herramientas'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Qué costos mensuales de herramientas estarías dispuesto a considerar? (Opcional)</label>
        <div class="diag-options-grid grid-2">
          ${[
            ['Prefiero utilizar exclusivamente herramientas gratuitas', 'solo_gratis'],
            ['Hasta $25 USD / mes si ahorra tiempo real', 'hasta_25'],
            ['Entre $25 y $60 USD / mes', 'entre_25_60'],
            ['Más de $60 USD / mes si el beneficio operativo lo justifica', 'mas_60']
          ].map(([label, val]) => `
            <label class="diag-option-card ${d['etapa7_presupuesto_herramientas'] === val ? 'is-selected' : ''}">
              <input type="radio" name="etapa7_presupuesto_herramientas" value="${val}" ${d['etapa7_presupuesto_herramientas'] === val ? 'checked' : ''}>
              <div class="diag-option-info"><span class="diag-option-title">${label}</span></div>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">Describe una venta o atención reciente, desde el primer contacto hasta su cierre</label>
        <p class="diag-q-hint">Usa un caso real o ficticio representativo para ver el recorrido completo en acción.</p>
        <textarea class="diag-textarea diag-textarea-lg" name="etapa7_caso_reciente_ejemplo" placeholder="Ej: Me escribió Juan por Instagram pidiendo presupuesto para un matrimonio. Le pedí la fecha y lugar por chat. Tardé 2 días en cotizar...">${d['etapa7_caso_reciente_ejemplo'] || ''}</textarea>
      </div>

      <div class="diag-q-group">
        <label class="diag-q-label">¿Hay algo más que deba comprender sobre tu forma de trabajar?</label>
        <textarea class="diag-textarea" name="etapa7_algo_mas_que_comprender" placeholder="Cualquier particularidad, frustración recurrente o aspiración de tu negocio...">${d['etapa7_algo_mas_que_comprender'] || ''}</textarea>
      </div>

      ${renderNavButtons(true, true)}
    `;

    attachPriorityListeners(card);
    attachOptionCardsRadioListeners(card, 'etapa7_presupuesto_herramientas');
    attachNavListeners();
  }

  // Manejo interactivo de prioridades en Etapa 7
  function attachPriorityListeners(card) {
    const pool = card.querySelector('#priorityPool');
    const customInp = card.querySelector('#customPriorityInput');
    const btnAdd = card.querySelector('#btnAddCustomPriority');

    if (pool) {
      pool.querySelectorAll('.diag-priority-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const text = chip.getAttribute('data-priority');
          if (!text || state.priorities.includes(text)) return;
          if (state.priorities.length >= 4) {
            alert('Ya has seleccionado las 4 prioridades permitidas. Quita una para agregar otra.');
            return;
          }
          state.priorities.push(text);
          renderStage7(card);
        });
      });
    }

    if (btnAdd && customInp) {
      btnAdd.addEventListener('click', () => {
        const val = customInp.value.trim();
        if (!val) return;
        if (state.priorities.length >= 4) {
          alert('Ya has seleccionado las 4 prioridades permitidas.');
          return;
        }
        if (state.priorities.includes(val)) {
          alert('Esa prioridad ya está agregada.');
          return;
        }
        state.priorities.push(val);
        customInp.value = '';
        renderStage7(card);
      });
    }

    card.querySelectorAll('.btn-slot-move').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (action === 'up' && idx > 0) {
          const temp = state.priorities[idx];
          state.priorities[idx] = state.priorities[idx - 1];
          state.priorities[idx - 1] = temp;
        } else if (action === 'down' && idx < state.priorities.length - 1) {
          const temp = state.priorities[idx];
          state.priorities[idx] = state.priorities[idx + 1];
          state.priorities[idx + 1] = temp;
        }
        renderStage7(card);
      });
    });

    card.querySelectorAll('.btn-slot-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        state.priorities.splice(idx, 1);
        renderStage7(card);
      });
    });
  }

  // ---------- REVISIÓN Y ENVÍO ----------
  function renderStageResumen(card) {
    saveCurrentInputsToState();
    const d = state.data;
    const seq = getActiveStageSequence();

    // Helper para formatear valores legibles
    function val(key, def = 'Sin especificar') {
      const v = d[key];
      if (Array.isArray(v)) return v.length ? v.join(', ') : def;
      return v && v.trim() ? v : def;
    }

    card.innerHTML = `
      <div class="diag-stage-intro">
        <h2>Revisión de tu Diagnóstico</h2>
        <p>Revisa tus respuestas agrupadas por etapa. Si necesitas corregir algo, haz clic en “Editar etapa”.</p>
      </div>

      <!-- Resumen Etapa 1 -->
      <div class="diag-summary-section">
        <div class="diag-summary-header">
          <span class="diag-summary-title">Etapa 1. Datos y Modelo de Precios</span>
          <button type="button" class="diag-summary-edit-btn" data-edit="etapa1">Editar etapa ✎</button>
        </div>
        <div class="diag-summary-body grid-2">
          <div class="diag-summary-item">
            <span class="diag-summary-key">Contacto</span>
            <div class="diag-summary-val">${val('etapa1_nombre_persona')} · ${val('etapa1_nombre_negocio')}</div>
          </div>
          <div class="diag-summary-item">
            <span class="diag-summary-key">Correo y Enlace</span>
            <div class="diag-summary-val">${val('etapa1_correo')} · ${val('etapa1_web_social', 'Sin web/red')}</div>
          </div>
          <div class="diag-summary-item">
            <span class="diag-summary-key">Modelo de Precios</span>
            <div class="diag-summary-val">
              ${state.pricingModel === 'fixed' ? 'Lista de precios definida' :
                state.pricingModel === 'quote' ? 'Cotizaciones según cada cliente' :
                state.pricingModel === 'both' ? 'Precios fijos y cotizaciones a medida' : 'Definiendo cómo cobrar'}
            </div>
          </div>
          <div class="diag-summary-item">
            <span class="diag-summary-key">Qué vendes y descripción</span>
            <div class="diag-summary-val"><strong>${val('etapa1_que_vendes').toUpperCase()}:</strong> ${val('etapa1_descripcion_oferta')}</div>
          </div>
        </div>
      </div>

      <!-- Resumen Etapa 2 -->
      <div class="diag-summary-section">
        <div class="diag-summary-header">
          <span class="diag-summary-title">Etapa 2. Llegada de Clientes</span>
          <button type="button" class="diag-summary-edit-btn" data-edit="etapa2">Editar etapa ✎</button>
        </div>
        <div class="diag-summary-body grid-2">
          <div class="diag-summary-item">
            <span class="diag-summary-key">Canales de consulta</span>
            <div class="diag-summary-val">${val('etapa2_canales_consulta')} ${d['etapa2_canales_otro'] ? `(${d['etapa2_canales_otro']})` : ''}</div>
          </div>
          <div class="diag-summary-item">
            <span class="diag-summary-key">Registro de origen</span>
            <div class="diag-summary-val">${val('etapa2_registro_origen')} ${d['etapa2_registro_origen_detalle'] ? `(${d['etapa2_registro_origen_detalle']})` : ''}</div>
          </div>
          <div class="diag-summary-item">
            <span class="diag-summary-key">Volumen y conversión</span>
            <div class="diag-summary-val">${val('etapa2_volumen_semanal')} / Cierres: ${val('etapa2_tasa_conversion')}</div>
          </div>
          <div class="diag-summary-item">
            <span class="diag-summary-key">Reacción inicial</span>
            <div class="diag-summary-val">${val('etapa2_reaccion_consulta')}</div>
          </div>
        </div>
      </div>

      <!-- Resumen Etapa 3 (según rama) -->
      ${state.pricingModel !== 'defining' ? `
        <div class="diag-summary-section">
          <div class="diag-summary-header">
            <span class="diag-summary-title">Etapa 3. Proceso de Venta (${state.pricingModel === 'fixed' ? 'Precios fijos' : state.pricingModel === 'quote' ? 'Cotizaciones' : 'Combinado'})</span>
            <button type="button" class="diag-summary-edit-btn" data-edit="${state.pricingModel === 'fixed' ? 'etapa3A' : state.pricingModel === 'quote' ? 'etapa3B' : 'etapa3AB'}">Editar etapa ✎</button>
          </div>
          <div class="diag-summary-body">
            ${state.pricingModel === 'fixed' ? `
              <div class="diag-summary-item">
                <span class="diag-summary-key">Catálogo e importes</span>
                <div class="diag-summary-val">${val('etapa3A_donde_catalogo')} (${val('etapa3A_cantidad_ofertas')}) · Consulta: ${val('etapa3A_como_consulta_precios')}</div>
              </div>
              <div class="diag-summary-item">
                <span class="diag-summary-key">Puntos de revisión</span>
                <div class="diag-summary-val">${val('etapa3A_pasos_revision_humana')}</div>
              </div>
            ` : state.pricingModel === 'quote' ? `
              <div class="diag-summary-item">
                <span class="diag-summary-key">Preparación de cotización</span>
                <div class="diag-summary-val">${val('etapa3B_pasos_preparacion')}</div>
              </div>
              <div class="diag-summary-item">
                <span class="diag-summary-key">Herramientas y cálculo</span>
                <div class="diag-summary-val">${val('etapa3B_origen_precios')} · Herramienta: ${val('etapa3B_herramientas_calculo')} · Tardanza: ${val('etapa3B_tiempo_preparacion')}</div>
              </div>
            ` : `
              <div class="diag-summary-item">
                <span class="diag-summary-key">Distribución de modelos</span>
                <div class="diag-summary-val">${val('etapa3AB_distribucion_modelos')}</div>
              </div>
            `}
          </div>
        </div>
      ` : ''}

      <!-- Resumen Etapa 4 -->
      <div class="diag-summary-section">
        <div class="diag-summary-header">
          <span class="diag-summary-title">Etapa 4. Cobro y Facturación</span>
          <button type="button" class="diag-summary-edit-btn" data-edit="etapa4">Editar etapa ✎</button>
        </div>
        <div class="diag-summary-body grid-2">
          <div class="diag-summary-item">
            <span class="diag-summary-key">Momento y Medios</span>
            <div class="diag-summary-val">${val('etapa4_momento_cobro')} · Medios: ${val('etapa4_medios_pago')}</div>
          </div>
          <div class="diag-summary-item">
            <span class="diag-summary-key">Comprobantes</span>
            <div class="diag-summary-val">${val('etapa4_emision_comprobantes')} ${d['etapa4_emision_detalle'] ? `(${d['etapa4_emision_detalle']})` : ''}</div>
          </div>
        </div>
      </div>

      <!-- Resumen Etapa 5 -->
      <div class="diag-summary-section">
        <div class="diag-summary-header">
          <span class="diag-summary-title">Etapa 5. ${getStage5Title()}</span>
          <button type="button" class="diag-summary-edit-btn" data-edit="etapa5">Editar etapa ✎</button>
        </div>
        <div class="diag-summary-body">
          <div class="diag-summary-item">
            <span class="diag-summary-key">Recorrido de entrega</span>
            <div class="diag-summary-val">${val('etapa5_pasos_entrega_prestacion')}</div>
          </div>
        </div>
      </div>

      <!-- Resumen Etapa 6 -->
      <div class="diag-summary-section">
        <div class="diag-summary-header">
          <span class="diag-summary-title">Etapa 6. Seguimiento y Organización</span>
          <button type="button" class="diag-summary-edit-btn" data-edit="etapa6">Editar etapa ✎</button>
        </div>
        <div class="diag-summary-body grid-2">
          <div class="diag-summary-item">
            <span class="diag-summary-key">Herramientas actuales</span>
            <div class="diag-summary-val">${val('etapa6_herramientas_actuales')}</div>
          </div>
          <div class="diag-summary-item">
            <span class="diag-summary-key">Tareas más demandantes</span>
            <div class="diag-summary-val">
              1. ${val('etapa6_t1_nombre', 'N/A')}<br>
              2. ${val('etapa6_t2_nombre', 'N/A')}<br>
              3. ${val('etapa6_t3_nombre', 'N/A')}
            </div>
          </div>
        </div>
      </div>

      <!-- Resumen Etapa 7 -->
      <div class="diag-summary-section">
        <div class="diag-summary-header">
          <span class="diag-summary-title">Etapa 7. Prioridades Declaradas</span>
          <button type="button" class="diag-summary-edit-btn" data-edit="etapa7">Editar etapa ✎</button>
        </div>
        <div class="diag-summary-body">
          <div class="diag-summary-item">
            <span class="diag-summary-key">Prioridades en orden:</span>
            <div class="diag-summary-val">
              ${state.priorities.length ? state.priorities.map((p, i) => `<strong>${i + 1}.</strong> ${p}`).join('<br>') : '<em>No especificadas</em>'}
            </div>
          </div>
        </div>
      </div>

      <!-- Consentimiento y Envío -->
      <div class="diag-consent-box">
        <input type="checkbox" id="consentCheckbox" required>
        <div class="diag-consent-text">
          <label for="consentCheckbox" style="cursor: pointer; font-weight: 600;">
            Consiento que Fer utilice mis respuestas para elaborar el diagnóstico y la propuesta de trabajo, de acuerdo con la política de privacidad de DoBBleYou.
          </label>
          <div style="font-size: 0.8rem; color: var(--diag-text-muted); margin-top: 0.35rem;">
            Tus datos se manejan con estricta confidencialidad profesional y no serán compartidos con terceros.
          </div>
        </div>
      </div>

      <div id="submitErrorNotice" style="display: none; padding: 1rem; background: #FEE2E2; color: #991B1B; border-radius: var(--radius-md); margin-bottom: 1.5rem; font-size: 0.9rem;">
        Ocurrió un inconveniente al guardar. Tus respuestas están seguras en este navegador. Puedes volver a intentar ahora.
      </div>

      <div class="diag-nav-actions">
        <button type="button" class="btn-diag btn-diag-secondary" id="btnBackFromReview">
          ← Volver a corregir
        </button>
        <button type="button" class="btn-diag btn-diag-primary" id="btnSubmitDiagnosis" style="font-size: 1.05rem; padding: 0.9rem 2.25rem;">
          Enviar diagnóstico final ✓
        </button>
      </div>
    `;

    // Listeners para editar etapas específicas
    card.querySelectorAll('.diag-summary-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-edit');
        if (target) {
          state.isReviewing = true;
          goToStage(target);
        }
      });
    });

    document.getElementById('btnBackFromReview').addEventListener('click', () => {
      goToStage('etapa7');
    });

    document.getElementById('btnSubmitDiagnosis').addEventListener('click', handleDiagnosisSubmission);
  }

  // ---------- ENVÍO DEL DIAGNÓSTICO ----------
  async function handleDiagnosisSubmission() {
    const consent = document.getElementById('consentCheckbox');
    if (!consent || !consent.checked) {
      alert('Por favor marca la casilla de consentimiento para poder enviar el diagnóstico.');
      return;
    }

    const btnSubmit = document.getElementById('btnSubmitDiagnosis');
    const errBox = document.getElementById('submitErrorNotice');
    if (errBox) errBox.style.display = 'none';

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Guardando diagnóstico...';

    const submissionPayload = {
      id: 'diag_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      createdAt: new Date().toISOString(),
      status: 'Recibido',
      negocio: state.data['etapa1_nombre_negocio'] || 'Negocio sin nombre',
      contacto: state.data['etapa1_nombre_persona'] || 'Sin contacto',
      correo: state.data['etapa1_correo'] || '',
      modeloPrecio: state.pricingModel,
      queVendes: state.offeringType,
      prioridades: state.priorities,
      respuestas: state.data,
      notasInternasFer: '',
      propuestasAutomatizacion: []
    };

    let saveSuccess = false;

    // 1. Guardar siempre en LocalStorage (Registro persistente y seguro)
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]');
      existing.unshift(submissionPayload);
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(existing));
      saveSuccess = true;
    } catch (e) {
      console.warn('Error al guardar en almacenamiento local:', e);
    }

    // 2. Guardar en Firestore si está disponible
    if (firestoreDb && isFirebaseReady) {
      try {
        await firestoreDb.collection('diagnosticos').doc(submissionPayload.id).set(submissionPayload);
        saveSuccess = true;
        console.log('[DoBBleYou] Diagnóstico guardado exitosamente en Firestore.');
      } catch (fErr) {
        console.warn('[DoBBleYou] Error al conectar con Firestore. Guardado localmente con éxito.', fErr);
      }
    }

    if (saveSuccess) {
      // Limpiar borrador temporal para no dejarlo pendiente
      clearDraft();
      goToStage('exito');
    } else {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Reintentar envío';
      if (errBox) errBox.style.display = 'block';
    }
  }

  // ---------- PANTALLA FINAL DE ÉXITO ----------
  function renderStageExito(card) {
    card.innerHTML = `
      <div class="diag-success-card">
        <div class="diag-success-icon-wrap">
          <svg width="36" height="36" fill="none" stroke="#31333B" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>

        <h2 class="diag-success-title">¡Diagnóstico recibido con éxito!</h2>
        
        <p class="diag-success-desc">
          Recibí tu diagnóstico. Revisaré tus respuestas para comprender tu proceso y evaluar las oportunidades de mejora.
        </p>

        <div class="diag-next-steps-box">
          <h4 class="diag-next-steps-title">¿Qué ocurrirá a continuación?</h4>
          <ul class="diag-next-steps-list">
            <li>
              <span style="color: var(--color-cyan); font-weight: 800;">1.</span>
              Analizaré tu recorrido actual desde la consulta inicial hasta la entrega.
            </li>
            <li>
              <span style="color: var(--color-cyan); font-weight: 800;">2.</span>
              Construiré tu flujograma operativo e identificaré qué cuellos de botella se pueden destrabar.
            </li>
            <li>
              <span style="color: var(--color-cyan); font-weight: 800;">3.</span>
              Te contactaré por correo para coordinar una sesión o presentarte una propuesta concreta de estructura y automatizaciones.
            </li>
          </ul>
        </div>

        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <a href="/" class="btn-diag btn-diag-primary">
            Volver a DoBBleYou Inicio
          </a>
          <button type="button" class="btn-diag btn-diag-secondary" id="btnDescargarCopiaResumen">
            Descargar copia de mis respuestas (TXT)
          </button>
        </div>
      </div>
    `;

    const btnDescargar = document.getElementById('btnDescargarCopiaResumen');
    if (btnDescargar) {
      btnDescargar.addEventListener('click', downloadClientSummaryTxt);
    }
  }

  function downloadClientSummaryTxt() {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    if (!raw) return;
    const list = JSON.parse(raw);
    const last = list[0];
    if (!last) return;

    let content = `DoBBleYou — Diagnóstico de Procesos de Negocio\n`;
    content += `Fecha: ${new Date(last.createdAt).toLocaleString()}\n`;
    content += `Negocio: ${last.negocio}\n`;
    content += `Contacto: ${last.contacto} (${last.correo})\n`;
    content += `Modelo de Precios: ${last.modeloPrecio}\n`;
    content += `Tipo de Oferta: ${last.queVendes}\n\n`;
    content += `=== PRIORIDADES SELECCIONADAS ===\n`;
    (last.prioridades || []).forEach((p, i) => {
      content += `${i + 1}. ${p}\n`;
    });
    content += `\n=== RESPUESTAS COMPLETAS ===\n`;
    Object.entries(last.respuestas || {}).forEach(([k, v]) => {
      const valStr = Array.isArray(v) ? v.join(', ') : v;
      content += `[${k}]: ${valStr}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Diagnostico_DoBBleYou_${last.negocio.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ==================== HELPERS PARA BOTONES Y SELECCIÓN ====================
  function renderNavButtons(showPrev = true, showNext = true) {
    return `
      <div class="diag-nav-actions">
        <div class="diag-nav-left">
          ${showPrev ? `
            <button type="button" class="btn-diag btn-diag-secondary" id="btnPrevStage">
              ← Anterior
            </button>
          ` : '<div></div>'}
          <button type="button" class="btn-link-subtle" id="btnSaveDraftManual" style="margin-left: 0.5rem;">
            Guardar borrador
          </button>
        </div>
        ${showNext ? `
          <button type="button" class="btn-diag btn-diag-primary" id="btnNextStage">
            ${state.isReviewing ? 'Volver al resumen →' : 'Siguiente paso →'}
          </button>
        ` : ''}
      </div>
    `;
  }

  function attachNavListeners() {
    const btnNext = document.getElementById('btnNextStage');
    const btnPrev = document.getElementById('btnPrevStage');
    const btnManualSave = document.getElementById('btnSaveDraftManual');

    if (btnNext) btnNext.addEventListener('click', goNext);
    if (btnPrev) btnPrev.addEventListener('click', goPrev);
    if (btnManualSave) {
      btnManualSave.addEventListener('click', () => {
        saveCurrentInputsToState();
        saveDraft();
        indicateAutoSave('¡Borrador guardado manualmente!');
        setTimeout(() => indicateAutoSave('Guardado en este navegador'), 2500);
      });
    }
  }

  function updateOptionCardsSelection(card, inputName) {
    card.querySelectorAll(`input[name="${inputName}"]`).forEach(inp => {
      const parent = inp.closest('.diag-option-card');
      if (parent) {
        if (inp.checked) parent.classList.add('is-selected');
        else parent.classList.remove('is-selected');
      }
    });
  }

  function attachOptionCardsRadioListeners(card, name) {
    card.querySelectorAll(`input[name="${name}"]`).forEach(rad => {
      rad.addEventListener('change', () => {
        updateOptionCardsSelection(card, name);
      });
    });
  }

  function attachOptionCardsCheckboxListeners(card) {
    card.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const parent = cb.closest('.diag-option-card');
        if (parent) {
          if (cb.checked) parent.classList.add('is-selected');
          else parent.classList.remove('is-selected');
        }
      });
    });
  }

  // ==================== PANEL PRIVADO DE FER ====================
  // Expuesto de forma modular para ser invocado en /diagnostico#admin o /diagnostico/admin
  window.DoBBleYouAdmin = {
    isAuthenticated: false,

    init(containerId) {
      initFirebase();
      const container = document.getElementById(containerId);
      if (!container) return;

      const hasAuth = sessionStorage.getItem(STORAGE_KEYS.FER_AUTH) === 'true';
      if (hasAuth) {
        this.isAuthenticated = true;
        this.renderDashboard(container);
      } else {
        this.renderLogin(container);
      }
    },

    renderLogin(container) {
      container.innerHTML = `
        <div style="max-width: 420px; margin: 3rem auto; padding: 2.25rem; background: #FFFFFF; border-radius: var(--radius-lg); border: 1.5px solid var(--diag-border); box-shadow: var(--diag-shadow-lg); text-align: center;">
          <div style="width: 52px; height: 52px; background: var(--color-charcoal); border-radius: 50%; display: grid; place-content: center; margin: 0 auto 1.25rem;">
            <svg width="24" height="24" fill="none" stroke="#5CE1E6" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
          <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--color-charcoal); margin-bottom: 0.5rem;">Vista Privada para Fer</h2>
          <p style="font-size: 0.88rem; color: var(--diag-text-muted); margin-bottom: 1.5rem;">Ingresa tu clave de acceso para revisar diagnósticos, notas y fichas de automatización.</p>
          
          <form id="ferLoginForm" style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="password" id="ferPinInput" class="diag-input" placeholder="Clave de acceso de Fer" style="text-align: center; font-size: 1.1rem; letter-spacing: 0.1em;" required autofocus>
            <div id="ferLoginError" style="display: none; font-size: 0.82rem; color: var(--diag-danger); font-weight: 600;">Clave incorrecta. Inténtalo de nuevo.</div>
            <button type="submit" class="btn-diag btn-diag-dark" style="width: 100%;">Ingresar al panel privado</button>
          </form>
          <div style="margin-top: 1.25rem; font-size: 0.78rem; color: var(--diag-text-light);">Acceso restringido · DoBBleYou 2026</div>
        </div>
      `;

      document.getElementById('ferLoginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const pin = document.getElementById('ferPinInput').value.trim();
        if (pin === FER_DEFAULT_PIN || pin === 'fer' || pin === 'admin') {
          sessionStorage.setItem(STORAGE_KEYS.FER_AUTH, 'true');
          this.isAuthenticated = true;
          this.renderDashboard(container);
        } else {
          document.getElementById('ferLoginError').style.display = 'block';
        }
      });
    },

    async fetchSubmissions() {
      // Intenta leer de Firestore y combina con localStorage
      let list = [];
      try {
        const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]');
        list = [...local];
      } catch (e) {}

      if (firestoreDb && isFirebaseReady) {
        try {
          const snapshot = await firestoreDb.collection('diagnosticos').orderBy('createdAt', 'desc').get();
          snapshot.forEach(doc => {
            const data = doc.data();
            if (!list.some(item => item.id === data.id)) {
              list.push(data);
            }
          });
        } catch (err) {
          console.warn('[DoBBleYou] Lectura de Firestore no disponible, usando base local.', err);
        }
      }

      return list;
    },

    async renderDashboard(container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem;">Cargando diagnósticos...</div>
      `;

      const list = await this.fetchSubmissions();

      const counts = {
        total: list.length,
        recibido: list.filter(i => (i.status || 'Recibido') === 'Recibido').length,
        enRevision: list.filter(i => i.status === 'En revisión').length,
        pendienteInfo: list.filter(i => i.status === 'Pendiente de información').length,
        propuestaLista: list.filter(i => i.status === 'Propuesta definida').length
      };

      container.innerHTML = `
        <div class="diag-admin-view">
          <!-- Header -->
          <div class="diag-admin-header">
            <div class="diag-admin-title-wrap">
              <span class="diag-admin-badge">PRIVADO</span>
              <h2 style="font-size: 1.35rem; font-weight: 800; margin: 0;">Panel de Diagnósticos · Fer</h2>
            </div>
            <div style="display: flex; gap: 0.75rem; align-items: center;">
              <span style="font-size: 0.85rem; color: #CBD5E1;">dobbleyou.fer@gmail.com</span>
              <button type="button" class="btn-link-subtle" id="btnFerLogout" style="color: var(--color-cyan);">Cerrar sesión</button>
            </div>
          </div>

          <!-- Métricas -->
          <div class="diag-admin-metrics">
            <div class="diag-metric-box">
              <div class="diag-metric-val">${counts.total}</div>
              <div class="diag-metric-label">Total Recibidos</div>
            </div>
            <div class="diag-metric-box">
              <div class="diag-metric-val" style="color: #FBBF24;">${counts.recibido + counts.enRevision}</div>
              <div class="diag-metric-label">En Revisión</div>
            </div>
            <div class="diag-metric-box">
              <div class="diag-metric-val" style="color: #F87171;">${counts.pendienteInfo}</div>
              <div class="diag-metric-label">Pendiente Info</div>
            </div>
            <div class="diag-metric-box">
              <div class="diag-metric-val" style="color: #34D399;">${counts.propuestaLista}</div>
              <div class="diag-metric-label">Propuesta Definida</div>
            </div>
          </div>

          <!-- Barra de filtros -->
          <div class="diag-admin-toolbar">
            <div class="diag-admin-filters">
              <input type="text" id="adminSearchInp" class="diag-input" placeholder="Buscar negocio o contacto..." style="width: 240px; padding: 0.5rem 0.85rem; font-size: 0.88rem;">
              <select id="adminStatusFilter" class="diag-select" style="width: 190px; padding: 0.5rem 0.85rem; font-size: 0.88rem;">
                <option value="all">Todos los estados</option>
                <option value="Recibido">Recibido</option>
                <option value="En revisión">En revisión</option>
                <option value="Pendiente de información">Pendiente de información</option>
                <option value="Propuesta definida">Propuesta definida</option>
              </select>
            </div>
            <div>
              <button type="button" class="btn-diag btn-diag-secondary" id="btnAdminRefresh" style="padding: 0.45rem 1rem; font-size: 0.82rem;">
                ↻ Actualizar
              </button>
            </div>
          </div>

          <!-- Tabla de diagnósticos -->
          <div class="diag-admin-table-wrap">
            <table class="diag-admin-table" id="adminTable">
              <thead>
                <tr>
                  <th>Negocio / Proyecto</th>
                  <th>Contacto & Correo</th>
                  <th>Fecha</th>
                  <th>Modelo Precios</th>
                  <th>Estado</th>
                  <th style="text-align: right;">Acciones</th>
                </tr>
              </thead>
              <tbody id="adminTableBody">
                ${list.length === 0 ? `
                  <tr>
                    <td colspan="6" style="text-align: center; padding: 3rem; color: var(--diag-text-muted);">
                      Aún no hay diagnósticos registrados en este navegador o base de datos.
                    </td>
                  </tr>
                ` : list.map(item => this.renderTableRow(item)).join('')}
              </tbody>
            </table>
          </div>

          <!-- Contenedor del Detalle del Diagnóstico Seleccionado -->
          <div id="adminDetailContainer" style="display: none;"></div>
        </div>
      `;

      // Event Listeners
      document.getElementById('btnFerLogout').addEventListener('click', () => {
        sessionStorage.removeItem(STORAGE_KEYS.FER_AUTH);
        this.isAuthenticated = false;
        this.renderLogin(container);
      });

      document.getElementById('btnAdminRefresh').addEventListener('click', () => {
        this.renderDashboard(container);
      });

      const searchInp = document.getElementById('adminSearchInp');
      const statusFilter = document.getElementById('adminStatusFilter');

      const applyFilters = () => {
        const query = searchInp.value.toLowerCase();
        const stat = statusFilter.value;
        const filtered = list.filter(item => {
          const matchQuery = (item.negocio || '').toLowerCase().includes(query) || (item.contacto || '').toLowerCase().includes(query) || (item.correo || '').toLowerCase().includes(query);
          const matchStatus = (stat === 'all') || (item.status === stat);
          return matchQuery && matchStatus;
        });

        const tbody = document.getElementById('adminTableBody');
        tbody.innerHTML = filtered.length === 0 ? `
          <tr><td colspan="6" style="text-align: center; padding: 2rem;">No se encontraron diagnósticos que coincidan con los filtros.</td></tr>
        ` : filtered.map(item => this.renderTableRow(item)).join('');
        this.attachRowActionListeners(list, container);
      };

      searchInp.addEventListener('input', applyFilters);
      statusFilter.addEventListener('change', applyFilters);

      this.attachRowActionListeners(list, container);
    },

    renderTableRow(item) {
      const statusClass = (item.status || 'Recibido').toLowerCase().replace(/\s+/g, '-');
      const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

      return `
        <tr data-id="${item.id}">
          <td><strong>${item.negocio || 'Sin nombre'}</strong></td>
          <td>${item.contacto || 'Sin contacto'}<br><span style="font-size: 0.8rem; color: var(--diag-text-muted);">${item.correo || ''}</span></td>
          <td>${dateStr}</td>
          <td><span style="font-size: 0.82rem; text-transform: capitalize;">${item.modeloPrecio || 'Fijo'}</span></td>
          <td>
            <span class="diag-status-pill ${statusClass}">${item.status || 'Recibido'}</span>
          </td>
          <td style="text-align: right;">
            <button type="button" class="btn-diag btn-diag-secondary btn-view-diag" data-id="${item.id}" style="padding: 0.35rem 0.85rem; font-size: 0.8rem;">
              Ver detalle →
            </button>
          </td>
        </tr>
      `;
    },

    attachRowActionListeners(list, container) {
      document.querySelectorAll('.btn-view-diag').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const item = list.find(x => x.id === id);
          if (item) this.renderDetailView(item, container);
        });
      });
    },

    renderDetailView(item, container) {
      const detailContainer = document.getElementById('adminDetailContainer');
      if (!detailContainer) return;

      detailContainer.style.display = 'block';
      detailContainer.innerHTML = `
        <div class="diag-detail-card" id="detailCardInner">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--diag-text-muted);">Diagnóstico en detalle</div>
              <h3 style="font-size: 1.6rem; font-weight: 800; color: var(--color-charcoal); margin: 0.2rem 0;">${item.negocio}</h3>
              <p style="font-size: 0.95rem; color: var(--diag-text-muted); margin: 0;">Contacto: <strong>${item.contacto}</strong> · Correo: <a href="mailto:${item.correo}">${item.correo}</a> · Tipo: <strong>${item.queVendes}</strong></p>
            </div>
            
            <div style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">
              <select id="detailStatusSelect" class="diag-select" style="width: 210px; font-weight: 700;">
                <option value="Recibido" ${item.status === 'Recibido' ? 'selected' : ''}>Recibido</option>
                <option value="En revisión" ${item.status === 'En revisión' ? 'selected' : ''}>En revisión</option>
                <option value="Pendiente de información" ${item.status === 'Pendiente de información' ? 'selected' : ''}>Pendiente de información</option>
                <option value="Propuesta definida" ${item.status === 'Propuesta definida' ? 'selected' : ''}>Propuesta definida</option>
              </select>
              
              <button type="button" class="btn-diag btn-diag-secondary" id="btnExportMarkdown" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                📥 Exportar Markdown
              </button>
              <button type="button" class="btn-diag btn-diag-secondary" id="btnExportJson" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                JSON
              </button>
              <button type="button" class="btn-diag btn-diag-secondary" onclick="window.print()" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                🖨 Imprimir / PDF
              </button>
              <button type="button" class="btn-diag btn-diag-dark" id="btnCloseDetail" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                ✕ Cerrar
              </button>
            </div>
          </div>

          <!-- Prioridades declaradas -->
          <div style="background: var(--diag-cyan-subtle); border-left: 4px solid var(--color-cyan); padding: 1rem 1.25rem; border-radius: 0 var(--radius-md) var(--radius-md) 0; margin-bottom: 2rem;">
            <strong style="color: var(--color-charcoal); display: block; margin-bottom: 0.35rem; font-size: 0.95rem;">
              Prioridades declaradas por el cliente (hasta 4):
            </strong>
            <ol style="margin-left: 1.25rem; font-size: 0.9rem; color: var(--color-charcoal); line-height: 1.6;">
              ${(item.prioridades && item.prioridades.length) ? item.prioridades.map(p => `<li>${p}</li>`).join('') : '<em>Sin prioridades declaradas</em>'}
            </ol>
          </div>

          <!-- NOTAS INTERNAS DE FER -->
          <div class="diag-fer-notes-box">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <h4 style="font-size: 1rem; font-weight: 800; color: #92400E; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                Notas Internas de Fer (Solo visibles para ti)
              </h4>
              <button type="button" class="btn-diag btn-diag-primary" id="btnSaveFerNotes" style="padding: 0.3rem 0.85rem; font-size: 0.8rem;">
                Guardar notas
              </button>
            </div>
            <textarea class="diag-textarea" id="ferNotesInput" placeholder="Apunta tus observaciones del caso, impresiones operativas, flujograma preliminar y dudas a clarificar con el cliente...">${item.notasInternasFer || ''}</textarea>
          </div>

          <!-- FICHA INTERNA: AUTOMATIZACIONES PROPUESTAS -->
          <div class="diag-proposal-sheet">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <h4 class="diag-proposal-sheet-title" style="margin: 0;">Ficha Interna de Automatizaciones Propuestas</h4>
                <p style="font-size: 0.85rem; color: #166534; margin: 0.2rem 0 0;">Define aquí la arquitectura y especificación de cada automatización para Fer.</p>
              </div>
              <button type="button" class="btn-diag btn-diag-primary" id="btnAddAutomationCard" style="padding: 0.45rem 1rem; font-size: 0.82rem;">
                + Nueva Automatización Propuesta
              </button>
            </div>

            <div id="automationCardsContainer">
              ${this.renderAutomationCards(item.propuestasAutomatizacion || [])}
            </div>
          </div>

          <!-- RESPUESTAS COMPLETAS POR ETAPAS -->
          <div style="margin-top: 2.5rem;">
            <h4 style="font-size: 1.25rem; font-weight: 800; color: var(--color-charcoal); margin-bottom: 1.25rem;">
              Respuestas completas del diagnóstico
            </h4>
            
            ${this.renderAllResponsesGrouped(item.respuestas || {})}
          </div>
        </div>
      `;

      detailContainer.scrollIntoView({ behavior: 'smooth' });

      // Listeners de la vista en detalle
      document.getElementById('btnCloseDetail').addEventListener('click', () => {
        detailContainer.style.display = 'none';
      });

      const statusSelect = document.getElementById('detailStatusSelect');
      statusSelect.addEventListener('change', async (e) => {
        item.status = e.target.value;
        await this.persistItemUpdate(item);
        this.renderDashboard(container);
      });

      document.getElementById('btnSaveFerNotes').addEventListener('click', async () => {
        item.notasInternasFer = document.getElementById('ferNotesInput').value;
        await this.persistItemUpdate(item);
        alert('Notas internas guardadas exitosamente.');
      });

      document.getElementById('btnExportMarkdown').addEventListener('click', () => {
        this.exportToMarkdown(item);
      });

      document.getElementById('btnExportJson').addEventListener('click', () => {
        this.exportToJson(item);
      });

      document.getElementById('btnAddAutomationCard').addEventListener('click', () => {
        if (!item.propuestasAutomatizacion) item.propuestasAutomatizacion = [];
        item.propuestasAutomatizacion.push({
          id: 'auto_' + Date.now(),
          nombreObjetivo: '',
          eventoInicio: '',
          informacionEntrada: '',
          accionesRealizar: '',
          herramientasInvolucradas: '',
          aprobacionesHumanas: '',
          resultadoFinalizacion: '',
          manejoExcepciones: '',
          queIncluyeQueQuedaFuera: '',
          criterioComprobacion: ''
        });
        this.renderDetailView(item, container);
      });

      this.attachAutomationCardsListeners(item, container);
    },

    renderAutomationCards(cards) {
      if (!cards.length) {
        return `
          <div style="padding: 1.25rem; background: #FFFFFF; border-radius: var(--radius-sm); border: 1px dashed #86EFAC; text-align: center; font-size: 0.9rem; color: #166534;">
            Aún no has definido fichas de automatización para este diagnóstico. Haz clic en “+ Nueva Automatización Propuesta”.
          </div>
        `;
      }

      return cards.map((c, idx) => `
        <div class="diag-auto-card" data-idx="${idx}" style="background: #FFFFFF; border: 1.5px solid #86EFAC; border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
            <strong style="color: #166534; font-size: 0.95rem;">Automatización #${idx + 1}</strong>
            <button type="button" class="btn-slot-remove btn-remove-auto" data-idx="${idx}" title="Eliminar ficha">Eliminar ✕</button>
          </div>
          
          <div class="diag-proposal-grid grid-2">
            <div>
              <label class="diag-subfield-label">1. Nombre y objetivo</label>
              <input type="text" class="diag-input auto-field" data-field="nombreObjetivo" value="${c.nombreObjetivo || ''}" placeholder="Ej: Autorespuesta y cotizador rápido de eventos">
            </div>
            <div>
              <label class="diag-subfield-label">2. Evento que la inicia (Trigger)</label>
              <input type="text" class="diag-input auto-field" data-field="eventoInicio" value="${c.eventoInicio || ''}" placeholder="Ej: Nuevo mensaje por WhatsApp con palabra clave 'cotizar'">
            </div>
          </div>

          <div class="diag-proposal-grid grid-2" style="margin-top: 0.75rem;">
            <div>
              <label class="diag-subfield-label">3. Información de entrada y origen</label>
              <input type="text" class="diag-input auto-field" data-field="informacionEntrada" value="${c.informacionEntrada || ''}" placeholder="Ej: Fecha, número de personas, correo desde el chat">
            </div>
            <div>
              <label class="diag-subfield-label">4. Acciones que realizará</label>
              <input type="text" class="diag-input auto-field" data-field="accionesRealizar" value="${c.accionesRealizar || ''}" placeholder="Ej: Consulta planilla de disponibilidad, calcula total, genera PDF">
            </div>
          </div>

          <div class="diag-proposal-grid grid-2" style="margin-top: 0.75rem;">
            <div>
              <label class="diag-subfield-label">5. Herramientas involucradas</label>
              <input type="text" class="diag-input auto-field" data-field="herramientasInvolucradas" value="${c.herramientasInvolucradas || ''}" placeholder="Ej: WhatsApp API, Google Sheets, Make / n8n, Flow">
            </div>
            <div>
              <label class="diag-subfield-label">6. Aprobaciones humanas</label>
              <input type="text" class="diag-input auto-field" data-field="aprobacionesHumanas" value="${c.aprobacionesHumanas || ''}" placeholder="Ej: Fer o el cliente debe dar clic en 'Aprobar envío de PDF'">
            </div>
          </div>

          <div class="diag-proposal-grid grid-2" style="margin-top: 0.75rem;">
            <div>
              <label class="diag-subfield-label">7. Resultado y punto de finalización</label>
              <input type="text" class="diag-input auto-field" data-field="resultadoFinalizacion" value="${c.resultadoFinalizacion || ''}" placeholder="Ej: Cliente recibe propuesta en chat y queda registrado en CRM">
            </div>
            <div>
              <label class="diag-subfield-label">8. Manejo de excepciones</label>
              <input type="text" class="diag-input auto-field" data-field="manejoExcepciones" value="${c.manejoExcepciones || ''}" placeholder="Ej: Si no hay stock para la fecha, notifica por Slack/correo al dueño">
            </div>
          </div>

          <div class="diag-proposal-grid grid-2" style="margin-top: 0.75rem;">
            <div>
              <label class="diag-subfield-label">9. Qué incluye y qué queda fuera</label>
              <input type="text" class="diag-input auto-field" data-field="queIncluyeQueQuedaFuera" value="${c.queIncluyeQueQuedaFuera || ''}" placeholder="Ej: Incluye cotización estándar. Queda fuera negociación de descuentos">
            </div>
            <div>
              <label class="diag-subfield-label">10. Criterio para comprobar que funciona</label>
              <input type="text" class="diag-input auto-field" data-field="criterioComprobacion" value="${c.criterioComprobacion || ''}" placeholder="Ej: Test end-to-end con cotización de prueba recibida en menos de 2 min">
            </div>
          </div>
        </div>
      `).join('');
    },

    attachAutomationCardsListeners(item, container) {
      document.querySelectorAll('.btn-remove-auto').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          item.propuestasAutomatizacion.splice(idx, 1);
          await this.persistItemUpdate(item);
          this.renderDetailView(item, container);
        });
      });

      document.querySelectorAll('.auto-field').forEach(inp => {
        inp.addEventListener('change', async (e) => {
          const cardElem = e.target.closest('.diag-auto-card');
          const idx = parseInt(cardElem.getAttribute('data-idx'), 10);
          const field = e.target.getAttribute('data-field');
          if (item.propuestasAutomatizacion[idx]) {
            item.propuestasAutomatizacion[idx][field] = e.target.value;
            await this.persistItemUpdate(item);
          }
        });
      });
    },

    renderAllResponsesGrouped(responses) {
      if (!responses || !Object.keys(responses).length) {
        return '<p>No hay respuestas registradas.</p>';
      }

      return `
        <div style="background: var(--color-offwhite); border: 1px solid var(--diag-border); border-radius: var(--radius-md); padding: 1.5rem;">
          ${Object.entries(responses).map(([k, v]) => {
            const valStr = Array.isArray(v) ? v.join(', ') : (v || '<em>Vacío</em>');
            return `
              <div style="margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--diag-border);">
                <div style="font-size: 0.78rem; font-weight: 700; color: var(--diag-text-muted); text-transform: uppercase;">${k}</div>
                <div style="font-size: 0.95rem; color: var(--color-charcoal); margin-top: 0.2rem; white-space: pre-wrap;">${valStr}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    },

    async persistItemUpdate(item) {
      // 1. LocalStorage
      try {
        const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]');
        const idx = local.findIndex(x => x.id === item.id);
        if (idx >= 0) {
          local[idx] = item;
        } else {
          local.unshift(item);
        }
        localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(local));
      } catch (e) {}

      // 2. Firestore
      if (firestoreDb && isFirebaseReady) {
        try {
          await firestoreDb.collection('diagnosticos').doc(item.id).set(item, { merge: true });
        } catch (fErr) {
          console.warn('Error al actualizar Firestore:', fErr);
        }
      }
    },

    exportToMarkdown(item) {
      let md = `# Diagnóstico Operativo DoBBleYou · ${item.negocio}\n\n`;
      md += `- **Contacto:** ${item.contacto}\n`;
      md += `- **Correo:** ${item.correo}\n`;
      md += `- **Fecha:** ${new Date(item.createdAt).toLocaleString()}\n`;
      md += `- **Estado:** ${item.status}\n`;
      md += `- **Modelo de precios:** ${item.modeloPrecio}\n`;
      md += `- **Tipo de venta:** ${item.queVendes}\n\n`;

      md += `## Prioridades del Cliente\n\n`;
      (item.prioridades || []).forEach((p, i) => {
        md += `${i + 1}. ${p}\n`;
      });

      md += `\n## Notas Internas de Fer\n\n${item.notasInternasFer || '_Sin notas registradas_'}\n\n`;

      if (item.propuestasAutomatizacion && item.propuestasAutomatizacion.length) {
        md += `## Fichas de Automatizaciones Propuestas\n\n`;
        item.propuestasAutomatizacion.forEach((c, idx) => {
          md += `### Automatización ${idx + 1}: ${c.nombreObjetivo || 'Sin título'}\n\n`;
          md += `- **Evento de inicio (Trigger):** ${c.eventoInicio}\n`;
          md += `- **Información de entrada:** ${c.informacionEntrada}\n`;
          md += `- **Acciones:** ${c.accionesRealizar}\n`;
          md += `- **Herramientas:** ${c.herramientasInvolucradas}\n`;
          md += `- **Aprobaciones humanas:** ${c.aprobacionesHumanas}\n`;
          md += `- **Resultado:** ${c.resultadoFinalizacion}\n`;
          md += `- **Excepciones:** ${c.manejoExcepciones}\n`;
          md += `- **Alcance (Incluye / Fuera):** ${c.queIncluyeQueQuedaFuera}\n`;
          md += `- **Criterio de éxito:** ${c.criterioComprobacion}\n\n`;
        });
      }

      md += `## Respuestas Completas del Formulario\n\n`;
      Object.entries(item.respuestas || {}).forEach(([k, v]) => {
        const valStr = Array.isArray(v) ? v.join(', ') : v;
        md += `#### ${k}\n${valStr}\n\n`;
      });

      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Diagnostico_${item.negocio.replace(/\s+/g, '_')}.md`;
      a.click();
      URL.revokeObjectURL(url);
    },

    exportToJson(item) {
      const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Diagnostico_${item.negocio.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ==================== INICIALIZACIÓN EN PÁGINA ====================
  document.addEventListener('DOMContentLoaded', () => {
    initFirebase();

    // Mobile nav toggle
    const siteHeader = document.querySelector('.site-header');
    const mobileToggle = document.getElementById('mobileToggle');
    if (mobileToggle && siteHeader) {
      mobileToggle.addEventListener('click', () => {
        siteHeader.classList.toggle('mobile-menu-active');
        const expanded = mobileToggle.getAttribute('aria-expanded') === 'true';
        mobileToggle.setAttribute('aria-expanded', !expanded);
      });
    }

    // Comprobar si la URL tiene hash #admin o si es página de admin
    const isAdminView = window.location.hash === '#admin' || window.location.pathname.includes('/admin');

    if (isAdminView) {
      const appContainer = document.getElementById('diagAppRoot');
      if (appContainer) {
        window.DoBBleYouAdmin.init('diagAppRoot');
      }
    } else {
      loadDraft();
      renderCurrentStage();
    }

    // Listener para cambio de hash dinámico
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#admin') {
        window.DoBBleYouAdmin.init('diagAppRoot');
      } else {
        const appContainer = document.getElementById('diagAppRoot');
        if (appContainer) {
          appContainer.innerHTML = `
            <!-- Auto-save notification -->
            <div class="diag-autosave-bar">
              <div class="diag-autosave-left">
                <span class="diag-autosave-dot" id="diagAutosaveDot"></span>
                <span id="diagAutosaveText">Guardado en este navegador</span>
              </div>
              <div class="diag-autosave-actions">
                <span style="font-size: 0.78rem; color: var(--diag-text-light);">Tus respuestas se conservan automáticamente</span>
              </div>
            </div>

            <!-- Stage Progress Card -->
            <div class="diag-progress-card" id="diagProgressCard">
              <div class="diag-progress-header">
                <div class="diag-stage-title-wrap">
                  <span class="diag-stage-number" id="diagStageNum">Paso 1</span>
                  <span class="diag-stage-current-name" id="diagStageName">Cargando...</span>
                </div>
                <div class="diag-progress-pct" id="diagProgressPct">0%</div>
              </div>
              <div class="diag-progress-track">
                <div class="diag-progress-fill" id="diagProgressFill" style="width: 0%;"></div>
              </div>
              <div class="diag-steps-indicator" id="diagPillsWrap"></div>
            </div>

            <!-- Dynamic Question Stage Card -->
            <div class="diag-card" id="diagStageCard"></div>
          `;
          renderCurrentStage();
        }
      }
    });
  });

})();
