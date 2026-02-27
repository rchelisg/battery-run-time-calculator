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

// Per-field ownership: Cmin/Cmax can be auto-populated from C; N and C are always user-set
const packFieldUserSet = { Cmin: false, Cmax: false };

// ── Auto-populate Cmin/Cmax from C ──────────────
// Called after C blurs (valid or cleared), and after Cmin/Cmax clear.
// If Cmin/Cmax are not user-set, seeds them with C's value (or clears them when C clears).
function tryAutoPopulatePack() {
  const cRaw   = inputC.value.trim();
  const cValid = cRaw !== '' && packErrors.C === '';

  function autoSet(el, fieldKey) {
    el.value = cRaw;
    el.dataset.lastValid = cRaw;
    el.classList.add('auto-populated');
    setFieldState(el, fieldKey, '');
  }

  function autoClear(el, fieldKey) {
    if (el.classList.contains('auto-populated')) {
      el.value = '';
      el.dataset.lastValid = '';
      el.classList.remove('auto-populated');
      setFieldState(el, fieldKey, '');
    }
  }

  if (!packFieldUserSet.Cmin) {
    if (cValid) autoSet(inputCmin, 'Cmin');
    else         autoClear(inputCmin, 'Cmin');
  }

  if (!packFieldUserSet.Cmax) {
    if (cValid) autoSet(inputCmax, 'Cmax');
    else         autoClear(inputCmax, 'Cmax');
  }
  // Note: updateReportTime() is NOT called here because tryAutoPopulatePack()
  // runs during early PACK initialisation — before the TIME and LOAD const
  // bindings are declared.  Calling updateReportTime() here would trigger a
  // TDZ ReferenceError and halt the entire script.  Instead, each blur handler
  // that calls tryAutoPopulatePack() explicitly calls updateReportTime() after.
}

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

// ── Attach PACK event listeners ──

// Seed each field's last-known-good value from its current (default) value.
inputN.dataset.lastValid    = inputN.value;    // "7"
inputC.dataset.lastValid    = inputC.value;    // "2000"
inputCmin.dataset.lastValid = inputCmin.value; // ""
inputCmax.dataset.lastValid = inputCmax.value; // ""

// N — simple blur validate; also refresh report (N appears in "Cell count" line)
inputN.addEventListener('blur', () => {
  blurValidate(inputN, validateN);
  updateReportTime();
});

// C — after revert-or-save, re-run auto-populate for Cmin/Cmax, then refresh report
inputC.addEventListener('blur', () => {
  blurValidate(inputC, validateC);
  tryAutoPopulatePack();
  updateReportTime();
});

// Cmin — track ownership; revert-on-invalid on blur; re-populate if cleared
inputCmin.addEventListener('input', () => {
  if (inputCmin.value.trim() !== '') {
    packFieldUserSet.Cmin = true;
    inputCmin.classList.remove('auto-populated');
  } else {
    packFieldUserSet.Cmin = false;
  }
});
inputCmin.addEventListener('blur', () => {
  if (validateCmin()) {
    inputCmin.dataset.lastValid = inputCmin.value;
    if (inputCmin.value.trim() === '') packFieldUserSet.Cmin = false;
  } else {
    inputCmin.value = inputCmin.dataset.lastValid ?? '';
    if (inputCmin.value.trim() === '') packFieldUserSet.Cmin = false;
    validateCmin();
  }
  tryAutoPopulatePack();   // re-seed from C if Cmin was cleared
  updateReportTime();
});

// Cmax — track ownership; revert-on-invalid on blur; re-populate if cleared
inputCmax.addEventListener('input', () => {
  if (inputCmax.value.trim() !== '') {
    packFieldUserSet.Cmax = true;
    inputCmax.classList.remove('auto-populated');
  } else {
    packFieldUserSet.Cmax = false;
  }
});
inputCmax.addEventListener('blur', () => {
  if (validateCmax()) {
    inputCmax.dataset.lastValid = inputCmax.value;
    if (inputCmax.value.trim() === '') packFieldUserSet.Cmax = false;
  } else {
    inputCmax.value = inputCmax.dataset.lastValid ?? '';
    if (inputCmax.value.trim() === '') packFieldUserSet.Cmax = false;
    validateCmax();
  }
  tryAutoPopulatePack();   // re-seed from C if Cmax was cleared
  updateReportTime();
});

