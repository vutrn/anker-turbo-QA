(function (AT) {
  "use strict";

  function isTaskPage() {
    return location.pathname === "/ssr/qa-task-start";
  }

  async function loadTaskFeatureState(key, fallback = true) {
    try {
      const result = await chrome.storage.local.get(key);
      const value = result[key];
      return value === undefined ? fallback : Boolean(value);
    } catch (_) {
      return fallback;
    }
  }

  async function start() {
    if (!isTaskPage()) return;

    AT.task.videoSpeed.start();
    AT.task.hotkeys.start();

    const counterEnabled = await loadTaskFeatureState(
      globalThis.AnkerTurbo?.STORAGE_KEYS?.COUNTER_ENABLED ?? "counterEnabled",
      true,
    );

    const antiIdleEnabled = await loadTaskFeatureState(
      globalThis.AnkerTurbo?.STORAGE_KEYS?.ANTI_IDLE_ENABLED ?? "antiIdleEnabled",
      true,
    );

    let submitShortcutCode = globalThis.AnkerTurbo?.DEFAULTS?.hotkeySubmit ?? "Backquote";

    try {
      const result = await chrome.storage.local.get(
        globalThis.AnkerTurbo?.STORAGE_KEYS?.HOTKEY_SUBMIT ?? "hotkeySubmit",
      );
      if (result[globalThis.AnkerTurbo?.STORAGE_KEYS?.HOTKEY_SUBMIT ?? "hotkeySubmit"] !== undefined) {
        submitShortcutCode = String(
          result[globalThis.AnkerTurbo?.STORAGE_KEYS?.HOTKEY_SUBMIT ?? "hotkeySubmit"],
        );
      }
    } catch (_) {}

    if (counterEnabled) {
      AT.task.counter.start();
    }

    if (antiIdleEnabled) {
      AT.task.antiIdle.start();
    }

    AT.task.submitShortcut.start(submitShortcutCode);
  }

  AT.task = AT.task || {};
  AT.task.start = start;
})(globalThis.AnkerTurbo);
