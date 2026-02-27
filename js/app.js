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

// ── Revert-on-invalid helper ──
// On blur: if the field value is invalid, silently restores the last known-good
// value and re-validates (clearing any error). If valid, saves the new value.
function blurValidate(inputEl, validateFn) {
  if (validateFn()) {
    inputEl.dataset.lastValid = inputEl.value;   // commit new good value
  } else {
    inputEl.value = inputEl.dataset.lastValid ?? '';  // restore previous good value
    validateFn();                                // re-run to clear error styling
  }
}

// ── Attach event listeners ──

// Seed each field's last-known-good value from its current (default) value.
inputN.dataset.lastValid    = inputN.value;    // "7"
inputC.dataset.lastValid    = inputC.value;    // "2000"
inputCmin.dataset.lastValid = inputCmin.value; // ""
inputCmax.dataset.lastValid = inputCmax.value; // ""

// Validate on blur only; revert to last valid if the new value is out-of-range.
inputN.addEventListener('blur',    () => blurValidate(inputN,    validateN));
inputC.addEventListener('blur',    () => blurValidate(inputC,    validateC));
inputCmin.addEventListener('blur', () => blurValidate(inputCmin, validateCmin));
inputCmax.addEventListener('blur', () => blurValidate(inputCmax, validateCmax));

// ─────────────────────────────────────────────
// LOAD Cards — dynamic management and validation
// ─────────────────────────────────────────────

const LOAD_MAX = 5;
let loadCount = 0;

// Per-card error registry: loadErrors[i] = { L: '', Lmin: '', Lmax: '' }
const loadErrors = [];

// Per-card ownership flags: tracks which fields the user has manually entered.
// {L: bool, Lmin: bool, Lmax: bool} — false = field is eligible for auto-populate.
const loadFieldUserSet = [];

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

