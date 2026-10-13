(function (AT) {
  "use strict";

  function important(...args) {
    console.log("%c[Anker Turbo]", "color:#1677ff;font-weight:bold", ...args);
  }

  AT.logger = Object.freeze({ important });
})(globalThis.AnkerTurbo);
