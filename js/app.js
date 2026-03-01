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
// DEBUG PANEL — live state display (remove before production)
// ─────────────────────────────────────────────
const dbg = {
  T: '—', Tmin: '—', Tmax: '—',
  L: '—', Lmin: '—', Lmax: '—',
  E: '—', Emin: '—', Emax: '—',
  C: '—', Cmin: '—', Cmax: '—',
  N: '—', NN: '—',
};

function refreshDebug() {
  const f = v => (v === '' || v === undefined || v === null) ? '—' : String(v);
  document.getElementById('dbg-1').textContent =
    `T: ${f(dbg.T)}  Tmin: ${f(dbg.Tmin)}  Tmax: ${f(dbg.Tmax)}`;
  document.getElementById('dbg-2').textContent =
    `L: ${f(dbg.L)}  Lmin: ${f(dbg.Lmin)}  Lmax: ${f(dbg.Lmax)}`;
  document.getElementById('dbg-3').textContent =
    `E: ${f(dbg.E)}  Emin: ${f(dbg.Emin)}  Emax: ${f(dbg.Emax)}`;
  document.getElementById('dbg-4').textContent =
    `C: ${f(dbg.C)}  Cmin: ${f(dbg.Cmin)}  Cmax: ${f(dbg.Cmax)}`;
  document.getElementById('dbg-5').textContent =
    `N: ${f(dbg.N)}  NN: ${f(dbg.NN)}`;
}

