# Project Instructions

- Do not automatically reload the extension or page after making changes.
  This project has no build step and no dev server, so there is nothing to
  hot-reload — the person must manually reload the extension via
  `chrome://extensions` and refresh the target page to pick up changes.

## Project Overview

This is **Anker Turbo Background Review**, a Chrome Extension built with
Manifest V3 for accelerating batch task reviews on Anker Annotation
(`aidc-annotation-*.anker-in.com`).

- `background.js` is the Service Worker that manages the concurrent task
  queue, task tabs, and persistent runtime state (`chrome.storage.session`).
- `main.js` runs in the page's MAIN world: it reads the Annotation UI/API
  (via hooked `fetch`/`XHR`), injects queue controls into worker-job pages,
  and observes task lifecycle events.
- `bridge.js` runs in the ISOLATED world and relays `window.postMessage`
  traffic between the page (`main.js`) and the extension runtime
  (`background.js`) via `chrome.runtime.sendMessage`.
- `popup.html`, `popup.js`, and `popup.css` provide settings for task-open
  delay, concurrent tabs, and blank-task auto-reload handling.
- `manifest.json` declares the MV3 extension, permissions, target Anker
  Annotation domains, Service Worker, and content scripts.

The extension is intentionally implemented without a build step: edit the
JavaScript, HTML, CSS, and manifest files directly.

## Testing

No automated test suite. Verify changes manually:

1. Reload the extension in `chrome://extensions`.
2. Reload the target worker-job page.
3. Check the Service Worker console (Inspect views → service worker) and
   the page console for `[Anker Turbo]`-prefixed logs.