// ── Auto-populate non-user-set fields from user-set ones ──
// Called after any field blurs.  Only fields whose ownership flag is false
// (loadFieldUserSet[i].L / .Lmin / .Lmax) are eligible for auto-population.
// Source values are only taken from user-set, error-free fields.
//
// Derivation rules:
//   L    ← avg(Lmin, Lmax) | Lmin | Lmax   (whichever are available)
//   Lmin ← L               | Lmax
//   Lmax ← L               | Lmin
//
// All results satisfy Lmin ≤ L ≤ Lmax when the source inputs are valid.
function tryAutoPopulateAll(i) {
  const us    = loadFieldUserSet[i];
  const lEl    = document.getElementById(`input-L${i}`);
  const lminEl = document.getElementById(`input-Lmin${i}`);
  const lmaxEl = document.getElementById(`input-Lmax${i}`);
  if (!lEl || !lminEl || !lmaxEl) return;

  // Capture user-set, error-free values as source data (auto values are ignored)
  const lVal    = (us.L    && lEl.value.trim()    !== '' && loadErrors[i].L    === '')
                  ? parseFloat(lEl.value.trim())    : null;
  const lminVal = (us.Lmin && lminEl.value.trim() !== '' && loadErrors[i].Lmin === '')
                  ? parseFloat(lminEl.value.trim()) : null;
  const lmaxVal = (us.Lmax && lmaxEl.value.trim() !== '' && loadErrors[i].Lmax === '')
                  ? parseFloat(lmaxEl.value.trim()) : null;

  // Apply same precision rules used for manual entry
  function fmtLoad(v) {
    if (v > 20) return String(Math.round(v));
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }

  // Write an auto value into a field and mark it as auto-populated
  function autoSet(el, fieldKey, val) {
    const fmt = fmtLoad(val);
    el.value = fmt;
    el.dataset.lastValid = fmt;          // keep revert baseline in sync
    el.classList.add('auto-populated');
    setLoadFieldState(i, el, fieldKey, '');
  }

  // Clear a field that was previously auto-populated
  function autoClear(el, fieldKey) {
    if (el.classList.contains('auto-populated')) {
      el.value = '';
      el.dataset.lastValid = '';
      el.classList.remove('auto-populated');
      setLoadFieldState(i, el, fieldKey, '');
    }
  }

  // ── Auto-populate L ──
  if (!us.L) {
    if      (lminVal !== null && lmaxVal !== null) autoSet(lEl, 'L', (lminVal + lmaxVal) / 2);
    else if (lminVal !== null)                     autoSet(lEl, 'L', lminVal);
    else if (lmaxVal !== null)                     autoSet(lEl, 'L', lmaxVal);
    else                                           autoClear(lEl, 'L');
  }

  // ── Auto-populate Lmin ──
  if (!us.Lmin) {
    if      (lVal    !== null) autoSet(lminEl, 'Lmin', lVal);
    else if (lmaxVal !== null) autoSet(lminEl, 'Lmin', lmaxVal);
    else                       autoClear(lminEl, 'Lmin');
  }

  // ── Auto-populate Lmax ──
  if (!us.Lmax) {
    if      (lVal    !== null) autoSet(lmaxEl, 'Lmax', lVal);
    else if (lminVal !== null) autoSet(lmaxEl, 'Lmax', lminVal);
    else                       autoClear(lmaxEl, 'Lmax');
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

  const us = loadFieldUserSet[i];      // ownership flags for this card

  // Seed last-known-good values (all start empty for a new card)
  lEl.dataset.lastValid    = lEl.value;
  lminEl.dataset.lastValid = lminEl.value;
  lmaxEl.dataset.lastValid = lmaxEl.value;

  // ── L (Nominal) ──
  // On input: claim ownership when typing, release when cleared; live-update report.
  // On blur:  validate; revert to lastValid if invalid; then auto-populate all peers.
  lEl.addEventListener('input', () => {
    const raw = lEl.value.trim();
    if (raw !== '') {
      us.L = true;                     // user is typing — take ownership
      lEl.classList.remove('auto-populated');
    } else {
      us.L = false;                    // field cleared — revert to auto-populate mode
    }
    updateLoadOutput();
  });
  lEl.addEventListener('blur', () => {
    if (validateL(i)) {
      lEl.dataset.lastValid = lEl.value;
    } else {
      lEl.value = lEl.dataset.lastValid ?? '';
      if (lEl.value === '') us.L = false;
      validateL(i);                    // re-validate to clear error styling
    }
    tryAutoPopulateAll(i);
  });

  // ── Lmin ──
  lminEl.addEventListener('input', () => {
    const raw = lminEl.value.trim();
    if (raw !== '') {
      us.Lmin = true;
      lminEl.classList.remove('auto-populated');
    } else {
      us.Lmin = false;
    }
    updateLoadOutput();
  });
  lminEl.addEventListener('blur', () => {
    if (validateLmin(i)) {
      lminEl.dataset.lastValid = lminEl.value;
    } else {
      lminEl.value = lminEl.dataset.lastValid ?? '';
      if (lminEl.value === '') us.Lmin = false;
      validateLmin(i);
    }
    tryAutoPopulateAll(i);
  });

  // ── Lmax ──
  lmaxEl.addEventListener('input', () => {
    const raw = lmaxEl.value.trim();
    if (raw !== '') {
      us.Lmax = true;
      lmaxEl.classList.remove('auto-populated');
    } else {
      us.Lmax = false;
    }
    updateLoadOutput();
  });
  lmaxEl.addEventListener('blur', () => {
    if (validateLmax(i)) {
      lmaxEl.dataset.lastValid = lmaxEl.value;
    } else {
      lmaxEl.value = lmaxEl.dataset.lastValid ?? '';
      if (lmaxEl.value === '') us.Lmax = false;
      validateLmax(i);
    }
    tryAutoPopulateAll(i);
  });

  if (minBtn)  minBtn.addEventListener('click',  removeLastLoadCard);
  if (plusBtn) plusBtn.addEventListener('click', addLoadCard);
}

// ── Create and append a new load card ──
function addLoadCard() {
  if (loadCount >= LOAD_MAX) return;

  const i = loadCount;
  loadErrors[i]       = { L: '', Lmin: '', Lmax: '' };
  loadFieldUserSet[i] = { L: false, Lmin: false, Lmax: false };  // all fields start in auto-populate mode

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
              <input class="field-input load-input" type="number"
                     id="input-Lmax${i}" inputmode="decimal" step="0.1">
              <!-- No unit label: Max right edge is flush; unit implied by Nominal/Min -->
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
  loadFieldUserSet.splice(loadCount, 1);

  updateLoadControls();
  updateLoadOutput();
}

// ── Footer timestamp ─────────────────────────
// Prepend "YYYY-MM-DD HH:MM " to the footer copy at page-load time
(function () {
  const tsEl = document.getElementById('footer-timestamp');
  if (!tsEl) return;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  tsEl.textContent =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())} `;
})();

// ── Initialise: create the first load card on page load ──
addLoadCard();
