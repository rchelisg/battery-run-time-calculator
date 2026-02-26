# PWA Standards
# Version History
| Version | Date       | Changes                        |
|---------|------------|--------------------------------|
| v1.0    | 2026-02-26 | Initial release                |

---

## Required File Structure
- index.html       — main page, must include all Apple meta tags and link to manifest
- manifest.json    — must include name, short_name, start_url, display, icons
- service-worker.js — must handle install, activate (skipWaiting), and fetch events
- css/styles.css   — all styling
- js/app.js        — all app logic
- icons/icon.png   — 192x192px PNG minimum

## Offline Mode
- App must work 100% offline after the very first load
- All assets (HTML, CSS, JS, icons) must be pre-cached on first visit
- No feature should require an internet connection after initial load

## Cache Update Strategy
- When a new version is deployed, the cache must update automatically
- Use a "stale-while-revalidate" or "cache-first with background update" strategy
- When the user refreshes the page on their phone, all cached content must update
- Always increment the CACHE version number (e.g. v1, v2, v3) with every deployment
- The service worker must activate immediately (use skipWaiting and clientsClaim)

## iPhone Compatibility (Primary Target)
- Must support iPhone 14, 15, 16, and 17 screen sizes
- Include all required Apple-specific meta tags:
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="App Name">
    <link rel="apple-touch-icon" href="icons/icon.png">
- Handle the iPhone notch and home indicator using safe-area-inset CSS variables
- Test layout in both portrait and landscape orientations

## Android Compatibility (Secondary Target)
- Must work on modern Android phones (Chrome browser)
- Include a valid manifest.json so Android shows the install prompt
- Ensure touch targets are at least 44x44px

## Responsive Design Rules
- Mobile-first CSS — design for small screens first, scale up if needed
- Use relative units (rem, %, vh, vw) not fixed pixels for layout
- Minimum font size 16px to prevent iOS auto-zoom on inputs
- No horizontal scrolling on any screen size
- Test at these viewport widths: 375px (iPhone 14), 390px (iPhone 15/16), 430px (iPhone 14 Plus/17)

## Installing on Phone
- iPhone: Open in Safari → Share button → "Add to Home Screen"
- Android: Open in Chrome → menu → "Add to Home Screen"

## Hosting Requirements
- Must be served over HTTPS (required for service workers and installability)
- GitHub Pages, Netlify, and Vercel all provide free HTTPS hosting
