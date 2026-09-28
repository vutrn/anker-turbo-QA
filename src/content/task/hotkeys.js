(function (AT) {
  "use strict";

  let hotkeyFailCode = "KeyE";
  let hotkeyPassCode = "KeyR";
  const SWITCH_TO_NEXT_TAB_AFTER_QA = true;
  const NEXT_TAB_DELAY_MS = 150;
  let shortcutHint = null;

  function formatHotkey(code) {
    return String(code || "")
      .replace(/^Key/, "")
      .replace(/^Digit/, "")
      .replace(/^Arrow/, "Arrow ");
  }

  function updateShortcutHint() {
    if (!shortcutHint) return;

    shortcutHint.innerHTML =
      `<span><b style="color:#ff7875">${formatHotkey(hotkeyFailCode)}</b> Fail</span>` +
      `<span><b style="color:#95de64">${formatHotkey(hotkeyPassCode)}</b> Pass</span>`;
  }

  function isTypingContext(element) {
    if (!element) return false;

    const tag = element.tagName;
    if (tag === "TEXTAREA") return true;

    if (tag === "INPUT") {
      const type = (element.getAttribute("type") || "").toLowerCase();
      return !["radio", "checkbox", "button", "submit"].includes(type);
    }

    return element.isContentEditable;
  }

  function findSubmitButtonByExactText(text) {
    const buttons = document.querySelectorAll(
      'button[form="task-form"][type="submit"]',
    );
    const wanted = text.trim().toLowerCase();

    for (const button of buttons) {
      if (button.textContent.trim().toLowerCase() === wanted) return button;
    }

    return null;
  }

  function createShortcutHint() {
    if (document.getElementById("anker-task-shortcuts")) return;

    shortcutHint = document.createElement("div");
    shortcutHint.id = "anker-task-shortcuts";
    shortcutHint.setAttribute("aria-label", "Keyboard shortcuts");

    Object.assign(shortcutHint.style, {
      position: "fixed",
      top: "16px",
      right: "16px",
      zIndex: "999999",
      display: "flex",
      gap: "8px",
      padding: "8px 10px",
      background: "rgba(17, 24, 39, 0.92)",
      color: "#ffffff",
      borderRadius: "6px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "12px",
      lineHeight: "1",
      pointerEvents: "none",
    });

    updateShortcutHint();

    (document.body || document.documentElement).appendChild(shortcutHint);
  }

  function start() {
    createShortcutHint();

    window.addEventListener("message", (event) => {
      if (event.source !== window || event.data?.type !== "HOTKEY_SETTINGS_RESPONSE") {
        return;
      }

      hotkeyFailCode = AT.settings.normalizeHotkey(
        event.data.hotkeyFail,
        "KeyE",
      );
      hotkeyPassCode = AT.settings.normalizeHotkey(
        event.data.hotkeyPass,
        "KeyR",
      );
      updateShortcutHint();
    });

    window.postMessage(
      { __ankerExtension: true, type: "GET_HOTKEY_SETTINGS" },
      "*",
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.shiftKey ||
          event.repeat ||
          isTypingContext(document.activeElement)
        ) {
          return;
        }

        let targetText = null;
        if (event.code === hotkeyFailCode) targetText = "Fail";
        else if (event.code === hotkeyPassCode) targetText = "Pass";
        if (!targetText) return;

        const button = findSubmitButtonByExactText(targetText);
        if (!button || button.disabled) return;

        event.preventDefault();
        event.stopPropagation();
        button.click();

        if (SWITCH_TO_NEXT_TAB_AFTER_QA) {
          setTimeout(() => {
            window.postMessage(
              { __ankerExtension: true, type: AT.MSG.NEXT_TAB },
              "*",
            );
          }, NEXT_TAB_DELAY_MS);
        }
      },
      true,
    );
  }

  AT.task = AT.task || {};
  AT.task.hotkeys = { start };
})(globalThis.AnkerTurbo);
