(function (AT) {
  "use strict";

  function switchToNextTab(senderTab) {
    if (
      !senderTab ||
      senderTab.id === undefined ||
      senderTab.windowId === undefined
    ) {
      return;
    }

    chrome.tabs.query({ windowId: senderTab.windowId }, (tabs) => {
      tabs.sort((a, b) => a.index - b.index);

      const currentIndex = tabs.findIndex((tab) => tab.id === senderTab.id);
      if (currentIndex === -1 || tabs.length < 2) return;

      const nextTab = tabs[(currentIndex + 1) % tabs.length];
      if (nextTab.id !== undefined) {
        chrome.tabs.update(nextTab.id, { active: true });
      }
    });
  }

  AT.background = AT.background || {};
  AT.background.tabs = Object.freeze({ switchToNextTab });
})(globalThis.AnkerTurbo);
