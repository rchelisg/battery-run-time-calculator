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

// Validate on blur only (when user leaves the field).
// No validation while typing — avoids showing errors mid-entry on iOS and desktop.
inputN.addEventListener('blur', validateN);
inputC.addEventListener('blur', validateC);
inputCmin.addEventListener('blur', validateCmin);
inputCmax.addEventListener('blur', validateCmax);

// ─────────────────────────────────────────────
// LOAD Cards — dynamic management and validation
// ─────────────────────────────────────────────

const LOAD_MAX = 5;
let loadCount = 0;

// Per-card error registry: loadErrors[i] = { L: '', Lmin: '', Lmax: '' }
const loadErrors = [];

// Per-card flag: true = user has manually typed in L(i); false = auto-populate eligible
const loadLUserSet = [];

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
  updateTotalRow();
}

// ── Update the Total row — sum each column across all active LOAD cards ──
// Only sums valid numeric entries; skips empty and invalid fields.
// Rounds to 1 decimal place to avoid floating-point artefacts.
function updateTotalRow() {
  ['L', 'Lmin', 'Lmax'].forEach(field => {
    let sum    = 0;
    let hasAny = false;

    for (let i = 0; i < loadCount; i++) {
      const el  = document.getElementById(`input-${field}${i}`);
      if (!el) continue;
      const raw = el.value.trim();
      if (raw === '') continue;
      const val = parseFloat(raw);
      if (isNaN(val)) continue;
      sum    += val;
      hasAny  = true;
    }

    const totalEl = document.getElementById(`lo-total-${field}`);
    if (!totalEl) return;

    const isNom = (field === 'L');
    const cls   = isNom ? 'load-out-nom' : 'load-out-rng';

    if (hasAny) {
      // Round to 1 decimal place, then strip trailing .0 if whole number
      const rounded   = Math.round(sum * 10) / 10;
      const formatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
      totalEl.textContent = formatted;
      totalEl.className   = `${cls} has-value`;
    } else {
      totalEl.textContent = '—';
      totalEl.className   = `${cls} no-value`;
    }
  });
}

// ── Auto-populate L(i) from Lmin/Lmax when L is not user-set ──
// Called after Lmin or Lmax changes, or when L is cleared.
// Rules (per spec):
//   • Only Lmin entered  → L = Lmin
//   • Only Lmax entered  → L = Lmax
//   • Both entered       → L = (Lmin + Lmax) / 2
//   • Neither entered    → clear L if it was previously auto-populated
// The computed value is always valid, so no validation errors are raised.
// No-ops immediately if the user has manually entered L (loadLUserSet[i] = true).
function tryAutoPopulateL(i) {
  if (loadLUserSet[i]) return;   // user owns this field — never override

  const lEl    = document.getElementById(`input-L${i}`);
  const lminEl = document.getElementById(`input-Lmin${i}`);
  const lmaxEl = document.getElementById(`input-Lmax${i}`);
  if (!lEl) return;

  const lminRaw = lminEl ? lminEl.value.trim() : '';
  const lmaxRaw = lmaxEl ? lmaxEl.value.trim() : '';

  // Only use values that are currently error-free
  const lminVal = (lminRaw !== '' && loadErrors[i] && loadErrors[i].Lmin === '')
    ? parseFloat(lminRaw) : null;
  const lmaxVal = (lmaxRaw !== '' && loadErrors[i] && loadErrors[i].Lmax === '')
    ? parseFloat(lmaxRaw) : null;

  let autoVal = null;
  if      (lminVal !== null && lmaxVal !== null) autoVal = (lminVal + lmaxVal) / 2;
  else if (lminVal !== null)                     autoVal = lminVal;
  else if (lmaxVal !== null)                     autoVal = lmaxVal;

  if (autoVal !== null) {
    // Apply same precision rules used for manual entry
    let formatted;
    if (autoVal > 20) {
      formatted = String(Math.round(autoVal));          // whole number
    } else {
      const r = Math.round(autoVal * 10) / 10;
      formatted = Number.isInteger(r) ? String(r) : r.toFixed(1);  // ≤ 1 decimal
    }
    lEl.value = formatted;
    lEl.classList.add('auto-populated');
    setLoadFieldState(i, lEl, 'L', '');   // auto value is always in-range
  } else {
    // No valid Lmin/Lmax — clear L only if it was previously auto-populated
    if (lEl.classList.contains('auto-populated')) {
      lEl.value = '';
      lEl.classList.remove('auto-populated');
      setLoadFieldState(i, lEl, 'L', '');
    }
  }

  updateLoadOutput();
}