// Initial auto-populate — seeds Cmin/Cmax from the default C value (2000 mAh)
tryAutoPopulatePack();

// ─────────────────────────────────────────────
// TIME Card — inputs and validation
// ─────────────────────────────────────────────
// T    = Nominal run time (user entry, 0.5 – 100 Min)
// Tmin = Minimum run time (user entry, 0.5 – 100 Min, Tmin ≤ T)
// Tmax = Calculated maximum run time (read-only; populated later)
//
// Auto-populate: whichever of T / Tmin is entered FIRST seeds the other
// with the same value (light-blue indicator).  Once both are user-set,
// each can be changed independently.

const inputT    = document.getElementById('input-T');
const inputTmin = document.getElementById('input-Tmin');
const inputTmax = document.getElementById('input-Tmax');  // read-only; calculated later
const timeErrorEl = document.getElementById('time-error');
const timeErrors  = { T: '', Tmin: '' };

// Per-field ownership: false = eligible for auto-populate from the other field
const timeFieldUserSet = { T: false, Tmin: false };

// ── Show highest-priority TIME error ──
function showTimeError() {
  timeErrorEl.textContent = timeErrors.T || timeErrors.Tmin || '';
}

// ── Apply or clear one TIME field's error state ──
function setTimeFieldState(inputEl, fieldKey, message, isError = false) {
  if (isError) {
    inputEl.classList.add('input-error');
    timeErrors[fieldKey] = message;
  } else {
    inputEl.classList.remove('input-error');
    timeErrors[fieldKey] = '';
  }
  showTimeError();
}

// ── Precision helper for time: max 1 decimal place ──
function isValidTimePrecision(rawStr) {
  return /^\d+(\.\d)?$/.test(rawStr.trim());
}

// ── Auto-populate T ↔ Tmin ──
// The first field the user enters seeds the other with the same value.
// Once both are user-set, no more auto-populate.
function tryAutoPopulateTime() {
  const us = timeFieldUserSet;

  const tRaw    = inputT.value.trim();
  const tminRaw = inputTmin.value.trim();

  // Source values: only from user-set, error-free fields
  const tVal    = (us.T    && tRaw    !== '' && timeErrors.T    === '') ? tRaw    : null;
  const tminVal = (us.Tmin && tminRaw !== '' && timeErrors.Tmin === '') ? tminRaw : null;

  function autoSet(el, fieldKey, rawStr) {
    el.value = rawStr;
    el.dataset.lastValid = rawStr;
    el.classList.add('auto-populated');
    setTimeFieldState(el, fieldKey, '');
  }

  function autoClear(el, fieldKey) {
    if (el.classList.contains('auto-populated')) {
      el.value = '';
      el.dataset.lastValid = '';
      el.classList.remove('auto-populated');
      setTimeFieldState(el, fieldKey, '');
    }
  }

  // Auto-populate T from Tmin (if T not user-set)
  if (!us.T) {
    if (tminVal !== null) autoSet(inputT, 'T', tminVal);
    else                  autoClear(inputT, 'T');
  }

  // Auto-populate Tmin from T (if Tmin not user-set)
  if (!us.Tmin) {
    if (tVal !== null) autoSet(inputTmin, 'Tmin', tVal);
    else               autoClear(inputTmin, 'Tmin');
  }

  updateReportTime();   // refresh report whenever TIME values change
}

// ── Validate T (Nominal run time, Min) ──
// Range 0.5 – 100 Min; max 1 decimal place.
// Also re-checks Tmin because its upper bound depends on T.
function validateT() {
  const raw = inputT.value.trim();

  if (raw === '') {
    setTimeFieldState(inputT, 'T', '');
    validateTmin();
    return true;
  }

  const val = Number(raw);
  if (isNaN(val)) {
    setTimeFieldState(inputT, 'T', 'Nominal must be a number', true);
    validateTmin();
    return false;
  }
  if (val < 0.5 || val > 100) {
    setTimeFieldState(inputT, 'T', 'Nominal must be 0.5 – 100 Min', true);
    validateTmin();
    return false;
  }
  if (!isValidTimePrecision(raw)) {
    setTimeFieldState(inputT, 'T', 'Max 1 decimal place', true);
    validateTmin();
    return false;
  }

  setTimeFieldState(inputT, 'T', '');
  validateTmin();
  return true;
}

