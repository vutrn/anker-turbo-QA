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

The extension intentionally uses classic scripts and an explicit load order. This
keeps the MAIN-world content scripts compatible with Manifest V3 without a
build step.

- `src/shared/`: namespace, constants, settings, and logging shared by contexts.
- `src/content/task/`: behavior used only by `qa-task-start` pages.
- `src/content/worker/`: row filtering, review URL creation, and worker UI modules.
- `main.js`: current worker-page controller entry; queue coordination remains here during the incremental migration.
- `bridge.js`: isolated relay between page messages and the Service Worker.
- `src/background/`: queue helpers, lifecycle handlers, settings, and tab modules used by the Service Worker.
- `background.js`: current Service Worker entry and queue coordinator; persistence wiring remains here during the incremental migration.
- `popup.js`: settings UI, using shared normalization.

## Migration rule

New task-page behavior belongs in `src/content/task/`. New worker-page behavior
should be added behind a worker-specific module before the remaining worker logic
is extracted from `main.js`.
