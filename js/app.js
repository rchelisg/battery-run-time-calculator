// ─────────────────────────────────────────────
// Battery Run Time Calculator — app.js
// ─────────────────────────────────────────────

// ── Service Worker Registration ──────────────
// Must be registered from the page so the browser knows to use it
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('[App] Service worker registered. Scope:', registration.scope);
        updateSwStatus('✅ Service worker active — app works offline!');
      })
      .catch(error => {
        console.error('[App] Service worker registration failed:', error);
        updateSwStatus('⚠️ Service worker not registered: ' + error.message);
      });
  });
} else {
  updateSwStatus('ℹ️ Service workers not supported in this browser.');
}

// ── Helper: update the on-screen SW status message ──
function updateSwStatus(message) {
  const el = document.getElementById('sw-status');
  if (el) {
    el.textContent = message;
  }
}