// ── Validate Tmin (minimum run time, Min) ──
// Range 0.5 – 100 Min; max 1 decimal place; Tmin ≤ T.
function validateTmin() {
  const raw = inputTmin.value.trim();

  if (raw === '') {
    setTimeFieldState(inputTmin, 'Tmin', '');
    return true;
  }

  const val = Number(raw);
  if (isNaN(val)) {
    setTimeFieldState(inputTmin, 'Tmin', 'Min must be a number', true);
    return false;
  }
  if (val < 0.5 || val > 100) {
    setTimeFieldState(inputTmin, 'Tmin', 'Min must be 0.5 – 100 Min', true);
    return false;
  }
  if (!isValidTimePrecision(raw)) {
    setTimeFieldState(inputTmin, 'Tmin', 'Max 1 decimal place', true);
    return false;
  }

  // Cross-check: Tmin ≤ T (Nominal ≥ Min)
  const tRaw = inputT.value.trim();
  if (tRaw !== '') {
    const tVal = Number(tRaw);
    if (!isNaN(tVal) && val > tVal) {
      setTimeFieldState(inputTmin, 'Tmin', `Min must be ≤ Nominal (${tVal})`, true);
      return false;
    }
  }

  setTimeFieldState(inputTmin, 'Tmin', '');
  return true;
}

// ── Attach TIME event listeners ──
inputT.dataset.lastValid    = inputT.value;    // ""
inputTmin.dataset.lastValid = inputTmin.value; // ""

// T — track ownership on input; revert-on-invalid on blur; auto-populate peer
inputT.addEventListener('input', () => {
  if (inputT.value.trim() !== '') {
    timeFieldUserSet.T = true;
    inputT.classList.remove('auto-populated');
  } else {
    timeFieldUserSet.T = false;
  }
});
inputT.addEventListener('blur', () => {
  if (validateT()) {
    inputT.dataset.lastValid = inputT.value;
    if (inputT.value.trim() === '') timeFieldUserSet.T = false;
  } else {
    inputT.value = inputT.dataset.lastValid ?? '';
    if (inputT.value.trim() === '') timeFieldUserSet.T = false;
    validateT();
  }
  tryAutoPopulateTime();
});

// Tmin — track ownership on input; revert-on-invalid on blur; auto-populate peer
inputTmin.addEventListener('input', () => {
  if (inputTmin.value.trim() !== '') {
    timeFieldUserSet.Tmin = true;
    inputTmin.classList.remove('auto-populated');
  } else {
    timeFieldUserSet.Tmin = false;
  }
});
inputTmin.addEventListener('blur', () => {
  if (validateTmin()) {
    inputTmin.dataset.lastValid = inputTmin.value;
    if (inputTmin.value.trim() === '') timeFieldUserSet.Tmin = false;
  } else {
    inputTmin.value = inputTmin.dataset.lastValid ?? '';
    if (inputTmin.value.trim() === '') timeFieldUserSet.Tmin = false;
    validateTmin();
  }
  tryAutoPopulateTime();
});

// ─────────────────────────────────────────────
// Page system — nav bar, show/hide, reset on switch
// ─────────────────────────────────────────────

// Maps each nav-button ID → its page div ID
const PAGE_MAP = {
  'nav-calc': 'page-calc',
  'nav-time': 'page-time',
  'nav-cost': 'page-cost',
  'nav-load': 'page-load',
};

// ── Switch to a page ──
// Always calls resetPage so re-tapping the active button clears all entries.
// Only updates the visible page and nav highlight when actually switching pages.
function switchPage(pageId) {
  const current = document.querySelector('.page:not(.page-hidden)');

  if (!current || current.id !== pageId) {
    // Different page — hide all, show target, update nav highlight
    document.querySelectorAll('.page').forEach(p => p.classList.add('page-hidden'));
    const target = document.getElementById(pageId);
    if (target) target.classList.remove('page-hidden');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const navId = Object.keys(PAGE_MAP).find(k => PAGE_MAP[k] === pageId);
    if (navId) document.getElementById(navId)?.classList.add('active');
  }

  // Always reset — clears entries and restores defaults even when re-tapping current page
  resetPage(pageId);
}

