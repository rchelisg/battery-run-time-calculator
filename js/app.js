// ─────────────────────────────────────────────
// Battery Run Time Calculator — app.js
// ─────────────────────────────────────────────

// ── Title bar status (online / offline / error) ──────────
// Reflects SW registration state and network connectivity

function setTitleStatus(status) {
  const h1 = document.querySelector('.app-header h1');
  if (!h1) return;
  h1.classList.remove('status-online', 'status-error');
  if (status === 'online') h1.classList.add('status-online');
  if (status === 'error')  h1.classList.add('status-error');
  // 'offline' = default white — no class needed
}

function updateTitleStatus() {
  setTitleStatus(navigator.onLine ? 'online' : 'offline');
}

// ── Service Worker Registration ──────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('[App] Service worker registered. Scope:', registration.scope);
        updateTitleStatus();           // green if online, white if offline
      })
      .catch(error => {
        console.error('[App] Service worker registration failed:', error);
        setTitleStatus('error');       // red — offline mode unavailable
      });
  });
} else {
  setTitleStatus('error');             // no SW support — offline mode unavailable
}

window.addEventListener('online',  updateTitleStatus);
window.addEventListener('offline', updateTitleStatus);

// ─────────────────────────────────────────────
// PACK Card — inputs and validation
// ─────────────────────────────────────────────

// Input elements
const inputN    = document.getElementById('input-N');
const inputC    = document.getElementById('input-C');
const inputCmin = document.getElementById('input-Cmin');
const inputCmax = document.getElementById('input-Cmax');

// Single shared error display element
const packErrorEl = document.getElementById('pack-error');

// Per-field error registry — priority order: N > C > Cmin > Cmax
const packErrors = { N: '', C: '', Cmin: '', Cmax: '' };

// ── Refresh the shared error strip ──
// Always shows the highest-priority active error (or clears if none)
function showPackError() {
  packErrorEl.textContent =
    packErrors.N || packErrors.C || packErrors.Cmin || packErrors.Cmax || '';
}

// ── Apply or clear one field's error state ──
// Updates the red-border class and the error registry, then refreshes the strip
function setFieldState(inputEl, fieldKey, message, isError = false) {
  if (isError) {
    inputEl.classList.add('input-error');
    packErrors[fieldKey] = message;
  } else {
    inputEl.classList.remove('input-error');
    packErrors[fieldKey] = '';
  }
  showPackError();
}

// ── Validate N (Cells): whole number, 1 – 8 ──
function validateN() {
  const raw = inputN.value.trim();
  if (raw === '') { setFieldState(inputN, 'N', ''); return true; }

  const val = Number(raw);
  if (!Number.isInteger(val)) {
    setFieldState(inputN, 'N', 'Cells must be a whole number', true);
    return false;
  }
  if (val < 1 || val > 8) {
    setFieldState(inputN, 'N', 'Cells must be 1 – 8', true);
    return false;
  }
  setFieldState(inputN, 'N', '');
  return true;
}

// ── Validate C (Nominal): whole number, 100 – 8000 mAh ──
function validateC() {
  const raw = inputC.value.trim();
  if (raw === '') {
    setFieldState(inputC, 'C', '');
    validateCmin(); validateCmax();   // re-check bounds that depend on C
    return true;
  }

  const val = Number(raw);
  if (isNaN(val) || !Number.isInteger(val)) {
    setFieldState(inputC, 'C', 'Nominal must be a whole number', true);
    validateCmin(); validateCmax();
    return false;
  }
  if (val < 100 || val > 8000) {
    setFieldState(inputC, 'C', 'Nominal must be 100 – 8000 mAh', true);
    validateCmin(); validateCmax();
    return false;
  }
  setFieldState(inputC, 'C', '');
  validateCmin(); validateCmax();
  return true;
}

