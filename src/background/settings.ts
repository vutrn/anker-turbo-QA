(function (AT) {
  "use strict";

  async function getSettings() {
    const keys = AT.STORAGE_KEYS;
    const result = await chrome.storage.local.get([
      keys.TURBO_DELAY,
      keys.CONCURRENT_TABS,
      keys.SEPARATE_TASK_WINDOW,
      keys.COUNTER_ENABLED,
      keys.ANTI_IDLE_ENABLED,
    ]);

    const settings = AT.settings.normalize({
      delay: result[keys.TURBO_DELAY],
      concurrent: result[keys.CONCURRENT_TABS],
      separateTaskWindow: result[keys.SEPARATE_TASK_WINDOW],
      counterEnabled: result[keys.COUNTER_ENABLED],
      antiIdleEnabled: result[keys.ANTI_IDLE_ENABLED],
    });

    return settings;
  }

  AT.background = AT.background || {};
  AT.background.settings = Object.freeze({ getSettings });
})(globalThis.AnkerTurbo);
