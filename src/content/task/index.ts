(function (AT) {
  "use strict";

  function isTaskPage() {
    return location.pathname === "/ssr/qa-task-start";
  }

  function start() {
    if (!isTaskPage()) return;

    AT.task.videoSpeed.start();
    AT.task.hotkeys.start();
  }

  AT.task = AT.task || {};
  AT.task.start = start;
})(globalThis.AnkerTurbo);