// ── Reset a page to its default state ──
// Called every time the user taps into a page.
// Only PAGE Calc has content yet; others are no-ops.
function resetPage(pageId) {
  if (pageId !== 'page-calc') return;

  // ── PACK: restore defaults (N = 7, C = 2000; Cmin/Cmax cleared for auto-seed) ──
  inputN.value             = '7';
  inputN.dataset.lastValid = '7';
  setFieldState(inputN, 'N', '');

  inputC.value             = '2000';
  inputC.dataset.lastValid = '2000';
  setFieldState(inputC, 'C', '');

  inputCmin.value             = '';
  inputCmin.dataset.lastValid = '';
  inputCmin.classList.remove('auto-populated');
  packFieldUserSet.Cmin = false;
  setFieldState(inputCmin, 'Cmin', '');

  inputCmax.value             = '';
  inputCmax.dataset.lastValid = '';
  inputCmax.classList.remove('auto-populated');
  packFieldUserSet.Cmax = false;
  setFieldState(inputCmax, 'Cmax', '');

  tryAutoPopulatePack();   // re-seeds Cmin/Cmax from C = 2000

  // ── LOAD: remove all cards and add one fresh empty card ──
  while (loadCount > 0) {
    loadCount--;
    const card = document.getElementById(`load-card-${loadCount}`);
    if (card) loadContainer.removeChild(card);
  }
  loadErrors.length       = 0;
  loadFieldUserSet.length = 0;
  addLoadCard();   // triggers updateTotalRow → updateReportTime
}

// Attach nav-button → switchPage handlers
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const pageId = PAGE_MAP[btn.id];
    if (pageId) switchPage(pageId);
  });
});

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

// ── Update the LOAD summary card ──
// Reflects any change to LOAD input fields; delegates to updateTotalRow.
function updateLoadOutput() {
  updateTotalRow();
}