// ── Validate Cmin (optional) ──
// Rules (when C is valid): Cmin >= C*0.5  AND  Cmin <= C
function validateCmin() {
  const raw = inputCmin.value.trim();
  if (raw === '') { setFieldState(inputCmin, 'Cmin', ''); return true; }

  const val = Number(raw);
  if (isNaN(val) || !Number.isInteger(val)) {
    setFieldState(inputCmin, 'Cmin', 'Min must be a whole number', true);
    return false;
  }

  // Cross-field checks — only when C is present and valid
  const cRaw = inputC.value.trim();
  if (cRaw !== '') {
    const cVal = Number(cRaw);
    if (Number.isInteger(cVal) && cVal >= 100 && cVal <= 8000) {
      const cminFloor = Math.ceil(cVal * 0.5);   // smallest valid whole-number Cmin
      if (val < cminFloor) {
        setFieldState(inputCmin, 'Cmin', `Min must be ≥ ${cminFloor} mAh`, true);
        return false;
      }
      if (val > cVal) {
        setFieldState(inputCmin, 'Cmin', `Min must be ≤ ${cVal} mAh (≤ Nominal)`, true);
        return false;
      }
    }
  }
  setFieldState(inputCmin, 'Cmin', '');
  return true;
}

// ── Validate Cmax (optional) ──
// Rules (when C is valid): Cmax <= C*1.15  AND  Cmax >= C
function validateCmax() {
  const raw = inputCmax.value.trim();
  if (raw === '') { setFieldState(inputCmax, 'Cmax', ''); return true; }

  const val = Number(raw);
  if (isNaN(val) || !Number.isInteger(val)) {
    setFieldState(inputCmax, 'Cmax', 'Max must be a whole number', true);
    return false;
  }

  // Cross-field checks — only when C is present and valid
  const cRaw = inputC.value.trim();
  if (cRaw !== '') {
    const cVal = Number(cRaw);
    if (Number.isInteger(cVal) && cVal >= 100 && cVal <= 8000) {
      const cmaxCeil = Math.floor(cVal * 1.15);  // largest valid whole-number Cmax
      if (val > cmaxCeil) {
        setFieldState(inputCmax, 'Cmax', `Max must be ≤ ${cmaxCeil} mAh`, true);
        return false;
      }
      if (val < cVal) {
        setFieldState(inputCmax, 'Cmax', `Max must be ≥ ${cVal} mAh (≥ Nominal)`, true);
        return false;
      }
    }
  }
  setFieldState(inputCmax, 'Cmax', '');
  return true;
}

// ── Attach event listeners ──

// N: block any key that isn't 1–8, Backspace, Delete, or navigation
inputN.addEventListener('keydown', function(e) {
  const nav = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'];
  if (nav.includes(e.key)) return;   // always allow navigation/deletion
  if (!/^[1-8]$/.test(e.key)) e.preventDefault();  // block everything else
});

// Validate on every keystroke (input) and when focus leaves (blur)
inputN.addEventListener('input', validateN);
inputN.addEventListener('blur',  validateN);

inputC.addEventListener('input', validateC);
inputC.addEventListener('blur',  validateC);

inputCmin.addEventListener('input', validateCmin);
inputCmin.addEventListener('blur',  validateCmin);

inputCmax.addEventListener('input', validateCmax);
inputCmax.addEventListener('blur',  validateCmax);

// ─────────────────────────────────────────────
// LOAD Cards — dynamic management and validation
// ─────────────────────────────────────────────

const LOAD_MAX = 5;
let loadCount = 0;

// Per-card error registry: loadErrors[i] = { L: '', Lmin: '', Lmax: '' }
const loadErrors = [];

const loadContainer = document.getElementById('load-cards-container');

// ── Precision helper ──
// val ≤ 20: at most 1 decimal place  |  val > 20: whole numbers only
function isValidLoadPrecision(rawStr, val) {
  const s = rawStr.trim();
  return val <= 20
    ? /^\d+(\.\d)?$/.test(s)   // 0 or 1 decimal digit
    : /^\d+$/.test(s);          // whole number only
}

// ── Show highest-priority error for card i ──
function showLoadError(i) {
  const el = document.getElementById(`load-error-${i}`);
  if (el && loadErrors[i]) {
    el.textContent =
      loadErrors[i].L || loadErrors[i].Lmin || loadErrors[i].Lmax || '';
  }
}

// ── Apply or clear one field's error state for card i ──
function setLoadFieldState(i, inputEl, fieldKey, message, isError = false) {
  if (isError) {
    inputEl.classList.add('input-error');
    loadErrors[i][fieldKey] = message;
  } else {
    inputEl.classList.remove('input-error');
    loadErrors[i][fieldKey] = '';
  }
  showLoadError(i);
}

