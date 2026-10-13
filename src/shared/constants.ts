(function (AT) {
  "use strict";

  AT.MSG = Object.freeze({
    REGISTER_CONTROLLER: "REGISTER_CONTROLLER",
    START_QUEUE: "START_QUEUE",
    FILL_QUEUE: "FILL_QUEUE",
    STOP_QUEUE: "STOP_QUEUE",
    RESET_QUEUE: "RESET_QUEUE",
    PRUNE_POOL: "PRUNE_POOL",
    TASK_SUBMIT_SUCCESS: "TASK_SUBMIT_SUCCESS",
    INVALID_TASK_PAGE: "INVALID_TASK_PAGE",
    GET_TURBO_DELAY: "GET_TURBO_DELAY",
    GET_AUTO_RELOAD_SETTINGS: "GET_AUTO_RELOAD_SETTINGS",
    TURBO_DELAY_RESPONSE: "TURBO_DELAY_RESPONSE",
    AUTO_RELOAD_SETTINGS_RESPONSE: "AUTO_RELOAD_SETTINGS_RESPONSE",
    AUTO_RELOAD_SETTINGS_CHANGED: "AUTO_RELOAD_SETTINGS_CHANGED",
    GET_HOTKEY_SETTINGS: "GET_HOTKEY_SETTINGS",
    HOTKEY_SETTINGS_RESPONSE: "HOTKEY_SETTINGS_RESPONSE",
    QUEUE_STATUS: "QUEUE_STATUS",
    CLOSED_TASK: "CLOSED_TASK",
    TASK_COMPLETED: "TASK_COMPLETED",
    NEXT_TAB: "NEXT_TAB",
  });

  AT.STORAGE_KEYS = Object.freeze({
    TURBO_DELAY: "turboDelay",
    CONCURRENT_TABS: "concurrentTabs",
    BLANK_RELOAD: "blankReload",
    MAX_AUTO_RELOAD: "maxAutoReload",
    SEPARATE_TASK_WINDOW: "separateTaskWindow",
    HOTKEY_FAIL: "hotkeyFail",
    HOTKEY_PASS: "hotkeyPass",
  });

  AT.DEFAULTS = Object.freeze({
    delay: 600,
    concurrent: 3,
    blankReload: 8000,
    maxAutoReload: 3,
    separateTaskWindow: true,
    hotkeyFail: "KeyE",
    hotkeyPass: "KeyR",
  });

  AT.LIMITS = Object.freeze({
    delay: Object.freeze([100, 10000]),
    concurrent: Object.freeze([1, 50]),
    blankReload: Object.freeze([1000, 60000]),
    maxAutoReload: Object.freeze([0, Number.MAX_SAFE_INTEGER]),
  });
})(globalThis.AnkerTurbo);
