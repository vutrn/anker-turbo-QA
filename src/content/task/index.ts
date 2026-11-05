(function (AT) {
  "use strict";

  function getTaskPathname() {
    return location.pathname.replace(/\/+$/, "");
  }

  function isTaskPage() {
    return getTaskPathname() === "/ssr/qa-task-start";
  }

  function isAssignedTaskPage() {
    return getTaskPathname() === "/ssr/annotation-task-start";
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
    if (!isTaskPage() && !isAssignedTaskPage()) return;

    console.log("[Anker Turbo] Task helpers initializing:", location.pathname);

    const antiIdleEnabled = await loadTaskFeatureState(
      globalThis.AnkerTurbo?.STORAGE_KEYS?.ANTI_IDLE_ENABLED ?? "antiIdleEnabled",
      true,
    );
    const counterEnabled = await loadTaskFeatureState(
      globalThis.AnkerTurbo?.STORAGE_KEYS?.COUNTER_ENABLED ?? "counterEnabled",
      true,
    );

    applyFeatureSettings({ antiIdleEnabled, counterEnabled });

    AT.task.submitShortcut.start(
      globalThis.AnkerTurbo?.DEFAULTS?.hotkeySubmit ?? "Backquote",
    );

    if (isAssignedTaskPage()) {
      return;
    }

    AT.task.videoSpeed.start();
    AT.task.hotkeys.start();
  }

  function applyFeatureSettings(settings) {
    if (settings.antiIdleEnabled) {
      AT.task.antiIdle.start();
    } else {
      AT.task.antiIdle.stop();
    }

    if (settings.counterEnabled) {
      AT.task.counter.start();
    } else {
      AT.task.counter.stop();
    }
  }

  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.data?.type !== "SETTINGS_CHANGED" ||
      (!isTaskPage() && !isAssignedTaskPage())
    ) {
      return;
    }

    const settings = event.data.settings;
    if (!settings) return;

    applyFeatureSettings(settings);
  });

  AT.task = AT.task || {};
  AT.task.start = start;
})(globalThis.AnkerTurbo);