// ── Update one output cell (combined value + unit) ──
function setOutCell(i, field, rawVal) {
  const el = document.getElementById(`lo${i}-${field}`);
  if (!el) return;

  const isNom  = (field === 'L');
  const cls    = isNom ? 'load-out-nom' : 'load-out-rng';
  const hasVal = rawVal !== '';
  el.textContent = hasVal ? rawVal : '—';
  el.className   = `${cls} ${hasVal ? 'has-value' : 'no-value'}`;
}

// ── Update all 5 output rows ──
function updateLoadOutput() {
  for (let i = 0; i < LOAD_MAX; i++) {
    const lEl    = document.getElementById(`input-L${i}`);
    const lminEl = document.getElementById(`input-Lmin${i}`);
    const lmaxEl = document.getElementById(`input-Lmax${i}`);

    setOutCell(i, 'L',    lEl    ? lEl.value.trim() : '');
    setOutCell(i, 'Lmin', lminEl ? lminEl.value.trim() : '');
    setOutCell(i, 'Lmax', lmaxEl ? lmaxEl.value.trim() : '');
  }
}

// ── Update +/- button visibility on the last card ──
function updateLoadControls() {
  for (let i = 0; i < loadCount; i++) {
    const ctrlDiv = document.getElementById(`load-controls-${i}`);
    const minBtn  = document.getElementById(`load-minus-${i}`);
    const plusBtn = document.getElementById(`load-plus-${i}`);
    if (!ctrlDiv) continue;

    const isLast = (i === loadCount - 1);

    // All cards reserve the controls height; only last card's buttons are visible
    ctrlDiv.style.display    = 'flex';
    ctrlDiv.style.visibility = isLast ? 'visible' : 'hidden';

    if (isLast) {
      if (loadCount === 1) {
        // Single card: + only
        minBtn.style.visibility = 'hidden';
        minBtn.disabled         = true;
        plusBtn.style.visibility = 'visible';
        plusBtn.disabled         = false;
      } else if (loadCount < LOAD_MAX) {
        // Middle range: both + and -
        minBtn.style.visibility  = 'visible';
        minBtn.disabled          = false;
        plusBtn.style.visibility = 'visible';
        plusBtn.disabled         = false;
      } else {
        // Max cards reached: - only
        minBtn.style.visibility  = 'visible';
        minBtn.disabled          = false;
        plusBtn.style.visibility = 'hidden';
        plusBtn.disabled         = true;
      }
    } else {
      // Non-last card: disable both (they are also invisible)
      if (minBtn)  minBtn.disabled  = true;
      if (plusBtn) plusBtn.disabled = true;
    }
  }
}

// ── Validate L(i) — Nominal load ──
function validateL(i) {
  const inputEl = document.getElementById(`input-L${i}`);
  if (!inputEl) return true;
  const raw = inputEl.value.trim();

  if (raw === '') {
    setLoadFieldState(i, inputEl, 'L', '');
    validateLmin(i, true);
    validateLmax(i, true);
    updateLoadOutput();
    return true;
  }

  const val = Number(raw);
  if (isNaN(val)) {
    setLoadFieldState(i, inputEl, 'L', 'Nominal must be a number', true);
    updateLoadOutput();
    return false;
  }
  if (val <= 0) {
    setLoadFieldState(i, inputEl, 'L', 'Nominal must be > 0 W', true);
    validateLmin(i, true); validateLmax(i, true);
    updateLoadOutput();
    return false;
  }
  if (val > 750) {
    setLoadFieldState(i, inputEl, 'L', 'Nominal must be ≤ 750 W', true);
    validateLmin(i, true); validateLmax(i, true);
    updateLoadOutput();
    return false;
  }
  if (!isValidLoadPrecision(raw, val)) {
    setLoadFieldState(i, inputEl, 'L',
      val > 20 ? 'Values > 20 W must be whole numbers'
               : 'Values ≤ 20 W: max 1 decimal place', true);
    validateLmin(i, true); validateLmax(i, true);
    updateLoadOutput();
    return false;
  }

  setLoadFieldState(i, inputEl, 'L', '');
  validateLmin(i);
  validateLmax(i);
  updateLoadOutput();
  return true;
}