// ── Update the LOAD summary card values ──
// Sums Nom/Min/Max columns across all active LOAD x cards and displays totals.
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

    const summaryEl = document.getElementById(`ls-${field}`);
    if (!summaryEl) return;

    if (hasAny) {
      const rounded = Math.round(sum * 10) / 10;
      summaryEl.textContent = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    } else {
      summaryEl.textContent = '—';
    }
  });

  updateReportTime();   // refresh report whenever LOAD totals change
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
  card.className = 'card load-card load-x-card';
  card.id = `load-card-${i}`;
  card.innerHTML = `
    <h2>L${i}</h2>
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
              <span class="load-unit unit-max">W</span>
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

// ─────────────────────────────────────────────
// REPORT TIME Card — formatting helpers and render function
// ─────────────────────────────────────────────

// ── Calculate run time (PAGE Calc) ──
// Formula: E = N × 3.6 × C / 1000  (Wh)   T = E / L × 60  (Min)
//
// Spec (Solve for T given E and L):
//   Build E-set  = { E, Emin (if Cmin present), Emax (if Cmax present) }
//   Build L-set  = { L, Lmin (if present), Lmax (if present) }
//   Candidates   = all (Ei / Lj) × 60
//   T (nominal)  = E / L × 60  — always shown
//   Tmin         = min(candidates)  shown only if < T
//   Tmax         = max(candidates)  shown only if > T
//
// Returns { T, Tmin, Tmax } as strings ('' = absent/unknown → shows "—" in report).
function calcRunTime(N, C, Cmin, Cmax, lsL, lsLmin, lsLmax) {
  const n = parseInt(N, 10);
  const c = parseFloat(C);
  const l = parseFloat(lsL);

  // All three nominal values must be valid to compute anything
  if (!Number.isInteger(n) || n < 1 || n > 8)  return { T: '', Tmin: '', Tmax: '' };
  if (isNaN(c) || c < 100  || c > 8000)        return { T: '', Tmin: '', Tmax: '' };
  if (isNaN(l) || l <= 0)                       return { T: '', Tmin: '', Tmax: '' };

  // Nominal energy (Wh) and run time (Min)
  const E    = n * 3.6 * c / 1000;
  const tNom = E / l * 60;

  // Build E-set: add Emin/Emax only when Cmin/Cmax contain valid numbers
  const eSet = [E];
  const cminV = parseFloat(Cmin);
  const cmaxV = parseFloat(Cmax);
  if (Cmin !== '' && !isNaN(cminV) && cminV > 0) eSet.push(n * 3.6 * cminV / 1000);
  if (Cmax !== '' && !isNaN(cmaxV) && cmaxV > 0) eSet.push(n * 3.6 * cmaxV / 1000);

  // Build L-set: add Lmin/Lmax only when the summary spans show real numbers (not '—')
  const lSet = [l];
  const lminV = parseFloat(lsLmin);
  const lmaxV = parseFloat(lsLmax);
  if (lsLmin !== '—' && !isNaN(lminV) && lminV > 0) lSet.push(lminV);
  if (lsLmax !== '—' && !isNaN(lmaxV) && lmaxV > 0) lSet.push(lmaxV);

  // All (Ei / Lj) × 60 candidates — rounded to 1 decimal
  const rd1  = v => Math.round(v * 10) / 10;
  const cands = [];
  for (const e of eSet) {
    for (const lv of lSet) {
      cands.push(rd1(e / lv * 60));
    }
  }

  const T    = rd1(tNom);
  const minC = Math.min(...cands);
  const maxC = Math.max(...cands);

  return {
    T:    String(T),
    Tmin: minC < T ? String(minC) : '',
    Tmax: maxC > T ? String(maxC) : '',
  };
}

// ── Format cell capacity (mAh) ──
// Returns a 4-char right-aligned integer string, or "   —" if absent/invalid.
// "Pad leading zero with space" means we use spaces, not zeros.
function fmtCap(raw) {
  const s = (typeof raw === 'string') ? raw.trim() : String(raw);
  if (s === '' || s === '—') return '   —';
  const n = parseInt(s, 10);
  if (isNaN(n)) return '   —';
  return String(n).padStart(4, ' ');
}

// ── Format load (W) ──
// Returns a 4-char right-aligned string preserving up to 1 decimal place,
// or "   —" if absent/invalid.
function fmtLoad(raw) {
  const s = (typeof raw === 'string') ? raw.trim() : String(raw);
  if (s === '' || s === '—') return '   —';
  const n = parseFloat(s);
  if (isNaN(n)) return '   —';
  const display = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return display.padStart(4, ' ');
}

// ── Format run time (Min) ──
// Returns a 5-char right-aligned string: "###.#" format (e.g. "  5.5", "100.0").
// Absent/invalid → "    —".
function fmtTime(raw) {
  const s = (typeof raw === 'string') ? raw.trim() : String(raw);
  if (s === '' || s === '—') return '    —';
  const n = parseFloat(s);
  if (isNaN(n)) return '    —';
  return n.toFixed(1).padStart(5, ' ');
}

// ── Build and display the REPORT TIME formatted text ──
// Called whenever PACK or LOAD values change (T is calculated, not user-entered here).
//
// Column layout — 15-char prefix, values start at column 16:
//                  Nom     Min   Max
//   Cell Capacity: aaaa    bbbb  cccc   (mAH)
//      Cell count:    d
//                                       ← blank line 006
//            Load  eeee    ffff  gggg   (W)
//              Lx  eeee    ffff  gggg   (W)   ← one per LOAD card (grey)
//   ===> Run Time: kkkkk   lllll mmmmm  (Min) ← 5-char values, bold+larger
//
// Column header: 16 spaces so "Nom/Min/Max" right-align with Cap/Load 4-char columns.
// Cap/Load values: 4-char right-aligned.  Run Time values: 5-char right-aligned.
// Colon labels = 14 chars + 1 space.  No-colon labels (Load, Lx) = 13 chars + 2 spaces.
// Title (.rpt-title) is largest; Run Time is bold + .rpt-runtime; Lx lines = .rpt-loadx.
// Blank lines: after title (002), between Cell count and Load (006), before Run Time.
// No trailing blank line.
function updateReportTime() {
  const pre = document.getElementById('report-time-pre');
  if (!pre) return;

  // Escape HTML special chars so plain text is safe inside innerHTML
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Gather PACK values ──
  const N    = inputN    ? inputN.value.trim()    : '';
  const C    = inputC    ? inputC.value.trim()    : '';
  const Cmin = inputCmin ? inputCmin.value.trim() : '';
  const Cmax = inputCmax ? inputCmax.value.trim() : '';

  // ── Gather LOAD summary values (from the live summary spans) ──
  const lsLEl    = document.getElementById('ls-L');
  const lsLminEl = document.getElementById('ls-Lmin');
  const lsLmaxEl = document.getElementById('ls-Lmax');
  const lsL    = lsLEl    ? lsLEl.textContent.trim()    : '—';
  const lsLmin = lsLminEl ? lsLminEl.textContent.trim() : '—';
  const lsLmax = lsLmaxEl ? lsLmaxEl.textContent.trim() : '—';

  // ── Calculate run time from PACK + LOAD (E = N × 3.6 × C / 1000 Wh) ──
  const { T, Tmin, Tmax } = calcRunTime(N, C, Cmin, Cmax, lsL, lsLmin, lsLmax);

  // Cell count: right-align single digit to 4 chars so it sits in the Nom column
  const nFmt = (N !== '') ? String(N).padStart(4, ' ') : '   —';

  // ── Build text lines ──
  // 15-char prefix for all labels:
  //   colon labels  → 14-char label + 1 space  (e.g. "Cell Capacity: ")
  //   no-colon      → 13-char label + 2 spaces  (e.g. "         Load  ")
  // After prefix: nom(4) + "    " + min(4) + "  " + max(4) + "   " + "(unit)"
  // Column header uses 16 spaces so "Nom/Min/Max" right-align with their columns.
  const title    = 'Battery Run Time Calculator';
  const hdrLine  = '                Nom     Min   Max';
  const capLine  = `Cell Capacity: ${fmtCap(C)}    ${fmtCap(Cmin)}  ${fmtCap(Cmax)}   (mAH)`;
  const cntLine  = `   Cell count: ${nFmt}`;
  const loadLine = `         Load  ${fmtLoad(lsL)}    ${fmtLoad(lsLmin)}  ${fmtLoad(lsLmax)}   (W)`;

  // Per-LOAD-card breakdown: one line per active card (no colon — 13-char label + 2 spaces)
  const loadCardLines = [];
  for (let i = 0; i < loadCount; i++) {
    const lEl    = document.getElementById(`input-L${i}`);
    const lminEl = document.getElementById(`input-Lmin${i}`);
    const lmaxEl = document.getElementById(`input-Lmax${i}`);
    const lv    = lEl    ? lEl.value.trim()    : '';
    const lminv = lminEl ? lminEl.value.trim() : '';
    const lmaxv = lmaxEl ? lmaxEl.value.trim() : '';
    const label = `L${i}`.padStart(13, ' ') + '  ';   // 15-char prefix, no colon
    loadCardLines.push(`${label}${fmtLoad(lv)}    ${fmtLoad(lminv)}  ${fmtLoad(lmaxv)}   (W)`);
  }

  // Run time summary: 4-char calculated values; trailing (Min) unit
  const runTimeLine = `===> Run Time: ${fmtTime(T)}    ${fmtTime(Tmin)}  ${fmtTime(Tmax)}   (Min)`;

  // ── Assemble HTML ──
  // Title uses .rpt-title class (largest); Run Time uses bold + .rpt-runtime (medium);
  // Lx lines use .rpt-loadx (light grey). Blank lines: 002, 006, before Run Time.
  // No trailing blank line.
  const lines = [
    `<strong class="rpt-title">${esc(title)}</strong>`,
    '',                                        // line 002 blank after title
    esc(hdrLine),                              // line 003 column header
    esc(capLine),                              // line 004 Cell Capacity
    esc(cntLine),                              // line 005 Cell count
    '',                                        // line 006 blank between Cell count and Load
    esc(loadLine),                             // line 007 LOAD total
    ...loadCardLines.map(l => `<span class="rpt-loadx">${esc(l)}</span>`),  // Lx grey
    '',                                        // blank line before Run Time
    `<strong class="rpt-runtime">${esc(runTimeLine)}</strong>`  // Run Time bold + larger
  ];

  pre.innerHTML = lines.join('\n');
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

// Initial REPORT TIME render — populate with default PACK values (C=2000, N=7)
// LOAD totals are populated by addLoadCard() above; TIME fields start empty.
updateReportTime();