// ── Update +/- button visibility ──
// The controls strip is always present (consistent card width).
// Only the last card's buttons are visible; non-last cards have both hidden.
function updateLoadControls() {
  for (let i = 0; i < loadCount; i++) {
    const minBtn  = document.getElementById(`load-minus-${i}`);
    const plusBtn = document.getElementById(`load-plus-${i}`);
    if (!minBtn || !plusBtn) continue;

    const isLast = (i === loadCount - 1);

    if (!isLast) {
      // Non-last cards: hide both buttons; strip stays for consistent card width
      minBtn.style.visibility  = 'hidden';
      minBtn.disabled          = true;
      plusBtn.style.visibility = 'hidden';
      plusBtn.disabled         = true;
    } else if (loadCount === 1) {
      // Single card: + only (at bottom), − invisible (at top)
      minBtn.style.visibility  = 'hidden';
      minBtn.disabled          = true;
      plusBtn.style.visibility = 'visible';
      plusBtn.disabled         = false;
    } else if (loadCount < LOAD_MAX) {
      // Middle range: both − (top) and + (bottom)
      minBtn.style.visibility  = 'visible';
      minBtn.disabled          = false;
      plusBtn.style.visibility = 'visible';
      plusBtn.disabled         = false;
    } else {
      // Max cards reached: − only (at top), + invisible (at bottom)
      minBtn.style.visibility  = 'visible';
      minBtn.disabled          = false;
      plusBtn.style.visibility = 'hidden';
      plusBtn.disabled         = true;
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
    tryAutoPopulateL(i);   // re-apply auto-populate since L is now empty
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
    if (!recheck) {
      validateLmax(i, true);   // re-check Lmax whenever Lmin changes
      tryAutoPopulateL(i);     // re-compute L if not user-set
    }
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
    if (!recheck) {
      validateLmin(i, true);   // re-check Lmin whenever Lmax changes
      tryAutoPopulateL(i);     // re-compute L if not user-set
    }
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

  // L: track ownership on every keystroke; update report card live;
  //    but defer validation and error display to blur only.
  lEl.addEventListener('input', () => {
    const raw = lEl.value.trim();
    if (raw !== '') {
      loadLUserSet[i] = true;          // user is typing — take ownership
      lEl.classList.remove('auto-populated');
    } else {
      loadLUserSet[i] = false;         // field cleared — revert to auto-populate mode
    }
    updateLoadOutput();                // live update to report card (no error check)
  });
  lEl.addEventListener('blur', () => validateL(i));

  // Lmin / Lmax: update report card live; validate (errors + auto-populate) on blur only.
  lminEl.addEventListener('input', updateLoadOutput);
  lminEl.addEventListener('blur',  () => validateLmin(i));

  lmaxEl.addEventListener('input', updateLoadOutput);
  lmaxEl.addEventListener('blur',  () => validateLmax(i));

  if (minBtn)  minBtn.addEventListener('click',  removeLastLoadCard);
  if (plusBtn) plusBtn.addEventListener('click', addLoadCard);
}

// ── Create and append a new load card ──
function addLoadCard() {
  if (loadCount >= LOAD_MAX) return;

  const i = loadCount;
  loadErrors[i]  = { L: '', Lmin: '', Lmax: '' };
  loadLUserSet[i] = false;   // starts in auto-populate mode (L is empty)

  const card = document.createElement('div');
  card.className = 'card load-card';
  card.id = `load-card-${i}`;
  card.innerHTML = `
    <h2>LOAD ${i}</h2>
    <div class="load-content">
      <div class="load-row">
        <!-- Nominal — left side; auto-populated when L is empty and Lmin/Lmax are set -->
        <div class="load-field load-field-nominal">
          <label class="load-label" for="input-L${i}">Nominal</label>
          <div class="load-input-row">
            <input class="field-input load-input" type="number"
                   id="input-L${i}" inputmode="decimal" step="0.1">
            <span class="load-unit">W</span>
          </div>
        </div>
        <!-- Min + Max grouped and right-aligned via margin-left:auto -->
        <div class="load-minmax-group">
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
              <input class="field-input load-input input-max" type="number"
                     id="input-Lmax${i}" inputmode="decimal" step="0.1">
              <span class="load-unit">W</span>
            </div>
          </div>
        </div><!-- /load-minmax-group -->
      </div>
      <p class="load-error" id="load-error-${i}"></p>
    </div>
    <!-- Vertical +/- strip on right edge: − at top, + at bottom -->
    <div class="load-controls" id="load-controls-${i}">
      <button class="load-btn load-btn-minus" id="load-minus-${i}" aria-label="Remove load card">−</button>
      <button class="load-btn load-btn-plus"  id="load-plus-${i}"  aria-label="Add load card">+</button>
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
  loadLUserSet.splice(loadCount, 1);

  updateLoadControls();
  updateLoadOutput();
}

// ── Initialise: create the first load card on page load ──
addLoadCard();