// ── Validate Lmin(i) — minimum load ──
// recheck=true: called from validateLmax; skip the return cross-call to avoid recursion
function validateLmin(i, recheck = false) {
  const inputEl = document.getElementById(`input-Lmin${i}`);
  if (!inputEl) return true;
  const raw = inputEl.value.trim();

  // Helper: returns numeric value of a field if present and passes basic checks, else null
  const basicVal = (field) => {
    const el  = document.getElementById(`input-${field}${i}`);
    const r   = el ? el.value.trim() : '';
    if (r === '') return null;
    const v = Number(r);
    if (isNaN(v)) return null;
    if (field === 'L'    && (v <= 0 || v > 750)) return null;
    if (field === 'Lmax' && v > 750)             return null;
    if (!isValidLoadPrecision(r, v))             return null;
    return v;
  };

  const done = (ok) => {
    updateLoadOutput();
    if (!recheck) validateLmax(i, true);   // re-check Lmax whenever Lmin changes
    return ok;
  };

  if (raw === '') { setLoadFieldState(i, inputEl, 'Lmin', '');  return done(true); }

  const val = Number(raw);
  if (isNaN(val)) {
    setLoadFieldState(i, inputEl, 'Lmin', 'Min must be a number', true);
    return done(false);
  }
  if (val < 0.1) {
    setLoadFieldState(i, inputEl, 'Lmin', 'Min must be ≥ 0.1 W', true);
    return done(false);
  }
  if (!isValidLoadPrecision(raw, val)) {
    setLoadFieldState(i, inputEl, 'Lmin',
      val > 20 ? 'Min > 20 W must be a whole number'
               : 'Min ≤ 20 W: max 1 decimal place', true);
    return done(false);
  }

  // Cross-field: rule is  Lmax ≥ L ≥ Lmin
  const lVal    = basicVal('L');
  const lmaxVal = basicVal('Lmax');

  if (lVal !== null) {
    // L is present and valid — check Lmin ≤ L
    if (val > lVal) {
      setLoadFieldState(i, inputEl, 'Lmin', `Min must be ≤ ${lVal} W (≤ Nominal)`, true);
      return done(false);
    }
  } else if (lmaxVal !== null) {
    // L absent/invalid but Lmax is valid — check Lmin ≤ Lmax directly
    if (val > lmaxVal) {
      setLoadFieldState(i, inputEl, 'Lmin', `Min must be ≤ ${lmaxVal} W (≤ Max)`, true);
      return done(false);
    }
  }

  setLoadFieldState(i, inputEl, 'Lmin', '');
  return done(true);
}

// ── Validate Lmax(i) — maximum load ──
// recheck=true: called from validateLmin; skip the return cross-call to avoid recursion
function validateLmax(i, recheck = false) {
  const inputEl = document.getElementById(`input-Lmax${i}`);
  if (!inputEl) return true;
  const raw = inputEl.value.trim();

  // Helper: returns numeric value of a field if present and passes basic checks, else null
  const basicVal = (field) => {
    const el  = document.getElementById(`input-${field}${i}`);
    const r   = el ? el.value.trim() : '';
    if (r === '') return null;
    const v = Number(r);
    if (isNaN(v)) return null;
    if (field === 'L'    && (v <= 0 || v > 750)) return null;
    if (field === 'Lmin' && v < 0.1)             return null;
    if (!isValidLoadPrecision(r, v))             return null;
    return v;
  };

  const done = (ok) => {
    updateLoadOutput();
    if (!recheck) validateLmin(i, true);   // re-check Lmin whenever Lmax changes
    return ok;
  };

  if (raw === '') { setLoadFieldState(i, inputEl, 'Lmax', '');  return done(true); }

  const val = Number(raw);
  if (isNaN(val)) {
    setLoadFieldState(i, inputEl, 'Lmax', 'Max must be a number', true);
    return done(false);
  }
  if (val > 750) {
    setLoadFieldState(i, inputEl, 'Lmax', 'Max must be ≤ 750 W', true);
    return done(false);
  }
  if (!isValidLoadPrecision(raw, val)) {
    setLoadFieldState(i, inputEl, 'Lmax',
      val > 20 ? 'Max > 20 W must be a whole number'
               : 'Max ≤ 20 W: max 1 decimal place', true);
    return done(false);
  }

  // Cross-field: rule is  Lmax ≥ L ≥ Lmin
  const lVal    = basicVal('L');
  const lminVal = basicVal('Lmin');

  if (lVal !== null) {
    // L is present and valid — check Lmax ≥ L
    if (val < lVal) {
      setLoadFieldState(i, inputEl, 'Lmax', `Max must be ≥ ${lVal} W (≥ Nominal)`, true);
      return done(false);
    }
  } else if (lminVal !== null) {
    // L absent/invalid but Lmin is valid — check Lmax ≥ Lmin directly
    if (val < lminVal) {
      setLoadFieldState(i, inputEl, 'Lmax', `Max must be ≥ ${lminVal} W (≥ Min)`, true);
      return done(false);
    }
  }

  setLoadFieldState(i, inputEl, 'Lmax', '');
  return done(true);
}

