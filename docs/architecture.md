# Anker Turbo Architecture

## Runtime layers

```text
Page MAIN world
  content/task or content/worker
        |
        | window.postMessage
        v
Bridge ISOLATED world
        |
        | chrome.runtime.sendMessage
        v
Background Service Worker
  queue + tabs + lifecycle + storage
```

## Script loading

The extension uses classic scripts and an explicit load order. TypeScript
sources are compiled independently with esbuild into `dist/`; this preserves
the MAIN-world content scripts' compatibility with Manifest V3 while keeping
the existing runtime boundaries.

- `src/shared/`: namespace, constants, settings, and logging shared by contexts.
- `src/content/task/`: behavior used only by `qa-task-start` pages.
- `src/content/worker/`: row filtering, review URL creation, and worker UI modules.
- `main.ts`: current worker-page controller entry; compiled to `dist/main.js`.
- `bridge.ts`: isolated relay between page messages and the Service Worker.
- `src/background/`: queue helpers, lifecycle handlers, settings, and tab modules used by the Service Worker.
- `background.ts`: current Service Worker entry and queue coordinator; compiled to `dist/background.js`.
- `popup.ts`: settings UI, using shared normalization; compiled to `dist/popup.js`.

The source files use the `.ts` extension. `npm run build` emits the
corresponding `.js` files under `dist/`; `manifest.json` loads only those
compiled files.

## Migration rule

New task-page behavior belongs in `src/content/task/`. New worker-page behavior
should be added behind a worker-specific module before the remaining worker logic
is extracted from `main.js`.
