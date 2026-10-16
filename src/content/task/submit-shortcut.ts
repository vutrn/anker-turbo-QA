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

  function findSubmitButton() {
    const rootDocument = (window.top && window.top.document) || document;

    let button = rootDocument.querySelector<HTMLButtonElement>('button[form="task-form"]');

    if (!button) {
      button = Array.from(rootDocument.querySelectorAll<HTMLButtonElement>("button")).find(
        (candidate) =>
          typeof candidate.textContent === "string" &&
          candidate.textContent.includes("Complete and load next record"),
      );
    }

    return button;
  }

  function start(shortcutCode = "Backquote") {
    if (window.top !== window.self) {
      return;
    }

    document.addEventListener(
      "keydown",
      (event) => {
        const activeElement = document.activeElement;

        if (isTypingContext(activeElement)) {
          return;
        }

        if (event.code === shortcutCode) {
          event.preventDefault();

          setTimeout(() => {
            try {
              const submitButton = findSubmitButton();

              if (submitButton && !submitButton.disabled) {
                submitButton.dispatchEvent(
                  new MouseEvent("mousedown", {
                    bubbles: true,
                    cancelable: true,
                    view: window.top || window,
                  }),
                );
                submitButton.dispatchEvent(
                  new MouseEvent("mouseup", {
                    bubbles: true,
                    cancelable: true,
                    view: window.top || window,
                  }),
                );
                submitButton.dispatchEvent(
                  new MouseEvent("click", {
                    bubbles: true,
                    cancelable: true,
                    view: window.top || window,
                  }),
                );

                console.log("[Submit Shortcut 6.6] Submitted");
              } else {
                console.log("[Submit Shortcut 6.6] Không tìm thấy nút Submit");
              }
            } catch (error) {
              console.error("[Submit Shortcut 6.6] Error:", error);
            }
          });
        }
      },
      true,
    );
  }

  AT.task = AT.task || {};
  AT.task.submitShortcut = { start };
})(globalThis.AnkerTurbo);