// ── Attach event listeners for card i ──
function attachLoadListeners(i) {
  const lEl    = document.getElementById(`input-L${i}`);
  const lminEl = document.getElementById(`input-Lmin${i}`);
  const lmaxEl = document.getElementById(`input-Lmax${i}`);
  const minBtn  = document.getElementById(`load-minus-${i}`);
  const plusBtn = document.getElementById(`load-plus-${i}`);

  lEl.addEventListener('input', () => validateL(i));
  lEl.addEventListener('blur',  () => validateL(i));

  lminEl.addEventListener('input', () => validateLmin(i));
  lminEl.addEventListener('blur',  () => validateLmin(i));

  lmaxEl.addEventListener('input', () => validateLmax(i));
  lmaxEl.addEventListener('blur',  () => validateLmax(i));

  if (minBtn)  minBtn.addEventListener('click',  removeLastLoadCard);
  if (plusBtn) plusBtn.addEventListener('click', addLoadCard);
}

// ── Create and append a new load card ──
function addLoadCard() {
  if (loadCount >= LOAD_MAX) return;

  const i = loadCount;
  loadErrors[i] = { L: '', Lmin: '', Lmax: '' };

  const card = document.createElement('div');
  card.className = 'card load-card';
  card.id = `load-card-${i}`;
  card.innerHTML = `
    <h2>LOAD ${i}</h2>
    <div class="load-content">
      <div class="load-controls" id="load-controls-${i}">
        <button class="load-btn load-btn-minus" id="load-minus-${i}" aria-label="Remove load card">−</button>
        <button class="load-btn load-btn-plus"  id="load-plus-${i}"  aria-label="Add load card">+</button>
      </div>
      <div class="load-row">
        <div class="load-field">
          <label class="load-label" for="input-L${i}">Nominal</label>
          <div class="load-input-row">
            <input class="field-input load-input" type="number"
                   id="input-L${i}" inputmode="decimal" step="0.1">
            <span class="load-unit">W</span>
          </div>
        </div>
        <div class="load-field">
          <label class="load-label" for="input-Lmin${i}">Min</label>
          <div class="load-input-row">
            <input class="field-input load-input" type="number"
                   id="input-Lmin${i}" inputmode="decimal" step="0.1">
            <span class="load-unit">W</span>
          </div>
        </div>
        <div class="load-field">
          <label class="load-label" for="input-Lmax${i}">Max</label>
          <div class="load-input-row">
            <input class="field-input load-input" type="number"
                   id="input-Lmax${i}" inputmode="decimal" step="0.1">
            <span class="load-unit">W</span>
          </div>
        </div>
      </div>
      <p class="load-error" id="load-error-${i}"></p>
    </div>
  `;

  loadContainer.appendChild(card);
  loadCount++;

  attachLoadListeners(i);
  updateLoadControls();
  updateLoadOutput();
}

// ── Remove the last load card ──
function removeLastLoadCard() {
  if (loadCount <= 1) return;   // always keep at least 1 card

  loadCount--;
  const card = document.getElementById(`load-card-${loadCount}`);
  if (card) loadContainer.removeChild(card);
  loadErrors.splice(loadCount, 1);

  updateLoadControls();
  updateLoadOutput();
}

// ── Initialise: create the first load card on page load ──
addLoadCard();
