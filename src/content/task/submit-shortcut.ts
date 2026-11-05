(function (AT) {
  "use strict";

  function isTypingContext(element) {
    if (!element) {
      return false;
    }

    const tag = element.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      element.isContentEditable ||
      element.closest?.('[contenteditable="true"]')
    );
  }

  function findSubmitButton(rootDocument: Document): HTMLElement | null {
    const candidates = Array.from(
      rootDocument.querySelectorAll<HTMLElement>(
        'button, input[type="submit"], [role="button"]',
      ),
    );

    const submitText = /complete\s+and\s+load\s+next|load\s+next\s+record|submit|complete|完成|提交/i;
    const preferredSelectors = [
      'button[form="task-form"][type="submit"]',
      'button[form="task-form"]',
      '#task-form button[type="submit"]',
      'form#task-form button[type="submit"]',
    ];

    for (const selector of preferredSelectors) {
      const button = rootDocument.querySelector<HTMLElement>(selector);
      if (button && !button.hasAttribute("disabled")) return button;
    }

    return candidates.find((candidate) => {
      if (candidate.hasAttribute("disabled")) return false;
      const text = `${candidate.textContent || ""} ${candidate.getAttribute("aria-label") || ""}`;
      return submitText.test(text);
    }) || null;
  }

  function start(shortcutCode = "Backquote") {
    if (window.top !== window.self) {
      return;
    }

    let activeShortcutCode = shortcutCode;

    window.addEventListener("message", (event) => {
      if (
        event.source !== window ||
        (event.data?.type !== "SUBMIT_HOTKEY_SETTINGS_RESPONSE" &&
          event.data?.type !== "SETTINGS_CHANGED")
      ) {
        return;
      }

      activeShortcutCode = AT.settings.normalizeHotkey(
        event.data.hotkeySubmit ?? event.data.settings?.hotkeySubmit,
        activeShortcutCode,
      );
    });

    window.postMessage(
      { __ankerExtension: true, type: "GET_SUBMIT_HOTKEY_SETTINGS" },
      "*",
    );

    const handleKeydown = (event) => {
      const activeElement = event.target;

      if (
        isTypingContext(activeElement) ||
        event.code !== activeShortcutCode ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const eventDocument = event.currentTarget as Document;

      setTimeout(() => {
        try {
          const submitButton =
            findSubmitButton(eventDocument) ||
            (eventDocument === document ? null : findSubmitButton(document));

          if (submitButton) {
            submitButton.click();

            console.log("[Anker Turbo] Submit shortcut activated");
          } else {
            console.warn("[Anker Turbo] Submit shortcut: submit button not found");
          }
        } catch (error) {
          console.error("[Anker Turbo] Submit shortcut failed:", error);
        }
      });
    };

    const attachedDocuments = new WeakSet();
    const attachedIframes = new WeakSet();
    const attachDocument = (targetDocument) => {
      if (attachedDocuments.has(targetDocument)) return;
      attachedDocuments.add(targetDocument);
      targetDocument.addEventListener("keydown", handleKeydown, true);
    };

    const attachIframes = () => {
      for (const iframe of document.querySelectorAll("iframe")) {
        if (iframe.contentDocument) attachDocument(iframe.contentDocument);
        if (attachedIframes.has(iframe)) continue;
        attachedIframes.add(iframe);
        iframe.addEventListener("load", () => {
          if (iframe.contentDocument) attachDocument(iframe.contentDocument);
        });
      }
    };

    attachDocument(document);
    attachIframes();
    new MutationObserver(attachIframes).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  AT.task = AT.task || {};
  AT.task.submitShortcut = { start };
})(globalThis.AnkerTurbo);
