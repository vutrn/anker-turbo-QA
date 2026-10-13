"use strict";

// =========================================================
// ANNOTATION AND TASK-PAGE WATCHERS
// =========================================================

(function () {
  const DEFAULT_LOAD_TIMEOUT = 8000;
  const DEFAULT_MAX_AUTO_RELOAD = 3;
  const CHECK_INTERVAL = 500;
  const ANNOTATION_IFRAME_SELECTOR =
    'iframe[src="/ssr/tools/video-track-v2.html"]';
  const MULTIPLE_TASK_WARNING_TEXT =
    "Note: Please do not open multiple task page";

  let annotationLoadTimeout = DEFAULT_LOAD_TIMEOUT;
  let maxAutoReload = DEFAULT_MAX_AUTO_RELOAD;
  let annotationWatcher = null;
  let annotationBlankSince = null;
  let invalidTaskReported = false;
  let isWorkerJobPage = () => false;
  let important = () => {};

  function setSettings(blankReload, maxReload) {
    const blankTimeout = Number(blankReload);
    const reloadLimit = Number(maxReload);

    if (Number.isFinite(blankTimeout)) {
      annotationLoadTimeout = Math.max(
        1000,
        Math.min(60000, Math.round(blankTimeout)),
      );
    }

    if (Number.isFinite(reloadLimit)) {
      maxAutoReload = Math.max(0, Math.round(reloadLimit));
    }
  }

  function isMultipleTaskWarningPage() {
    const bodyText = document.body?.innerText || "";

    return bodyText.includes(MULTIPLE_TASK_WARNING_TEXT);
  }

  function checkMultipleTaskWarning() {
    if (isWorkerJobPage() || invalidTaskReported) {
      return;
    }

    if (!isMultipleTaskWarningPage()) {
      return;
    }

    invalidTaskReported = true;
    important("INVALID TASK");

    window.postMessage(
      {
        __ankerExtension: true,
        type: "INVALID_TASK_PAGE",
      },
      "*",
    );
  }

  function isAnnotationLoaded() {
    if (document.querySelector(ANNOTATION_IFRAME_SELECTOR)) {
      return true;
    }

    const recordContainer = document.querySelector(".record-container");

    return Boolean(
      recordContainer &&
        recordContainer.querySelector("video source[src], video[src]"),
    );
  }

  function getReloadCount() {
    try {
      return Number(sessionStorage.getItem("anker_annotation_reload_count")) || 0;
    } catch (_) {
      return 0;
    }
  }

  function resetReloadCount() {
    try {
      sessionStorage.removeItem("anker_annotation_reload_count");
    } catch (_) {}
  }

  function stopAnnotationWatcher() {
    if (annotationWatcher) {
      clearInterval(annotationWatcher);
      annotationWatcher = null;
    }
  }

  function reloadAnnotationPage() {
    const count = getReloadCount();

    if (maxAutoReload <= 0) {
      stopAnnotationWatcher();
      return;
    }

    if (count >= maxAutoReload) {
      important("MAX AUTO RELOAD REACHED", `${count}/${maxAutoReload}`);
      stopAnnotationWatcher();
      return;
    }

    try {
      sessionStorage.setItem(
        "anker_annotation_reload_count",
        String(count + 1),
      );
    } catch (_) {}

    important("RELOAD BLANK TASK", `${count + 1}/${maxAutoReload}`);
    stopAnnotationWatcher();
    location.reload();
  }

  function startMultipleTaskWarningWatcher() {
    setInterval(checkMultipleTaskWarning, CHECK_INTERVAL);
  }

  function startAnnotationWatcher() {
    if (annotationWatcher) {
      return;
    }

    annotationWatcher = setInterval(() => {
      if (isWorkerJobPage() || isMultipleTaskWarningPage()) {
        return;
      }

      if (isAnnotationLoaded()) {
        annotationBlankSince = null;
        resetReloadCount();
        return;
      }

      if (annotationBlankSince === null) {
        annotationBlankSince = Date.now();
        return;
      }

      const elapsed = Date.now() - annotationBlankSince;

      if (elapsed >= annotationLoadTimeout) {
        reloadAnnotationPage();
      }
    }, CHECK_INTERVAL);
  }

  function start(options = {}) {
    isWorkerJobPage = options.isWorkerJobPage || isWorkerJobPage;
    important = options.important || important;
    invalidTaskReported = false;
    startMultipleTaskWarningWatcher();
    startAnnotationWatcher();
  }

  window.__ankerTurboAnnotationWatcher = {
    setSettings,
    start,
  };
})();