function dbgClear() {
  Object.keys(dbg).forEach(k => { dbg[k] = '—'; });
}

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
  // SCREEN DfTime: reveal PACK+LOAD on first valid T entry — T never locks a mode
  if (inputT.value.trim() !== '') dtRevealPackAndLoad();
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
function resetPage(pageId) {
  if (pageId === 'page-time') { dtResetPage(); return; }
  if (pageId === 'page-cost') { dcResetPage(); return; }
  if (pageId !== 'page-calc') return;

  dbgClear(); refreshDebug();   // clear debug panel on Calc reset

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
            <input class="field-input load-input" type="text"
                   id="input-L${i}" inputmode="decimal" step="0.1">
            <span class="load-unit">W</span>
          </div>
        </div>
        <!-- Min + Max grouped and right-aligned via margin-left:auto -->
        <div class="load-minmax-group">
          <div class="load-field">
            <label class="load-label" for="input-Lmin${i}">Min</label>
            <div class="load-input-row">
              <input class="field-input load-input" type="text"
                     id="input-Lmin${i}" inputmode="decimal" step="0.1">
              <span class="load-unit">W</span>
            </div>
          </div>
          <div class="load-field">
            <label class="load-label" for="input-Lmax${i}">Max</label>
            <div class="load-input-row">
              <input class="field-input load-input" type="text"
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
// v1.2 T=f(E,L):
//   T    = E / L × 60
//   Tmin = Emin / Lmax × 60   (Emin uses Cmin if present; Lmax from summary if present)
//   Tmax = Emax / Lmin × 60   (Emax uses Cmax if present; Lmin from summary if present)
//   When Emin == E and Lmax == L (no range data), Tmin == T → not shown.
//   When Emax == E and Lmin == L (no range data), Tmax == T → not shown.
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

  const rd1  = v => Math.round(v * 10) / 10;

  // Nominal energy (Wh) and run time (Min)
  const E    = n * 3.6 * c / 1000;
  const T    = rd1(E / l * 60);

  // v1.2: Emin uses Cmin if present; otherwise falls back to E
  // v1.2: Emax uses Cmax if present; otherwise falls back to E
  // v1.2: Lmax uses lsLmax if present (not '—'); otherwise falls back to L
  // v1.2: Lmin uses lsLmin if present (not '—'); otherwise falls back to L
  const cminV = parseFloat(Cmin);
  const cmaxV = parseFloat(Cmax);
  const lminV = parseFloat(lsLmin);
  const lmaxV = parseFloat(lsLmax);

  const Emin = (Cmin !== '' && !isNaN(cminV) && cminV > 0) ? n * 3.6 * cminV / 1000 : E;
  const Emax = (Cmax !== '' && !isNaN(cmaxV) && cmaxV > 0) ? n * 3.6 * cmaxV / 1000 : E;
  const Lmax = (lsLmax !== '—' && !isNaN(lmaxV) && lmaxV > 0) ? lmaxV : l;
  const Lmin = (lsLmin !== '—' && !isNaN(lminV) && lminV > 0) ? lminV : l;

  const Tmin = rd1(Emin / Lmax * 60);
  const Tmax = rd1(Emax / Lmin * 60);

  return {
    T:    String(T),
    Tmin: Tmin < T ? String(Tmin) : '',
    Tmax: Tmax > T ? String(Tmax) : '',
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

// ── Build and display the REPORT TIME card ──
// Called whenever PACK or LOAD values change.
//
// Renders an HTML table (5 columns: label | Nom | Min | Max | unit) inside
// #report-time-wrap.  Proportional font + CSS text-align + tabular-nums
// handle column alignment — no monospace padding needed.
//
// Rows:
//   Header    [blank]   Nom  Min  Max  [blank]
//   Cell Cap  mAh values
//   Cells     cell count (Nom only)
//   [gap]
//   Load      W totals
//   L0…Ln    per-card W breakdown  (grey)
//   ─────────────────────────────────────────  (border-top)
//   Run Time  Min result  (bold)
function updateReportTime() {
  const wrap = document.getElementById('report-time-wrap');
  if (!wrap) return;

  // Escape HTML special chars for safe innerHTML insertion
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // Trim monospace padding from the fmt helpers before inserting into table cells
  function v(raw) { return esc(raw.trim()); }

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

  // Cell count — plain number, no monospace padding
  const nDisplay = (N !== '') ? esc(N) : '—';

  // ── Per-LOAD-card breakdown rows (one per active card, grey) ──
  let lxRows = '';
  for (let i = 0; i < loadCount; i++) {
    const lEl    = document.getElementById(`input-L${i}`);
    const lminEl = document.getElementById(`input-Lmin${i}`);
    const lmaxEl = document.getElementById(`input-Lmax${i}`);
    const lv    = lEl    ? lEl.value.trim()    : '';
    const lminv = lminEl ? lminEl.value.trim() : '';
    const lmaxv = lmaxEl ? lmaxEl.value.trim() : '';
    lxRows += `<tr>
          <td class="rpt-td-lbl rpt-lx">L${i}</td>
          <td class="rpt-td-num rpt-lx">${v(fmtLoad(lv))}</td>
          <td class="rpt-td-num rpt-lx">${v(fmtLoad(lminv))}</td>
          <td class="rpt-td-num rpt-lx">${v(fmtLoad(lmaxv))}</td>
          <td class="rpt-td-unit rpt-lx">W</td>
        </tr>`;
  }

  // ── Assemble HTML ──
  wrap.innerHTML = `
    <div class="rpt-heading">Battery Run Time Calculator</div>
    <table class="rpt-table">
      <tbody>
        <tr>
          <td class="rpt-td-lbl">Cells</td>
          <td class="rpt-td-num">${nDisplay}</td>
          <td class="rpt-td-num"></td>
          <td class="rpt-td-num"></td>
          <td class="rpt-td-unit"></td>
        </tr>
        <tr>
          <td class="rpt-td-lbl">Cell Cap</td>
          <td class="rpt-td-num">${v(fmtCap(C))}</td>
          <td class="rpt-td-num">${v(fmtCap(Cmin))}</td>
          <td class="rpt-td-num">${v(fmtCap(Cmax))}</td>
          <td class="rpt-td-unit">mAh</td>
        </tr>
        <tr class="rpt-gap"><td colspan="5"></td></tr>
        <tr>
          <td class="rpt-td-lbl">Load</td>
          <td class="rpt-td-num">${v(fmtLoad(lsL))}</td>
          <td class="rpt-td-num">${v(fmtLoad(lsLmin))}</td>
          <td class="rpt-td-num">${v(fmtLoad(lsLmax))}</td>
          <td class="rpt-td-unit">W</td>
        </tr>
        ${lxRows}
        <tr class="rpt-col-hdr">
          <td class="rpt-td-lbl"></td>
          <td class="rpt-td-num">Nom</td>
          <td class="rpt-td-num">Min</td>
          <td class="rpt-td-num">Max</td>
          <td class="rpt-td-unit"></td>
        </tr>
        <tr class="rpt-time-row">
          <td class="rpt-td-lbl">Run Time</td>
          <td class="rpt-td-num">${v(fmtTime(T))}</td>
          <td class="rpt-td-num">${v(fmtTime(Tmin))}</td>
          <td class="rpt-td-num">${v(fmtTime(Tmax))}</td>
          <td class="rpt-td-unit">Min</td>
        </tr>
      </tbody>
    </table>`;

  // ── Debug panel update (Calc screen) ──
  const nNum = parseFloat(N), cNum = parseFloat(C);
  const cminNum = parseFloat(Cmin), cmaxNum = parseFloat(Cmax);
  const rd2c = x => Math.round(x * 100) / 100;
  dbg.T    = T;    dbg.Tmin = Tmin; dbg.Tmax = Tmax;
  dbg.L    = lsL;  dbg.Lmin = lsLmin; dbg.Lmax = lsLmax;
  dbg.E    = (!isNaN(nNum) && !isNaN(cNum))    ? String(rd2c(nNum * 3.6 * cNum    / 1000)) : '—';
  dbg.Emin = (!isNaN(nNum) && !isNaN(cminNum)) ? String(rd2c(nNum * 3.6 * cminNum / 1000)) : '—';
  dbg.Emax = (!isNaN(nNum) && !isNaN(cmaxNum)) ? String(rd2c(nNum * 3.6 * cmaxNum / 1000)) : '—';
  dbg.C    = C;    dbg.Cmin = Cmin; dbg.Cmax = Cmax;
  dbg.N    = N;    dbg.NN   = '—';
  refreshDebug();
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

// ── REPORT TIME card — copy icon button ──────────────────────────
// Tap the clipboard icon (top-right corner) to copy the formatted
// plain-text report to clipboard; flashes card bright green for 0.25 s.
(function () {
  const copyBtn    = document.getElementById('rpt-copy-btn');
  const reportCard = document.querySelector('.report-time-card');
  if (!copyBtn || !reportCard) return;

  copyBtn.addEventListener('click', () => {
    const wrap = document.getElementById('report-time-wrap');
    if (!wrap) return;

    // Heading line
    const headingEl = wrap.querySelector('.rpt-heading');
    const lines = headingEl ? [headingEl.textContent.trim()] : [];

    // Table rows — format as fixed-width plain-text columns
    wrap.querySelectorAll('.rpt-table tbody tr').forEach(row => {
      if (row.classList.contains('rpt-gap')) {
        lines.push('');
        return;
      }
      const c    = Array.from(row.querySelectorAll('td'));
      const lbl  = (c[0] ? c[0].textContent.trim() : '').padEnd(10);
      const nom  = (c[1] ? c[1].textContent.trim() : '').padStart(7);
      const min  = (c[2] ? c[2].textContent.trim() : '').padStart(7);
      const max  = (c[3] ? c[3].textContent.trim() : '').padStart(7);
      const unit = c[4] ? c[4].textContent.trim() : '';
      lines.push(lbl + nom + min + max + (unit ? '  ' + unit : ''));
    });

    navigator.clipboard.writeText(lines.join('\n').trimEnd())
      .then(() => {
        // Flash brighter green for 0.25 s then revert to original card colour
        reportCard.style.backgroundColor = '#66BB6A';
        setTimeout(() => { reportCard.style.backgroundColor = ''; }, 250);
      })
      .catch(() => { /* clipboard unavailable — fail silently */ });
  });
}());

// ─────────────────────────────────────────────
// DfCost page — dc-prefixed IDs; independent state
// E=f(T,L) path: given T (run time) and L (load), compute required energy E
// E = L × T / 60    Emax = Lmax × T / 60    (v1.2)
// ─────────────────────────────────────────────

// ── DC computed energy state (updated by dcUpdateEnergyCard) ──
let dcComputedE    = NaN;
let dcComputedEmax = NaN;

// ── DC PACK elements and state (resolve card: N and C only) ──
const dcInputN    = document.getElementById('dc-input-N');
const dcInputC    = document.getElementById('dc-input-C');
const dcPackErrorEl = document.getElementById('dc-pack-error');
const dcPackErrors  = { N: '', C: '' };

function showDcPackError() {
  dcPackErrorEl.textContent = dcPackErrors.N || dcPackErrors.C || '';
}

function setDcFieldState(inputEl, fieldKey, message, isError = false) {
  if (isError) {
    inputEl.classList.add('input-error');
    dcPackErrors[fieldKey] = message;
  } else {
    inputEl.classList.remove('input-error');
    dcPackErrors[fieldKey] = '';
  }
  showDcPackError();
}

function validateDcN() {
  const raw = dcInputN.value.trim();
  if (raw === '') { setDcFieldState(dcInputN, 'N', ''); return true; }
  const val = Number(raw);
  if (!Number.isInteger(val)) {
    setDcFieldState(dcInputN, 'N', 'Cells must be a whole number', true); return false;
  }
  if (val < 1 || val > 8) {
    setDcFieldState(dcInputN, 'N', 'Cells must be 1 – 8', true); return false;
  }
  setDcFieldState(dcInputN, 'N', '');
  return true;
}

function validateDcC() {
  const raw = dcInputC.value.trim();
  if (raw === '') { setDcFieldState(dcInputC, 'C', ''); return true; }
  const val = Number(raw);
  if (isNaN(val) || !Number.isInteger(val)) {
    setDcFieldState(dcInputC, 'C', 'Nominal must be a whole number', true); return false;
  }
  if (val < 100 || val > 8000) {
    setDcFieldState(dcInputC, 'C', 'Nominal must be 100 – 8000 mAh', true); return false;
  }
  setDcFieldState(dcInputC, 'C', '');
  return true;
}

// Seed lastValid
dcInputN.dataset.lastValid = dcInputN.value;
dcInputC.dataset.lastValid = dcInputC.value;

dcInputN.addEventListener('blur', () => {
  blurValidate(dcInputN, validateDcN);
  dcUpdateResolveCard();
});

dcInputC.addEventListener('blur', () => {
  blurValidate(dcInputC, validateDcC);
  dcUpdateResolveCard();
});

// ─────────────────────────────────────────────
// DC TIME — inputs and validation
// T/Tmin/Tmax are all user-editable (no auto-populate between fields).
// First valid blur → Mode A (TIME entered first).
// ─────────────────────────────────────────────

const dcInputT    = document.getElementById('dc-input-T');
const dcInputTmin = document.getElementById('dc-input-Tmin');
const dcInputTmax = document.getElementById('dc-input-Tmax');
const dcTimeErrorEl = document.getElementById('dc-time-error');
const dcTimeErrors  = { T: '', Tmin: '', Tmax: '' };

function showDcTimeError() {
  dcTimeErrorEl.textContent = dcTimeErrors.T || dcTimeErrors.Tmin || dcTimeErrors.Tmax || '';
}

function setDcTimeFieldState(inputEl, fieldKey, message, isError = false) {
  if (isError) {
    inputEl.classList.add('input-error');
    dcTimeErrors[fieldKey] = message;
  } else {
    inputEl.classList.remove('input-error');
    dcTimeErrors[fieldKey] = '';
  }
  showDcTimeError();
}

function validateDcT() {
  const raw = dcInputT.value.trim();
  if (raw === '') {
    setDcTimeFieldState(dcInputT, 'T', '');
    validateDcTmin(); validateDcTmax();
    return true;
  }
  const val = Number(raw);
  if (isNaN(val)) { setDcTimeFieldState(dcInputT, 'T', 'Nominal must be a number', true); return false; }
  if (val < 0.5 || val > 100) { setDcTimeFieldState(dcInputT, 'T', 'Nominal must be 0.5 – 100 Min', true); return false; }
  if (!isValidTimePrecision(raw)) { setDcTimeFieldState(dcInputT, 'T', 'Max 1 decimal place', true); return false; }
  setDcTimeFieldState(dcInputT, 'T', '');
  validateDcTmin(); validateDcTmax();
  return true;
}

function validateDcTmin() {
  const raw = dcInputTmin.value.trim();
  if (raw === '') { setDcTimeFieldState(dcInputTmin, 'Tmin', ''); return true; }
  const val = Number(raw);
  if (isNaN(val)) { setDcTimeFieldState(dcInputTmin, 'Tmin', 'Min must be a number', true); return false; }
  if (val < 0.5 || val > 100) { setDcTimeFieldState(dcInputTmin, 'Tmin', 'Min must be 0.5 – 100 Min', true); return false; }
  if (!isValidTimePrecision(raw)) { setDcTimeFieldState(dcInputTmin, 'Tmin', 'Max 1 decimal place', true); return false; }
  const tRaw = dcInputT.value.trim();
  if (tRaw !== '') {
    const tVal = Number(tRaw);
    if (!isNaN(tVal) && val > tVal) {
      setDcTimeFieldState(dcInputTmin, 'Tmin', `Min must be ≤ Nominal (${tVal})`, true); return false;
    }
  }
  setDcTimeFieldState(dcInputTmin, 'Tmin', '');
  return true;
}

function validateDcTmax() {
  const raw = dcInputTmax.value.trim();
  if (raw === '') { setDcTimeFieldState(dcInputTmax, 'Tmax', ''); return true; }
  const val = Number(raw);
  if (isNaN(val)) { setDcTimeFieldState(dcInputTmax, 'Tmax', 'Max must be a number', true); return false; }
  if (val < 0.5 || val > 100) { setDcTimeFieldState(dcInputTmax, 'Tmax', 'Max must be 0.5 – 100 Min', true); return false; }
  if (!isValidTimePrecision(raw)) { setDcTimeFieldState(dcInputTmax, 'Tmax', 'Max 1 decimal place', true); return false; }
  const tRaw = dcInputT.value.trim();
  if (tRaw !== '') {
    const tVal = Number(tRaw);
    if (!isNaN(tVal) && val < tVal) {
      setDcTimeFieldState(dcInputTmax, 'Tmax', `Max must be ≥ Nominal (${tVal})`, true); return false;
    }
  }
  setDcTimeFieldState(dcInputTmax, 'Tmax', '');
  return true;
}

dcInputT.dataset.lastValid    = '';
dcInputTmin.dataset.lastValid = '';
dcInputTmax.dataset.lastValid = '';

// Helper: blur handler for all three DC TIME fields — reverts on invalid, then refreshes energy.
function dcBlurTimeField(el, validateFn) {
  if (validateFn()) {
    el.dataset.lastValid = el.value;
  } else {
    el.value = el.dataset.lastValid ?? '';
    validateFn();
  }
  dcUpdateEnergyCard();
}

dcInputT.addEventListener('blur',    () => dcBlurTimeField(dcInputT,    validateDcT));
dcInputTmin.addEventListener('blur', () => dcBlurTimeField(dcInputTmin, validateDcTmin));
dcInputTmax.addEventListener('blur', () => dcBlurTimeField(dcInputTmax, validateDcTmax));

// ─────────────────────────────────────────────
// DC LOAD Cards — dynamic management and validation
// ─────────────────────────────────────────────

const DC_LOAD_MAX = 5;
let dcLoadCount = 0;
const dcLoadErrors       = [];
const dcLoadFieldUserSet = [];
const dcLoadContainer    = document.getElementById('dc-load-cards-container');

function showDcLoadError(i) {
  const el = document.getElementById(`dc-load-error-${i}`);
  if (el && dcLoadErrors[i]) {
    el.textContent = dcLoadErrors[i].L || dcLoadErrors[i].Lmin || dcLoadErrors[i].Lmax || '';
  }
}

function setDcLoadFieldState(i, inputEl, fieldKey, message, isError = false) {
  if (isError) {
    inputEl.classList.add('input-error');
    dcLoadErrors[i][fieldKey] = message;
  } else {
    inputEl.classList.remove('input-error');
    dcLoadErrors[i][fieldKey] = '';
  }
  showDcLoadError(i);
}

function validateDcL(i) {
  const el = document.getElementById(`dc-input-L${i}`);
  if (!el) return true;
  const raw = el.value.trim();
  if (raw === '') { setDcLoadFieldState(i, el, 'L', ''); return true; }
  const val = parseFloat(raw);
  if (isNaN(val) || val <= 0) {
    setDcLoadFieldState(i, el, 'L', 'Load must be a positive number', true); return false;
  }
  if (!isValidLoadPrecision(raw, val)) {
    setDcLoadFieldState(i, el, 'L', val > 20 ? 'Whole numbers only above 20 W' : 'Max 1 decimal place', true); return false;
  }
  setDcLoadFieldState(i, el, 'L', '');
  return true;
}

function validateDcLmin(i) {
  const el = document.getElementById(`dc-input-Lmin${i}`);
  if (!el) return true;
  const raw = el.value.trim();
  if (raw === '') { setDcLoadFieldState(i, el, 'Lmin', ''); return true; }
  const val = parseFloat(raw);
  if (isNaN(val) || val <= 0) {
    setDcLoadFieldState(i, el, 'Lmin', 'Min must be a positive number', true); return false;
  }
  if (!isValidLoadPrecision(raw, val)) {
    setDcLoadFieldState(i, el, 'Lmin', val > 20 ? 'Whole numbers only above 20 W' : 'Max 1 decimal place', true); return false;
  }
  const lEl  = document.getElementById(`dc-input-L${i}`);
  const lRaw = lEl ? lEl.value.trim() : '';
  if (lRaw !== '') {
    const lVal = parseFloat(lRaw);
    if (!isNaN(lVal) && val > lVal) {
      setDcLoadFieldState(i, el, 'Lmin', `Min must be ≤ Nominal (${lVal})`, true); return false;
    }
  }
  setDcLoadFieldState(i, el, 'Lmin', '');
  return true;
}

function validateDcLmax(i) {
  const el = document.getElementById(`dc-input-Lmax${i}`);
  if (!el) return true;
  const raw = el.value.trim();
  if (raw === '') { setDcLoadFieldState(i, el, 'Lmax', ''); return true; }
  const val = parseFloat(raw);
  if (isNaN(val) || val <= 0) {
    setDcLoadFieldState(i, el, 'Lmax', 'Max must be a positive number', true); return false;
  }
  if (!isValidLoadPrecision(raw, val)) {
    setDcLoadFieldState(i, el, 'Lmax', val > 20 ? 'Whole numbers only above 20 W' : 'Max 1 decimal place', true); return false;
  }
  const lEl  = document.getElementById(`dc-input-L${i}`);
  const lRaw = lEl ? lEl.value.trim() : '';
  if (lRaw !== '') {
    const lVal = parseFloat(lRaw);
    if (!isNaN(lVal) && val < lVal) {
      setDcLoadFieldState(i, el, 'Lmax', `Max must be ≥ Nominal (${lVal})`, true); return false;
    }
  }
  setDcLoadFieldState(i, el, 'Lmax', '');
  return true;
}

function dcTryAutoPopulateAll(i) {
  const us     = dcLoadFieldUserSet[i];
  const lEl    = document.getElementById(`dc-input-L${i}`);
  const lminEl = document.getElementById(`dc-input-Lmin${i}`);
  const lmaxEl = document.getElementById(`dc-input-Lmax${i}`);
  if (!lEl || !lminEl || !lmaxEl) return;

  const lVal    = (us.L    && lEl.value.trim()    !== '' && dcLoadErrors[i].L    === '')
                  ? parseFloat(lEl.value.trim())    : null;
  const lminVal = (us.Lmin && lminEl.value.trim() !== '' && dcLoadErrors[i].Lmin === '')
                  ? parseFloat(lminEl.value.trim()) : null;
  const lmaxVal = (us.Lmax && lmaxEl.value.trim() !== '' && dcLoadErrors[i].Lmax === '')
                  ? parseFloat(lmaxEl.value.trim()) : null;

  function fmtL(v) {
    if (v > 20) return String(Math.round(v));
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }

  function autoSet(el, fieldKey, val) {
    const fmt = fmtL(val);
    el.value = fmt;
    el.dataset.lastValid = fmt;
    el.classList.add('auto-populated');
    setDcLoadFieldState(i, el, fieldKey, '');
  }

  function autoClear(el, fieldKey) {
    if (el.classList.contains('auto-populated')) {
      el.value = '';
      el.dataset.lastValid = '';
      el.classList.remove('auto-populated');
      setDcLoadFieldState(i, el, fieldKey, '');
    }
  }

  if (!us.L) {
    if      (lminVal !== null && lmaxVal !== null) autoSet(lEl, 'L', (lminVal + lmaxVal) / 2);
    else if (lminVal !== null)                     autoSet(lEl, 'L', lminVal);
    else if (lmaxVal !== null)                     autoSet(lEl, 'L', lmaxVal);
    else                                           autoClear(lEl, 'L');
  }
  if (!us.Lmin) {
    if      (lVal    !== null) autoSet(lminEl, 'Lmin', lVal);
    else if (lmaxVal !== null) autoSet(lminEl, 'Lmin', lmaxVal);
    else                       autoClear(lminEl, 'Lmin');
  }
  if (!us.Lmax) {
    if      (lVal    !== null) autoSet(lmaxEl, 'Lmax', lVal);
    else if (lminVal !== null) autoSet(lmaxEl, 'Lmax', lminVal);
    else                       autoClear(lmaxEl, 'Lmax');
  }
}

function dcUpdateLoadControls() {
  for (let i = 0; i < DC_LOAD_MAX; i++) {
    const minBtn = document.getElementById(`dc-load-minus-${i}`);
    const plusBtn = document.getElementById(`dc-load-plus-${i}`);
    if (!minBtn || !plusBtn) continue;
    const isLast = (i === dcLoadCount - 1);
    minBtn.style.visibility  = (isLast && dcLoadCount > 1)          ? '' : 'hidden';
    plusBtn.style.visibility = (isLast && dcLoadCount < DC_LOAD_MAX) ? '' : 'hidden';
  }
}

function dcUpdateDcTotalRow() {
  ['L', 'Lmin', 'Lmax'].forEach(field => {
    let sum = 0, hasAny = false;
    for (let i = 0; i < dcLoadCount; i++) {
      const el  = document.getElementById(`dc-input-${field}${i}`);
      if (!el) continue;
      const raw = el.value.trim();
      if (raw === '') continue;
      const val = parseFloat(raw);
      if (isNaN(val)) continue;
      sum += val;
      hasAny = true;
    }
    const summaryEl = document.getElementById(`dc-ls-${field}`);
    if (!summaryEl) return;
    if (hasAny) {
      const rounded = Math.round(sum * 10) / 10;
      summaryEl.textContent = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    } else {
      summaryEl.textContent = '—';
    }
  });
  dcUpdateEnergyCard();
}

function dcAttachLoadListeners(i) {
  const lEl    = document.getElementById(`dc-input-L${i}`);
  const lminEl = document.getElementById(`dc-input-Lmin${i}`);
  const lmaxEl = document.getElementById(`dc-input-Lmax${i}`);
  const minBtn = document.getElementById(`dc-load-minus-${i}`);
  const plusBtn = document.getElementById(`dc-load-plus-${i}`);
  const us = dcLoadFieldUserSet[i];

  lEl.addEventListener('input', () => {
    if (lEl.value.trim() !== '') { us.L = true; lEl.classList.remove('auto-populated'); }
    else us.L = false;
  });
  lEl.addEventListener('blur', () => {
    if (validateDcL(i)) {
      lEl.dataset.lastValid = lEl.value;
      if (lEl.value.trim() === '') us.L = false;
    } else {
      lEl.value = lEl.dataset.lastValid ?? '';
      if (lEl.value.trim() === '') us.L = false;
      validateDcL(i);
    }
    dcTryAutoPopulateAll(i);
    dcUpdateDcTotalRow();
  });

  lminEl.addEventListener('input', () => {
    if (lminEl.value.trim() !== '') { us.Lmin = true; lminEl.classList.remove('auto-populated'); }
    else us.Lmin = false;
  });
  lminEl.addEventListener('blur', () => {
    if (validateDcLmin(i)) {
      lminEl.dataset.lastValid = lminEl.value;
      if (lminEl.value.trim() === '') us.Lmin = false;
    } else {
      lminEl.value = lminEl.dataset.lastValid ?? '';
      if (lminEl.value.trim() === '') us.Lmin = false;
      validateDcLmin(i);
    }
    dcTryAutoPopulateAll(i);
    dcUpdateDcTotalRow();
  });

  lmaxEl.addEventListener('input', () => {
    if (lmaxEl.value.trim() !== '') { us.Lmax = true; lmaxEl.classList.remove('auto-populated'); }
    else us.Lmax = false;
  });
  lmaxEl.addEventListener('blur', () => {
    if (validateDcLmax(i)) {
      lmaxEl.dataset.lastValid = lmaxEl.value;
      if (lmaxEl.value.trim() === '') us.Lmax = false;
    } else {
      lmaxEl.value = lmaxEl.dataset.lastValid ?? '';
      if (lmaxEl.value.trim() === '') us.Lmax = false;
      validateDcLmax(i);
    }
    dcTryAutoPopulateAll(i);
    dcUpdateDcTotalRow();
  });

  if (minBtn)  minBtn.addEventListener('click',  dcRemoveLastLoadCard);
  if (plusBtn) plusBtn.addEventListener('click', dcAddLoadCard);
}

function dcAddLoadCard() {
  if (dcLoadCount >= DC_LOAD_MAX) return;
  const i = dcLoadCount;
  dcLoadErrors[i]       = { L: '', Lmin: '', Lmax: '' };
  dcLoadFieldUserSet[i] = { L: false, Lmin: false, Lmax: false };

  const card = document.createElement('div');
  card.className = 'card load-card load-x-card';
  card.id = `dc-load-card-${i}`;
  card.innerHTML = `
    <h2>L${i}</h2>
    <div class="load-content">
      <div class="load-row">
        <div class="load-field load-field-nominal">
          <label class="load-label" for="dc-input-L${i}">Nominal</label>
          <div class="load-input-row">
            <input class="field-input load-input" type="text"
                   id="dc-input-L${i}" inputmode="decimal" step="0.1">
            <span class="load-unit">W</span>
          </div>
        </div>
        <div class="load-minmax-group">
          <div class="load-field">
            <label class="load-label" for="dc-input-Lmin${i}">Min</label>
            <div class="load-input-row">
              <input class="field-input load-input" type="text"
                     id="dc-input-Lmin${i}" inputmode="decimal" step="0.1">
              <span class="load-unit">W</span>
            </div>
          </div>
          <div class="load-field">
            <label class="load-label" for="dc-input-Lmax${i}">Max</label>
            <div class="load-input-row">
              <input class="field-input load-input" type="text"
                     id="dc-input-Lmax${i}" inputmode="decimal" step="0.1">
              <span class="load-unit unit-max">W</span>
            </div>
          </div>
        </div>
      </div>
      <p class="load-error" id="dc-load-error-${i}"></p>
    </div>
    <div class="load-controls" id="dc-load-controls-${i}">
      <button class="load-btn load-btn-minus" id="dc-load-minus-${i}" aria-label="Remove load card">−</button>
      <button class="load-btn load-btn-plus"  id="dc-load-plus-${i}"  aria-label="Add load card">+</button>
    </div>
  `;

  dcLoadContainer.appendChild(card);
  dcLoadCount++;
  dcAttachLoadListeners(i);
  dcUpdateLoadControls();
  dcUpdateDcTotalRow();
}

function dcRemoveLastLoadCard() {
  if (dcLoadCount <= 1) return;
  dcLoadCount--;
  const card = document.getElementById(`dc-load-card-${dcLoadCount}`);
  if (card) dcLoadContainer.removeChild(card);
  dcLoadErrors.splice(dcLoadCount, 1);
  dcLoadFieldUserSet.splice(dcLoadCount, 1);
  dcUpdateLoadControls();
  dcUpdateDcTotalRow();
}

// ─────────────────────────────────────────────
// DC energy computation and display (v1.2 E=f(T,L) path)
// ─────────────────────────────────────────────

// Compute {E, Emax} from TIME (T) and LOAD (L, Lmax).
// E    = L × T / 60           (nominal required energy, Wh)
// Emax = Lmax × T / 60        (v1.2: energy requirement under max load condition, Wh)
// Returns {E: NaN, Emax: NaN} when T or L are not yet entered.
function dcComputeEnergyValues() {
  const T   = parseFloat(dcInputT.value.trim());
  const lsL = document.getElementById('dc-ls-L').textContent.trim();
  const L   = parseFloat(lsL);
  if (isNaN(T) || T <= 0 || isNaN(L) || L <= 0) return { E: NaN, Emax: NaN };

  const lsLmax = document.getElementById('dc-ls-Lmax').textContent.trim();
  const LmaxV  = parseFloat(lsLmax);
  const Lmax   = (lsLmax !== '—' && !isNaN(LmaxV) && LmaxV > 0) ? LmaxV : L;

  const rd2  = v => Math.round(v * 100) / 100;
  const E    = rd2(L * T / 60);
  const Emax = rd2(Lmax * T / 60);   // v1.2: Emax = Lmax × T
  return { E, Emax };
}

// Render the dc-energy-card.  Also reveals dc-resolve-card and calls dcUpdateResolveCard.
// Called on any TIME or LOAD change.
function dcUpdateEnergyCard() {
  const energyCard  = document.getElementById('dc-energy-card');
  const resolveCard = document.getElementById('dc-resolve-card');
  const wrap        = document.getElementById('dc-energy-wrap');

  const { E, Emax } = dcComputeEnergyValues();
  dcComputedE    = E;
  dcComputedEmax = Emax;

  if (isNaN(E)) {
    energyCard.style.display  = 'none';
    resolveCard.style.display = 'none';
    return;
  }

  energyCard.style.display  = '';
  resolveCard.style.display = '';

  const showEmax = Math.abs(Emax - E) > 0.005;
  let html = '<div class="rpt-heading">Required Energy</div>';
  html += '<table class="rpt-table"><tbody>';
  if (showEmax) {
    html += '<tr class="rpt-col-hdr">'
          + '<td class="rpt-td-lbl"></td>'
          + '<td class="rpt-td-num">Nom</td>'
          + '<td class="rpt-td-num">Max</td>'
          + '<td class="rpt-td-unit"></td></tr>';
    html += '<tr class="rpt-time-row">'
          + '<td class="rpt-td-lbl">Energy</td>'
          + `<td class="rpt-td-num">${E}</td>`
          + `<td class="rpt-td-num">${Emax}</td>`
          + '<td class="rpt-td-unit">Wh</td></tr>';
  } else {
    html += '<tr class="rpt-time-row">'
          + '<td class="rpt-td-lbl">Energy</td>'
          + `<td class="rpt-td-num">${E}</td>`
          + '<td class="rpt-td-num"></td>'
          + '<td class="rpt-td-unit">Wh</td></tr>';
  }
  html += '</tbody></table>';
  wrap.innerHTML = html;

  // ── Debug panel update (DfCost energy values) ──
  dbg.T    = dcInputT.value.trim();
  dbg.Tmin = '—';
  dbg.Tmax = dcInputTmax.value.trim();
  dbg.L    = document.getElementById('dc-ls-L').textContent.trim();
  dbg.Lmin = '—';
  dbg.Lmax = document.getElementById('dc-ls-Lmax').textContent.trim();
  dbg.E    = isNaN(E)    ? '—' : String(E);
  dbg.Emin = '—';
  dbg.Emax = isNaN(Emax) ? '—' : String(Emax);
  refreshDebug();

  dcUpdateResolveCard();
}

// Render the pack sizing result inside dc-resolve-card.
// If N is given → compute required cell capacity C = E × 1000 / (N × 3.6).
// If C is given (and N empty/invalid) → compute minimum cell count N = ⌈E × 1000 / (3.6 × C)⌉.
// Shows both nominal (E) and max-load (Emax) results when they differ.
function dcUpdateResolveCard() {
  const wrap = document.getElementById('dc-resolve-wrap');
  if (!wrap) return;

  const E    = dcComputedE;
  const Emax = dcComputedEmax;
  if (isNaN(E)) { wrap.innerHTML = ''; return; }

  const N   = parseInt(dcInputN.value.trim(), 10);
  const C   = parseFloat(dcInputC.value.trim());
  const nOk = dcPackErrors.N === '' && Number.isInteger(N) && N >= 1 && N <= 8;
  const cOk = dcPackErrors.C === '' && !isNaN(C) && C >= 100 && C <= 8000;

  if (!nOk && !cOk) { wrap.innerHTML = ''; return; }

  const rd0      = v => Math.round(v);
  const showEmax = Math.abs(Emax - E) > 0.005;
  let html = '<table class="rpt-table"><tbody>';

  if (nOk) {
    // User provided N → compute required cell capacity
    const C_nom = rd0(E    * 1000 / (N * 3.6));
    const C_max = rd0(Emax * 1000 / (N * 3.6));
    if (showEmax) {
      html += '<tr class="rpt-col-hdr">'
            + '<td class="rpt-td-lbl"></td>'
            + '<td class="rpt-td-num">Nom</td>'
            + '<td class="rpt-td-num">Max</td>'
            + '<td class="rpt-td-unit"></td></tr>';
      html += '<tr class="rpt-time-row">'
            + '<td class="rpt-td-lbl">Cell Cap</td>'
            + `<td class="rpt-td-num">${C_nom}</td>`
            + `<td class="rpt-td-num">${C_max}</td>`
            + '<td class="rpt-td-unit">mAh</td></tr>';
    } else {
      html += '<tr class="rpt-time-row">'
            + '<td class="rpt-td-lbl">Cell Cap</td>'
            + `<td class="rpt-td-num">${C_nom}</td>`
            + '<td class="rpt-td-num"></td>'
            + '<td class="rpt-td-unit">mAh</td></tr>';
    }
  } else {
    // User provided C → compute required cell count (rounded up)
    const N_nom = Math.ceil(E    * 1000 / (3.6 * C));
    const N_max = Math.ceil(Emax * 1000 / (3.6 * C));
    if (showEmax) {
      html += '<tr class="rpt-col-hdr">'
            + '<td class="rpt-td-lbl"></td>'
            + '<td class="rpt-td-num">Nom</td>'
            + '<td class="rpt-td-num">Max</td>'
            + '<td class="rpt-td-unit"></td></tr>';
      html += '<tr class="rpt-time-row">'
            + '<td class="rpt-td-lbl">Cells</td>'
            + `<td class="rpt-td-num">${N_nom}</td>`
            + `<td class="rpt-td-num">${N_max}</td>`
            + '<td class="rpt-td-unit"></td></tr>';
    } else {
      html += '<tr class="rpt-time-row">'
            + '<td class="rpt-td-lbl">Cells</td>'
            + `<td class="rpt-td-num">${N_nom}</td>`
            + '<td class="rpt-td-num"></td>'
            + '<td class="rpt-td-unit"></td></tr>';
    }
  }
  html += '</tbody></table>';
  wrap.innerHTML = html;

  // ── Debug panel update (DfCost N/C resolve) ──
  dbg.C    = dcInputC.value.trim();
  dbg.Cmin = '—';
  dbg.Cmax = '—';
  if (nOk) {
    dbg.N  = String(N);
    dbg.NN = '—';
  } else if (cOk) {
    const nnRawDc = dcComputedE * 1000 / (3.6 * C);
    dbg.N  = String(Math.ceil(nnRawDc));
    dbg.NN = String(Math.round(nnRawDc * 100) / 100);
  } else {
    dbg.N  = '—';
    dbg.NN = '—';
  }
  refreshDebug();
}

// ─────────────────────────────────────────────
// DC page reset — called from resetPage('page-cost')
// ─────────────────────────────────────────────
function dcResetPage() {
  dbgClear(); refreshDebug();   // clear debug panel on DfCost reset
  // Reset stored energy values
  dcComputedE    = NaN;
  dcComputedEmax = NaN;

  // Hide result cards; clear their content
  const energyCard  = document.getElementById('dc-energy-card');
  const resolveCard = document.getElementById('dc-resolve-card');
  if (energyCard)  energyCard.style.display  = 'none';
  if (resolveCard) resolveCard.style.display = 'none';
  const energyWrap  = document.getElementById('dc-energy-wrap');
  const resolveWrap = document.getElementById('dc-resolve-wrap');
  if (energyWrap)  energyWrap.innerHTML  = '';
  if (resolveWrap) resolveWrap.innerHTML = '';

  // Reset resolve PACK inputs (N and C)
  dcInputN.value = ''; dcInputN.dataset.lastValid = '';
  setDcFieldState(dcInputN, 'N', '');
  dcInputC.value = ''; dcInputC.dataset.lastValid = '';
  setDcFieldState(dcInputC, 'C', '');

  // Reset TIME
  [dcInputT, dcInputTmin, dcInputTmax].forEach(el => {
    el.value = '';
    el.dataset.lastValid = '';
    el.classList.remove('input-error');
  });
  dcTimeErrors.T = ''; dcTimeErrors.Tmin = ''; dcTimeErrors.Tmax = '';
  dcTimeErrorEl.textContent = '';

  // Reset LOAD cards — remove all and re-create a fresh L(0)
  while (dcLoadCount > 0) {
    dcLoadCount--;
    const card = document.getElementById(`dc-load-card-${dcLoadCount}`);
    if (card) dcLoadContainer.removeChild(card);
  }
  dcLoadErrors.length       = 0;
  dcLoadFieldUserSet.length = 0;
  dcAddLoadCard();   // adds fresh L(0) and resets summary totals
}

// ── Initialise DfCost: create initial L(0) card (energy/resolve cards start hidden via HTML) ──
dcAddLoadCard();

// ─────────────────────────────────────────────
// DfTime page — dt-prefixed IDs; independent state
// Initial display: TIME card only.
// After first valid T entry: PACK card + LOAD group revealed.
// ─────────────────────────────────────────────

// Flag: true once PACK + LOAD have been revealed
let dtPackLoadVisible = false;

// Mode lock: null until first valid entry after reveal.
// 'time' → hide LOAD group; path is L=f(E,T)
// 'load' → PACK stays visible for N/C resolve; path is E=f(T,L)
let dtMode = null;

// Called from inputT blur listener when T has a valid non-empty value
function dtRevealPackAndLoad() {
  if (dtPackLoadVisible) return;
  dtPackLoadVisible = true;
  document.getElementById('dt-pack-card').style.display  = '';
  document.getElementById('dt-load-group').style.display = '';
}

// Called when the user makes a valid entry in PACK card (Path A) or Lx card (Path B).
// Locks the mode on first call; subsequent calls are ignored.
function dtSetMode(mode) {
  if (dtMode !== null) return;          // already locked — ignore
  dtMode = mode;
  if (mode === 'time') {
    document.getElementById('dt-load-group').style.display = 'none';
  }
  // Path B ('load'): PACK card stays visible — user enters N or C to resolve E
  dtUpdateResult();
}

// Compute and display the result for the locked path.
// L=f(E,T) mode (time): given E (PACK) + T (TIME card) → compute L
// E=f(T,L) mode (load): given T (TIME card) + L (Lx summary) → compute E, then resolve N or C
function dtUpdateResult() {
  const el = document.getElementById('dt-output-card');
  if (dtMode === null) { el.style.display = 'none'; return; }
  el.style.display = '';

  const rd1 = v => Math.round(v * 10) / 10;

  // PACK values — needed for E in both paths (card may be hidden but values remain)
  const n = parseInt(dtInputN.value.trim(), 10);
  const c = parseFloat(dtInputC.value.trim());
  const packValid = Number.isInteger(n) && n >= 1 && n <= 8
                 && !isNaN(c)           && c >= 100 && c <= 8000;

  if (dtMode === 'time') {
    // ── L=f(E,T): given E (PACK) and T → solve L  (v1.2: L = E/T; Lmin = N/A; Lmax = Emin/Tmax) ──
    if (!packValid) { el.textContent = 'Enter N and C to compute load'; return; }
    const tNom = parseFloat(inputT.value.trim());
    if (isNaN(tNom) || tNom <= 0) { el.textContent = 'Enter run time to compute load'; return; }

    const Enom = n * 3.6 * c / 1000;
    const L    = rd1(Enom * 60 / tNom);

    // Emin: use Cmin if present and valid; else fall back to Enom
    const cminV = parseFloat(dtInputCmin.value.trim());
    const Emin  = (dtPackErrors.Cmin === '' && !isNaN(cminV) && cminV > 0)
                  ? n * 3.6 * cminV / 1000 : Enom;

    // Tmax: use inputTmax if present and valid (it's the auto-computed read-only field)
    const tmaxRaw = inputTmax.value.trim();
    const tmaxV   = parseFloat(tmaxRaw);
    const Tmax    = (tmaxRaw !== '' && tmaxRaw !== '—' && !isNaN(tmaxV) && tmaxV > tNom)
                    ? tmaxV : tNom;

    // v1.2: Lmax = Emin / Tmax × 60  (only show if < L; Lmin = N/A)
    const Lmax    = rd1(Emin * 60 / Tmax);
    const lmaxStr = Lmax < L ? String(Lmax) : '';

    // Render REPORT LOAD card — "To Meet Run Time" template
    function escH(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function fv(raw) { return escH(typeof raw === 'string' ? raw.trim() : String(raw)); }

    const N_str    = dtInputN.value.trim();
    const C_str    = dtInputC.value.trim();
    const Cmin_str = dtInputCmin.value.trim();
    const Cmax_str = dtInputCmax.value.trim();
    const T_str    = inputT.value.trim();
    const Tmin_str = inputTmin.value.trim();
    const Tmax_str = inputTmax.value.trim();

    el.style.backgroundColor = '#FFF3F3';  // match LOAD card background colour
    el.innerHTML = `
      <div class="rpt-heading">To Meet Run Time</div>
      <table class="rpt-table">
        <tbody>
          <tr>
            <td class="rpt-td-lbl">Run Time</td>
            <td class="rpt-td-num">${fv(fmtTime(T_str))}</td>
            <td class="rpt-td-num">${fv(fmtTime(Tmin_str))}</td>
            <td class="rpt-td-num">${fv(fmtTime(Tmax_str))}</td>
            <td class="rpt-td-unit">Min</td>
          </tr>
          <tr>
            <td class="rpt-td-lbl">Cells</td>
            <td class="rpt-td-num">${N_str !== '' ? fv(N_str) : '—'}</td>
            <td class="rpt-td-num"></td>
            <td class="rpt-td-num"></td>
            <td class="rpt-td-unit"></td>
          </tr>
          <tr>
            <td class="rpt-td-lbl">Cell Cap</td>
            <td class="rpt-td-num">${fv(fmtCap(C_str))}</td>
            <td class="rpt-td-num">${fv(fmtCap(Cmin_str))}</td>
            <td class="rpt-td-num">${fv(fmtCap(Cmax_str))}</td>
            <td class="rpt-td-unit">mAh</td>
          </tr>
          <tr class="rpt-gap"><td colspan="5"></td></tr>
          <tr class="rpt-col-hdr">
            <td class="rpt-td-lbl"></td>
            <td class="rpt-td-num">Nom</td>
            <td class="rpt-td-num">Min</td>
            <td class="rpt-td-num">Max</td>
            <td class="rpt-td-unit"></td>
          </tr>
          <tr class="rpt-time-row">
            <td class="rpt-td-lbl">Load Allowed</td>
            <td class="rpt-td-num">${fv(fmtLoad(String(L)))}</td>
            <td class="rpt-td-num">${fv(fmtLoad(''))}</td>
            <td class="rpt-td-num">${fv(fmtLoad(lmaxStr))}</td>
            <td class="rpt-td-unit">W</td>
          </tr>
        </tbody>
      </table>`;

    // ── Debug panel update (DfTime L=f(E,T)) ──
    const rd2dt = x => Math.round(x * 100) / 100;
    const cminDbg = parseFloat(dtInputCmin.value.trim());
    const cmaxDbg = parseFloat(dtInputCmax.value.trim());
    dbg.T    = T_str;  dbg.Tmin = Tmin_str; dbg.Tmax = Tmax_str;
    dbg.L    = String(L); dbg.Lmin = '—'; dbg.Lmax = lmaxStr !== '' ? lmaxStr : '—';
    dbg.E    = String(rd2dt(Enom));
    dbg.Emin = (dtPackErrors.Cmin === '' && !isNaN(cminDbg) && cminDbg > 0)
               ? String(rd2dt(n * 3.6 * cminDbg / 1000)) : '—';
    dbg.Emax = (dtPackErrors.Cmax === '' && !isNaN(cmaxDbg) && cmaxDbg > 0)
               ? String(rd2dt(n * 3.6 * cmaxDbg / 1000)) : '—';
    dbg.C    = C_str; dbg.Cmin = Cmin_str; dbg.Cmax = Cmax_str;
    dbg.N    = N_str; dbg.NN   = '—';
    refreshDebug();

  } else {
    // ── E=f(T,L): given T (TIME card) and L (Lx summary) → solve E; resolve N or C to meet E ──
    el.style.backgroundColor = '';   // PACK card colour (default via var(--color-card))

    const lsL    = document.getElementById('dt-ls-L').textContent.trim();
    const lsLmax = document.getElementById('dt-ls-Lmax').textContent.trim();

    const l = parseFloat(lsL);
    if (isNaN(l) || l <= 0) { el.textContent = 'Enter load to compute energy'; return; }

    const tNom = parseFloat(inputT.value.trim());
    if (isNaN(tNom) || tNom <= 0) { el.textContent = 'Enter run time to compute energy'; return; }

    const rd2  = v => Math.round(v * 100) / 100;
    const E    = rd2(l * tNom / 60);

    // v1.2: Emax = Lmax × T / 60  (energy requirement under max load condition)
    const lmaxV   = parseFloat(lsLmax);
    const Lmax    = (lsLmax !== '—' && !isNaN(lmaxV) && lmaxV > 0) ? lmaxV : l;
    const Emax    = rd2(Lmax * tNom / 60);

    // N / C resolve — check current input values
    const nV  = parseInt(dtInputN.value.trim(), 10);
    const nOk = Number.isInteger(nV) && nV >= 1 && nV <= 8 && dtPackErrors.N === '';
    // C: only "user-entered" when the input is not disabled
    const cRawB  = dtInputC.value.trim();
    const cV     = parseFloat(cRawB);
    const cOkUser = !dtInputC.disabled && !isNaN(cV) && cV >= 100 && cV <= 8000 && dtPackErrors.C === '';

    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const emaxRow = Emax > E
      ? `<tr><td class="rpt-td-lbl">Max Energy</td><td class="rpt-td-num">${esc(String(Emax))}</td><td></td><td></td><td class="rpt-td-unit">Wh</td></tr>`
      : '';

    // ── Debug common values for E=f(T,L) path ──
    const dbgSetEfTL = (NVal, CVal, NNVal) => {
      dbg.T    = inputT.value.trim();
      dbg.Tmin = inputTmin.value.trim(); dbg.Tmax = inputTmax.value.trim();
      dbg.L    = lsL; dbg.Lmin = document.getElementById('dt-ls-Lmin').textContent.trim();
      dbg.Lmax = lsLmax;
      dbg.E    = String(E); dbg.Emin = '—'; dbg.Emax = String(Emax);
      dbg.C    = CVal !== undefined ? String(CVal) : dtInputC.value.trim();
      dbg.Cmin = dtInputCmin.value.trim(); dbg.Cmax = dtInputCmax.value.trim();
      dbg.N    = NVal !== undefined ? String(NVal) : dtInputN.value.trim();
      dbg.NN   = NNVal !== undefined ? String(Math.round(NNVal * 100) / 100) : '—';
      refreshDebug();
    };

    if (nOk) {
      // N given → compute C = E × 1000 / (N × 3.6)
      const computedC = Math.round(E * 1000 / (nV * 3.6));
      dtInputC.disabled = true;
      dtInputC.value    = String(computedC);

      el.innerHTML = `
        <div class="rpt-heading">Pack Solution</div>
        <table class="rpt-table"><tbody>
          <tr><td class="rpt-td-lbl">Energy</td><td class="rpt-td-num">${esc(String(E))}</td><td></td><td></td><td class="rpt-td-unit">Wh</td></tr>
          ${emaxRow}
          <tr class="rpt-gap"><td colspan="5"></td></tr>
          <tr><td class="rpt-td-lbl">Cells</td><td class="rpt-td-num">${esc(String(nV))}</td><td></td><td></td><td class="rpt-td-unit"></td></tr>
          <tr><td class="rpt-td-lbl">Cell Cap</td><td class="rpt-td-num">${esc(String(computedC))}</td><td colspan="2" class="rpt-computed-note">computed</td><td class="rpt-td-unit">mAh</td></tr>
        </tbody></table>`;
      dbgSetEfTL(nV, computedC, undefined);

    } else if (cOkUser) {
      // C given (user-entered, not disabled) → compute N = ⌈E × 1000 / (3.6 × C)⌉
      const nnRaw    = E * 1000 / (3.6 * cV);
      const computedN = Math.ceil(nnRaw);
      dtInputN.disabled = true;
      dtInputN.value    = String(computedN);

      el.innerHTML = `
        <div class="rpt-heading">Pack Solution</div>
        <table class="rpt-table"><tbody>
          <tr><td class="rpt-td-lbl">Energy</td><td class="rpt-td-num">${esc(String(E))}</td><td></td><td></td><td class="rpt-td-unit">Wh</td></tr>
          ${emaxRow}
          <tr class="rpt-gap"><td colspan="5"></td></tr>
          <tr><td class="rpt-td-lbl">Cells</td><td class="rpt-td-num">${esc(String(computedN))}</td><td colspan="2" class="rpt-computed-note">computed</td><td class="rpt-td-unit"></td></tr>
          <tr><td class="rpt-td-lbl">Cell Cap</td><td class="rpt-td-num">${esc(String(cV))}</td><td></td><td></td><td class="rpt-td-unit">mAh</td></tr>
        </tbody></table>`;
      dbgSetEfTL(computedN, cV, nnRaw);

    } else {
      // Neither N nor C entered yet — show E and prompt
      dtInputN.disabled = false;
      dtInputC.disabled = false;
      el.textContent = `Energy: ${E} Wh${Emax > E ? ' (max ' + Emax + ' Wh)' : ''} — enter N or C in PACK above`;
      dbgSetEfTL(undefined, undefined, undefined);
    }
  }
}

// ── DT PACK elements and state ──
const dtInputN    = document.getElementById('dt-input-N');
const dtInputC    = document.getElementById('dt-input-C');
const dtInputCmin = document.getElementById('dt-input-Cmin');
const dtInputCmax = document.getElementById('dt-input-Cmax');
const dtPackErrorEl = document.getElementById('dt-pack-error');
const dtPackErrors = { N: '', C: '', Cmin: '', Cmax: '' };
const dtPackFieldUserSet = { Cmin: false, Cmax: false };

function showDtPackError() {
  dtPackErrorEl.textContent =
    dtPackErrors.N || dtPackErrors.C || dtPackErrors.Cmin || dtPackErrors.Cmax || '';
}

function setDtFieldState(inputEl, fieldKey, message, isError = false) {
  if (isError) {
    inputEl.classList.add('input-error');
    dtPackErrors[fieldKey] = message;
  } else {
    inputEl.classList.remove('input-error');
    dtPackErrors[fieldKey] = '';
  }
  showDtPackError();
}

function tryAutoPopulateDtPack() {
  const cRaw   = dtInputC.value.trim();
  const cValid = cRaw !== '' && dtPackErrors.C === '';

  function autoSet(el, fieldKey) {
    el.value = cRaw;
    el.dataset.lastValid = cRaw;
    el.classList.add('auto-populated');
    setDtFieldState(el, fieldKey, '');
  }

  function autoClear(el, fieldKey) {
    if (el.classList.contains('auto-populated')) {
      el.value = '';
      el.dataset.lastValid = '';
      el.classList.remove('auto-populated');
      setDtFieldState(el, fieldKey, '');
    }
  }

  if (!dtPackFieldUserSet.Cmin) {
    if (cValid) autoSet(dtInputCmin, 'Cmin');
    else        autoClear(dtInputCmin, 'Cmin');
  }
  if (!dtPackFieldUserSet.Cmax) {
    if (cValid) autoSet(dtInputCmax, 'Cmax');
    else        autoClear(dtInputCmax, 'Cmax');
  }
}

function validateDtN() {
  const raw = dtInputN.value.trim();
  if (raw === '') { setDtFieldState(dtInputN, 'N', ''); return true; }
  const val = Number(raw);
  if (!Number.isInteger(val)) {
    setDtFieldState(dtInputN, 'N', 'Cells must be a whole number', true); return false;
  }
  if (val < 1 || val > 8) {
    setDtFieldState(dtInputN, 'N', 'Cells must be 1 – 8', true); return false;
  }
  setDtFieldState(dtInputN, 'N', '');
  return true;
}

function validateDtC() {
  const raw = dtInputC.value.trim();
  if (raw === '') {
    setDtFieldState(dtInputC, 'C', '');
    validateDtCmin(); validateDtCmax();
    return true;
  }
  const val = Number(raw);
  if (isNaN(val) || !Number.isInteger(val)) {
    setDtFieldState(dtInputC, 'C', 'Nominal must be a whole number', true);
    validateDtCmin(); validateDtCmax();
    return false;
  }
  if (val < 100 || val > 8000) {
    setDtFieldState(dtInputC, 'C', 'Nominal must be 100 – 8000 mAh', true);
    validateDtCmin(); validateDtCmax();
    return false;
  }
  setDtFieldState(dtInputC, 'C', '');
  validateDtCmin(); validateDtCmax();
  return true;
}

function validateDtCmin() {
  const raw = dtInputCmin.value.trim();
  if (raw === '') { setDtFieldState(dtInputCmin, 'Cmin', ''); return true; }
  const val = Number(raw);
  if (isNaN(val) || !Number.isInteger(val)) {
    setDtFieldState(dtInputCmin, 'Cmin', 'Min must be a whole number', true); return false;
  }
  const cRaw = dtInputC.value.trim();
  if (cRaw !== '') {
    const cVal = Number(cRaw);
    if (Number.isInteger(cVal) && cVal >= 100 && cVal <= 8000) {
      const cminFloor = Math.ceil(cVal * 0.5);
      if (val < cminFloor) {
        setDtFieldState(dtInputCmin, 'Cmin', `Min must be ≥ ${cminFloor} mAh`, true); return false;
      }
      if (val > cVal) {
        setDtFieldState(dtInputCmin, 'Cmin', `Min must be ≤ ${cVal} mAh (≤ Nominal)`, true); return false;
      }
    }
  }
  setDtFieldState(dtInputCmin, 'Cmin', '');
  return true;
}

function validateDtCmax() {
  const raw = dtInputCmax.value.trim();
  if (raw === '') { setDtFieldState(dtInputCmax, 'Cmax', ''); return true; }
  const val = Number(raw);
  if (isNaN(val) || !Number.isInteger(val)) {
    setDtFieldState(dtInputCmax, 'Cmax', 'Max must be a whole number', true); return false;
  }
  const cRaw = dtInputC.value.trim();
  if (cRaw !== '') {
    const cVal = Number(cRaw);
    if (Number.isInteger(cVal) && cVal >= 100 && cVal <= 8000) {
      const cmaxCeil = Math.floor(cVal * 1.15);
      if (val > cmaxCeil) {
        setDtFieldState(dtInputCmax, 'Cmax', `Max must be ≤ ${cmaxCeil} mAh`, true); return false;
      }
      if (val < cVal) {
        setDtFieldState(dtInputCmax, 'Cmax', `Max must be ≥ ${cVal} mAh (≥ Nominal)`, true); return false;
      }
    }
  }
  setDtFieldState(dtInputCmax, 'Cmax', '');
  return true;
}

// Seed lastValid from defaults
dtInputN.dataset.lastValid    = dtInputN.value;
dtInputC.dataset.lastValid    = dtInputC.value;
dtInputCmin.dataset.lastValid = dtInputCmin.value;
dtInputCmax.dataset.lastValid = dtInputCmax.value;

dtInputN.addEventListener('blur', () => {
  blurValidate(dtInputN, validateDtN);
  if (!dtPackLoadVisible) return;
  if (dtInputN.value.trim() !== '') dtSetMode('time');   // lock Path A (no-op if already locked)
  if (dtMode !== null) dtUpdateResult();
});

dtInputC.addEventListener('blur', () => {
  blurValidate(dtInputC, validateDtC);
  tryAutoPopulateDtPack();
  if (!dtPackLoadVisible) return;
  if (dtInputC.value.trim() !== '') dtSetMode('time');
  if (dtMode !== null) dtUpdateResult();
});

dtInputCmin.addEventListener('input', () => {
  if (dtInputCmin.value.trim() !== '') {
    dtPackFieldUserSet.Cmin = true;
    dtInputCmin.classList.remove('auto-populated');
  } else {
    dtPackFieldUserSet.Cmin = false;
  }
});
dtInputCmin.addEventListener('blur', () => {
  if (validateDtCmin()) {
    dtInputCmin.dataset.lastValid = dtInputCmin.value;
    if (dtInputCmin.value.trim() === '') dtPackFieldUserSet.Cmin = false;
  } else {
    dtInputCmin.value = dtInputCmin.dataset.lastValid ?? '';
    if (dtInputCmin.value.trim() === '') dtPackFieldUserSet.Cmin = false;
    validateDtCmin();
  }
  tryAutoPopulateDtPack();
  if (!dtPackLoadVisible) return;
  if (dtInputCmin.value.trim() !== '') dtSetMode('time');
  if (dtMode !== null) dtUpdateResult();
});

dtInputCmax.addEventListener('input', () => {
  if (dtInputCmax.value.trim() !== '') {
    dtPackFieldUserSet.Cmax = true;
    dtInputCmax.classList.remove('auto-populated');
  } else {
    dtPackFieldUserSet.Cmax = false;
  }
});
dtInputCmax.addEventListener('blur', () => {
  if (validateDtCmax()) {
    dtInputCmax.dataset.lastValid = dtInputCmax.value;
    if (dtInputCmax.value.trim() === '') dtPackFieldUserSet.Cmax = false;
  } else {
    dtInputCmax.value = dtInputCmax.dataset.lastValid ?? '';
    if (dtInputCmax.value.trim() === '') dtPackFieldUserSet.Cmax = false;
    validateDtCmax();
  }
  tryAutoPopulateDtPack();
  if (!dtPackLoadVisible) return;
  if (dtInputCmax.value.trim() !== '') dtSetMode('time');
  if (dtMode !== null) dtUpdateResult();
});

// Initial auto-populate — seeds Cmin/Cmax from the default C value (2000 mAh)
tryAutoPopulateDtPack();

// ─────────────────────────────────────────────
// DT LOAD Cards — dynamic management and validation
// ─────────────────────────────────────────────

const DT_LOAD_MAX = 5;
let dtLoadCount = 0;
const dtLoadErrors       = [];
const dtLoadFieldUserSet = [];
const dtLoadContainer    = document.getElementById('dt-load-cards-container');

function showDtLoadError(i) {
  const el = document.getElementById(`dt-load-error-${i}`);
  if (el && dtLoadErrors[i]) {
    el.textContent = dtLoadErrors[i].L || dtLoadErrors[i].Lmin || dtLoadErrors[i].Lmax || '';
  }
}

function setDtLoadFieldState(i, inputEl, fieldKey, message, isError = false) {
  if (isError) {
    inputEl.classList.add('input-error');
    dtLoadErrors[i][fieldKey] = message;
  } else {
    inputEl.classList.remove('input-error');
    dtLoadErrors[i][fieldKey] = '';
  }
  showDtLoadError(i);
}

function validateDtL(i) {
  const el = document.getElementById(`dt-input-L${i}`);
  if (!el) return true;
  const raw = el.value.trim();
  if (raw === '') { setDtLoadFieldState(i, el, 'L', ''); return true; }
  const val = parseFloat(raw);
  if (isNaN(val) || val <= 0) {
    setDtLoadFieldState(i, el, 'L', 'Load must be a positive number', true); return false;
  }
  if (!isValidLoadPrecision(raw, val)) {
    setDtLoadFieldState(i, el, 'L', val > 20 ? 'Whole numbers only above 20 W' : 'Max 1 decimal place', true); return false;
  }
  setDtLoadFieldState(i, el, 'L', '');
  return true;
}

function validateDtLmin(i) {
  const el = document.getElementById(`dt-input-Lmin${i}`);
  if (!el) return true;
  const raw = el.value.trim();
  if (raw === '') { setDtLoadFieldState(i, el, 'Lmin', ''); return true; }
  const val = parseFloat(raw);
  if (isNaN(val) || val <= 0) {
    setDtLoadFieldState(i, el, 'Lmin', 'Min must be a positive number', true); return false;
  }
  if (!isValidLoadPrecision(raw, val)) {
    setDtLoadFieldState(i, el, 'Lmin', val > 20 ? 'Whole numbers only above 20 W' : 'Max 1 decimal place', true); return false;
  }
  const lEl  = document.getElementById(`dt-input-L${i}`);
  const lRaw = lEl ? lEl.value.trim() : '';
  if (lRaw !== '') {
    const lVal = parseFloat(lRaw);
    if (!isNaN(lVal) && val > lVal) {
      setDtLoadFieldState(i, el, 'Lmin', `Min must be ≤ Nominal (${lVal})`, true); return false;
    }
  }
  setDtLoadFieldState(i, el, 'Lmin', '');
  return true;
}

function validateDtLmax(i) {
  const el = document.getElementById(`dt-input-Lmax${i}`);
  if (!el) return true;
  const raw = el.value.trim();
  if (raw === '') { setDtLoadFieldState(i, el, 'Lmax', ''); return true; }
  const val = parseFloat(raw);
  if (isNaN(val) || val <= 0) {
    setDtLoadFieldState(i, el, 'Lmax', 'Max must be a positive number', true); return false;
  }
  if (!isValidLoadPrecision(raw, val)) {
    setDtLoadFieldState(i, el, 'Lmax', val > 20 ? 'Whole numbers only above 20 W' : 'Max 1 decimal place', true); return false;
  }
  const lEl  = document.getElementById(`dt-input-L${i}`);
  const lRaw = lEl ? lEl.value.trim() : '';
  if (lRaw !== '') {
    const lVal = parseFloat(lRaw);
    if (!isNaN(lVal) && val < lVal) {
      setDtLoadFieldState(i, el, 'Lmax', `Max must be ≥ Nominal (${lVal})`, true); return false;
    }
  }
  setDtLoadFieldState(i, el, 'Lmax', '');
  return true;
}

function dtTryAutoPopulateAll(i) {
  const us     = dtLoadFieldUserSet[i];
  const lEl    = document.getElementById(`dt-input-L${i}`);
  const lminEl = document.getElementById(`dt-input-Lmin${i}`);
  const lmaxEl = document.getElementById(`dt-input-Lmax${i}`);
  if (!lEl || !lminEl || !lmaxEl) return;

  const lVal    = (us.L    && lEl.value.trim()    !== '' && dtLoadErrors[i].L    === '')
                  ? parseFloat(lEl.value.trim())    : null;
  const lminVal = (us.Lmin && lminEl.value.trim() !== '' && dtLoadErrors[i].Lmin === '')
                  ? parseFloat(lminEl.value.trim()) : null;
  const lmaxVal = (us.Lmax && lmaxEl.value.trim() !== '' && dtLoadErrors[i].Lmax === '')
                  ? parseFloat(lmaxEl.value.trim()) : null;

  function fmtL(v) {
    if (v > 20) return String(Math.round(v));
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }

  function autoSet(el, fieldKey, val) {
    const fmt = fmtL(val);
    el.value = fmt;
    el.dataset.lastValid = fmt;
    el.classList.add('auto-populated');
    setDtLoadFieldState(i, el, fieldKey, '');
  }

  function autoClear(el, fieldKey) {
    if (el.classList.contains('auto-populated')) {
      el.value = '';
      el.dataset.lastValid = '';
      el.classList.remove('auto-populated');
      setDtLoadFieldState(i, el, fieldKey, '');
    }
  }

  if (!us.L) {
    if      (lminVal !== null && lmaxVal !== null) autoSet(lEl, 'L', (lminVal + lmaxVal) / 2);
    else if (lminVal !== null)                     autoSet(lEl, 'L', lminVal);
    else if (lmaxVal !== null)                     autoSet(lEl, 'L', lmaxVal);
    else                                           autoClear(lEl, 'L');
  }
  if (!us.Lmin) {
    if      (lVal    !== null) autoSet(lminEl, 'Lmin', lVal);
    else if (lmaxVal !== null) autoSet(lminEl, 'Lmin', lmaxVal);
    else                       autoClear(lminEl, 'Lmin');
  }
  if (!us.Lmax) {
    if      (lVal    !== null) autoSet(lmaxEl, 'Lmax', lVal);
    else if (lminVal !== null) autoSet(lmaxEl, 'Lmax', lminVal);
    else                       autoClear(lmaxEl, 'Lmax');
  }
}

function dtUpdateLoadControls() {
  for (let i = 0; i < DT_LOAD_MAX; i++) {
    const minBtn = document.getElementById(`dt-load-minus-${i}`);
    const plusBtn = document.getElementById(`dt-load-plus-${i}`);
    if (!minBtn || !plusBtn) continue;
    const isLast = (i === dtLoadCount - 1);
    minBtn.style.visibility  = (isLast && dtLoadCount > 1)          ? '' : 'hidden';
    plusBtn.style.visibility = (isLast && dtLoadCount < DT_LOAD_MAX) ? '' : 'hidden';
  }
}

function dtUpdateDtTotalRow() {
  ['L', 'Lmin', 'Lmax'].forEach(field => {
    let sum = 0, hasAny = false;
    for (let i = 0; i < dtLoadCount; i++) {
      const el  = document.getElementById(`dt-input-${field}${i}`);
      if (!el) continue;
      const raw = el.value.trim();
      if (raw === '') continue;
      const val = parseFloat(raw);
      if (isNaN(val)) continue;
      sum += val;
      hasAny = true;
    }
    const summaryEl = document.getElementById(`dt-ls-${field}`);
    if (!summaryEl) return;
    if (hasAny) {
      const rounded = Math.round(sum * 10) / 10;
      summaryEl.textContent = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    } else {
      summaryEl.textContent = '—';
    }
  });
}

function dtAttachLoadListeners(i) {
  const lEl    = document.getElementById(`dt-input-L${i}`);
  const lminEl = document.getElementById(`dt-input-Lmin${i}`);
  const lmaxEl = document.getElementById(`dt-input-Lmax${i}`);
  const minBtn = document.getElementById(`dt-load-minus-${i}`);
  const plusBtn = document.getElementById(`dt-load-plus-${i}`);
  const us = dtLoadFieldUserSet[i];

  lEl.addEventListener('input', () => {
    if (lEl.value.trim() !== '') { us.L = true; lEl.classList.remove('auto-populated'); }
    else us.L = false;
  });
  lEl.addEventListener('blur', () => {
    if (validateDtL(i)) {
      lEl.dataset.lastValid = lEl.value;
      if (lEl.value.trim() === '') us.L = false;
    } else {
      lEl.value = lEl.dataset.lastValid ?? '';
      if (lEl.value.trim() === '') us.L = false;
      validateDtL(i);
    }
    dtTryAutoPopulateAll(i);
    dtUpdateDtTotalRow();
    // SCREEN DfTime: lock Path B on first valid L entry; keep result live after that
    if (lEl.value.trim() !== '' && dtPackLoadVisible) dtSetMode('load');
    if (dtMode === 'load') dtUpdateResult();
  });

  lminEl.addEventListener('input', () => {
    if (lminEl.value.trim() !== '') { us.Lmin = true; lminEl.classList.remove('auto-populated'); }
    else us.Lmin = false;
  });
  lminEl.addEventListener('blur', () => {
    if (validateDtLmin(i)) {
      lminEl.dataset.lastValid = lminEl.value;
      if (lminEl.value.trim() === '') us.Lmin = false;
    } else {
      lminEl.value = lminEl.dataset.lastValid ?? '';
      if (lminEl.value.trim() === '') us.Lmin = false;
      validateDtLmin(i);
    }
    dtTryAutoPopulateAll(i);
    dtUpdateDtTotalRow();
    if (lminEl.value.trim() !== '' && dtPackLoadVisible) dtSetMode('load');
    if (dtMode === 'load') dtUpdateResult();
  });

  lmaxEl.addEventListener('input', () => {
    if (lmaxEl.value.trim() !== '') { us.Lmax = true; lmaxEl.classList.remove('auto-populated'); }
    else us.Lmax = false;
  });
  lmaxEl.addEventListener('blur', () => {
    if (validateDtLmax(i)) {
      lmaxEl.dataset.lastValid = lmaxEl.value;
      if (lmaxEl.value.trim() === '') us.Lmax = false;
    } else {
      lmaxEl.value = lmaxEl.dataset.lastValid ?? '';
      if (lmaxEl.value.trim() === '') us.Lmax = false;
      validateDtLmax(i);
    }
    dtTryAutoPopulateAll(i);
    dtUpdateDtTotalRow();
    if (lmaxEl.value.trim() !== '' && dtPackLoadVisible) dtSetMode('load');
    if (dtMode === 'load') dtUpdateResult();
  });

  if (minBtn)  minBtn.addEventListener('click',  dtRemoveLastLoadCard);
  if (plusBtn) plusBtn.addEventListener('click', dtAddLoadCard);
}

function dtAddLoadCard() {
  if (dtLoadCount >= DT_LOAD_MAX) return;
  const i = dtLoadCount;
  dtLoadErrors[i]       = { L: '', Lmin: '', Lmax: '' };
  dtLoadFieldUserSet[i] = { L: false, Lmin: false, Lmax: false };

  const card = document.createElement('div');
  card.className = 'card load-card load-x-card';
  card.id = `dt-load-card-${i}`;
  card.innerHTML = `
    <h2>L${i}</h2>
    <div class="load-content">
      <div class="load-row">
        <div class="load-field load-field-nominal">
          <label class="load-label" for="dt-input-L${i}">Nominal</label>
          <div class="load-input-row">
            <input class="field-input load-input" type="text"
                   id="dt-input-L${i}" inputmode="decimal" step="0.1">
            <span class="load-unit">W</span>
          </div>
        </div>
        <div class="load-minmax-group">
          <div class="load-field">
            <label class="load-label" for="dt-input-Lmin${i}">Min</label>
            <div class="load-input-row">
              <input class="field-input load-input" type="text"
                     id="dt-input-Lmin${i}" inputmode="decimal" step="0.1">
              <span class="load-unit">W</span>
            </div>
          </div>
          <div class="load-field">
            <label class="load-label" for="dt-input-Lmax${i}">Max</label>
            <div class="load-input-row">
              <input class="field-input load-input" type="text"
                     id="dt-input-Lmax${i}" inputmode="decimal" step="0.1">
              <span class="load-unit unit-max">W</span>
            </div>
          </div>
        </div>
      </div>
      <p class="load-error" id="dt-load-error-${i}"></p>
    </div>
    <div class="load-controls" id="dt-load-controls-${i}">
      <button class="load-btn load-btn-minus" id="dt-load-minus-${i}" aria-label="Remove load card">−</button>
      <button class="load-btn load-btn-plus"  id="dt-load-plus-${i}"  aria-label="Add load card">+</button>
    </div>
  `;

  dtLoadContainer.appendChild(card);
  dtLoadCount++;
  dtAttachLoadListeners(i);
  dtUpdateLoadControls();
  dtUpdateDtTotalRow();
}

function dtRemoveLastLoadCard() {
  if (dtLoadCount <= 1) return;
  dtLoadCount--;
  const card = document.getElementById(`dt-load-card-${dtLoadCount}`);
  if (card) dtLoadContainer.removeChild(card);
  dtLoadErrors.splice(dtLoadCount, 1);
  dtLoadFieldUserSet.splice(dtLoadCount, 1);
  dtUpdateLoadControls();
  dtUpdateDtTotalRow();
}

// ─────────────────────────────────────────────
// DfTime page reset — called from resetPage('page-time')
// ─────────────────────────────────────────────
function dtResetPage() {
  dbgClear(); refreshDebug();   // clear debug panel on DfTime reset
  // Re-hide PACK + LOAD; reset flags so reveal + mode lock fire again on next valid entry
  dtPackLoadVisible = false;
  dtMode = null;
  document.getElementById('dt-pack-card').style.display   = 'none';
  document.getElementById('dt-load-group').style.display  = 'none';
  const dtOutputEl = document.getElementById('dt-output-card');
  dtOutputEl.style.display = 'none';
  dtOutputEl.style.backgroundColor = '';   // clear any inline colour set by Path B
  dtOutputEl.textContent = '';

  // Re-enable N and C in case Path B disabled them for resolve
  dtInputN.disabled = false;
  dtInputC.disabled = false;

  // Reset DT PACK — no defaults; user must enter all values
  dtInputN.value = '';   dtInputN.dataset.lastValid = '';
  setDtFieldState(dtInputN, 'N', '');

  dtInputC.value = '';   dtInputC.dataset.lastValid = '';
  setDtFieldState(dtInputC, 'C', '');

  dtInputCmin.value = '';  dtInputCmin.dataset.lastValid = '';
  dtInputCmin.classList.remove('auto-populated');
  dtPackFieldUserSet.Cmin = false;
  setDtFieldState(dtInputCmin, 'Cmin', '');

  dtInputCmax.value = '';  dtInputCmax.dataset.lastValid = '';
  dtInputCmax.classList.remove('auto-populated');
  dtPackFieldUserSet.Cmax = false;
  setDtFieldState(dtInputCmax, 'Cmax', '');

  tryAutoPopulateDtPack();

  // Reset TIME card — clear inputs and shared error state
  inputT.value = '';    inputT.dataset.lastValid = '';    inputT.classList.remove('input-error', 'auto-populated');
  inputTmin.value = ''; inputTmin.dataset.lastValid = ''; inputTmin.classList.remove('input-error', 'auto-populated');
  inputTmax.value = '';
  timeFieldUserSet.T = false;
  timeFieldUserSet.Tmin = false;
  timeErrors.T = ''; timeErrors.Tmin = '';
  timeErrorEl.textContent = '';

  // Reset DT LOAD cards — remove all and re-create a fresh L(0)
  while (dtLoadCount > 0) {
    dtLoadCount--;
    const card = document.getElementById(`dt-load-card-${dtLoadCount}`);
    if (card) dtLoadContainer.removeChild(card);
  }
  dtLoadErrors.length       = 0;
  dtLoadFieldUserSet.length = 0;
  dtAddLoadCard();   // adds fresh L(0) and resets summary totals
}

// ── Initialise DfTime: create initial L(0) card ──
dtAddLoadCard();

// ── Initialise debug panel with '—' placeholder values ──
refreshDebug();
