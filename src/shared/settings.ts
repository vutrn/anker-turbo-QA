(function (AT) {
  "use strict";

  function clampNumber(value, fallback, limits) {
    const number = Number(value);
    const resolved = Number.isFinite(number) ? number : fallback;
    const [minimum, maximum] = limits;

    return Math.max(minimum, Math.min(maximum, Math.round(resolved)));
  }

  function normalizeHotkey(value, fallback) {
    if (typeof value !== "string") return fallback;

    const code = value.trim();
    if (code === "") return "";
    if (/^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Arrow(?:Up|Down|Left|Right)|Backquote|Space|Enter|Tab|Escape)$/.test(code)) {
      return code;
    }

    return fallback;
  }

  function normalizeSettings(values) {
    const source = values || {};

    return {
      delay: clampNumber(
        source.delay,
        AT.DEFAULTS.delay,
        AT.LIMITS.delay,
      ),
      concurrent: clampNumber(
        source.concurrent,
        AT.DEFAULTS.concurrent,
        AT.LIMITS.concurrent,
      ),
      blankReload: clampNumber(
        source.blankReload,
        AT.DEFAULTS.blankReload,
        AT.LIMITS.blankReload,
      ),
      maxAutoReload: clampNumber(
        source.maxAutoReload,
        AT.DEFAULTS.maxAutoReload,
        AT.LIMITS.maxAutoReload,
      ),
      separateTaskWindow:
        source.separateTaskWindow === undefined
          ? AT.DEFAULTS.separateTaskWindow
          : Boolean(source.separateTaskWindow),
      counterEnabled:
        source.counterEnabled === undefined
          ? AT.DEFAULTS.counterEnabled
          : Boolean(source.counterEnabled),
      antiIdleEnabled:
        source.antiIdleEnabled === undefined
          ? AT.DEFAULTS.antiIdleEnabled
          : Boolean(source.antiIdleEnabled),
      hotkeyFail: normalizeHotkey(
        source.hotkeyFail,
        AT.DEFAULTS.hotkeyFail,
      ),
      hotkeyPass: normalizeHotkey(
        source.hotkeyPass,
        AT.DEFAULTS.hotkeyPass,
      ),
      hotkeySubmit: normalizeHotkey(
        source.hotkeySubmit,
        AT.DEFAULTS.hotkeySubmit,
      ),
    };
  }

  AT.settings = Object.freeze({
    clampNumber,
    normalizeHotkey,
    normalize: normalizeSettings,
  });
})(globalThis.AnkerTurbo);
