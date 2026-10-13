// =========================================================
// ANKER TURBO - MAIN.JS
// Clean Console Version
// =========================================================

(function () {
  "use strict";

  const AT = globalThis.AnkerTurbo;

  // =========================================================
  // CONFIG
  // =========================================================

  const DEFAULT_TURBO_DELAY = AT.DEFAULTS.delay;
  const MIN_TURBO_DELAY = AT.LIMITS.delay[0];

  // =========================================================
  // STATE
  // =========================================================

  let turboDelay = DEFAULT_TURBO_DELAY;

  let queueRunning = false;
  let activeTaskRecords = new Set();
  let pendingTaskRecords = new Set();

  let activeTaskCount = 0;
  let pendingTaskCount = 0;

  let openedCount = 0;
  let completedCount = 0;

  // =========================================================
  // AUTO RELOAD SETTINGS (via bridge, vì main.js chạy MAIN world)
  // =========================================================

  function requestAutoReloadSettings() {
    window.postMessage(
      { __ankerExtension: true, type: "GET_AUTO_RELOAD_SETTINGS" },
      "*",
    );
  }

  function applyAutoReloadSettings(blankReload, maxReload) {
    if (window.__ankerTurboAnnotationWatcher) {
      window.__ankerTurboAnnotationWatcher.setSettings(blankReload, maxReload);
    }
  }

  // =========================================================
  // DETECTED CONFIG
  // =========================================================

  const detectedConfig = {
    jobId: null,
    flowId: null,
    title: null,
    locale: null,
    projectId: null,
    businessType: null,
  };

  // =========================================================
  // IMPORTANT LOG ONLY
  // =========================================================

  function important(...args) {
    console.log("%c[Anker Turbo]", "color:#1677ff;font-weight:bold", ...args);
  }

  // =========================================================
  // WORKER CHECK
  // =========================================================

  function isWorkerJobPage() {
    return /^#\/worker-job\/[^?]+/.test(location.hash);
  }

  // =========================================================
  // TASK TAB CHECK
  // =========================================================

  function isTaskPage() {
    return location.pathname === "/ssr/qa-task-start";
  }

  AT.task?.start();

  // =========================================================
  // GET CURRENT RECORD ID
  // =========================================================

  function getCurrentRecordId() {
    try {
      const recordId = new URLSearchParams(location.search).get("recordId");

      return recordId ? String(recordId) : null;
    } catch (_) {
      return null;
    }
  }

  window.__ankerTurboApiHook?.start({
    detectedConfig,
    isWorkerJobPage,
    getCurrentRecordId,
  });

  // =========================================================
  // WORKER INFO
  // =========================================================

  function getWorkerInfo() {
    const match = location.hash.match(/^#\/worker-job\/([^?]+)(?:\?(.*))?$/);

    if (!match) {
      return null;
    }

    const params = new URLSearchParams(match[2] || "");

    return {
      jobId: match[1],

      projectId: params.get("projectId"),

      businessType: params.get("businessType"),

      from: params.get("from"),
    };
  }

  // =========================================================
  // INITIALIZE WORKER
  // =========================================================

  function initializeWorkerInfo() {
    const info = getWorkerInfo();

    if (!info) {
      return;
    }

    if (info.jobId) {
      detectedConfig.jobId = info.jobId;
    }

    if (info.projectId) {
      detectedConfig.projectId = info.projectId;
    }

    if (info.businessType) {
      detectedConfig.businessType = info.businessType;
    }
  }

  // =========================================================
  // REQUEST DELAY
  // =========================================================

  function requestTurboDelay() {
    window.postMessage(
      {
        __ankerExtension: true,
        type: "GET_TURBO_DELAY",
      },
      "*",
    );
  }

  // =========================================================
  // REGISTER CONTROLLER
  // =========================================================

  function registerController() {
    window.postMessage(
      {
        __ankerExtension: true,
        type: "REGISTER_CONTROLLER",
      },
      "*",
    );
  }

  // =========================================================
  // START
  // =========================================================

  function startQueue() {
    if (queueRunning) {
      return;
    }

    queueRunning = true;

    openedCount = 0;

    completedCount = 0;

    registerController();

    requestTurboDelay();

    updateButton();

    important("START QUEUE");

    requestFill();
  }

  // =========================================================
  // STOP
  // =========================================================

  function stopQueue() {
    queueRunning = false;

    window.postMessage(
      {
        __ankerExtension: true,
        type: "STOP_QUEUE",
      },
      "*",
    );

    updateButton();

    important("STOP QUEUE");
  }

  // =========================================================
  // RESET
  // =========================================================

  function resetQueue() {
    queueRunning = false;

    openedCount = 0;
    completedCount = 0;

    activeTaskRecords.clear();
    pendingTaskRecords.clear();

    activeTaskCount = 0;
    pendingTaskCount = 0;

    window.postMessage(
      {
        __ankerExtension: true,
        type: "RESET_QUEUE",
      },
      "*",
    );

    updateButton();

    important("RESET");
  }

  // =========================================================
  // REQUEST FILL
  // =========================================================

  function requestFill() {
    if (!queueRunning) {
      return;
    }

    setTimeout(fillAvailableSlots, 100);
  }

  // =========================================================
  // FILL AVAILABLE
  // =========================================================

  function fillAvailableSlots() {
    if (!queueRunning) {
      return;
    }

    const rows = AT.worker.reviewRows.getReviewRows();

    const tasks = [];

    for (const row of rows) {
      const recordId = String(row.dataset.rowKey);

      // ================================================
      // TASK ĐANG ACTIVE
      // ================================================

      if (activeTaskRecords.has(recordId)) {
        continue;
      }

      // ================================================
      // TASK ĐANG NẰM TRONG PENDING POOL
      // ================================================

      if (pendingTaskRecords.has(recordId)) {
        continue;
      }

      const url = AT.worker.reviewUrl.createReviewUrl({
        recordId,
        detectedConfig,
        getWorkerInfo,
      });

      if (!url) {
        continue;
      }

      tasks.push({
        recordId,
        url,
      });
    }

    // ================================================
    // PRUNE: loại khỏi pending pool nếu:
    //
    // 1. Không còn hiển thị trên trang hiện tại (đã chuyển
    //    trang, task rời khỏi view hiện tại), HOẶC
    // 2. Vẫn hiển thị nhưng đã hoàn thành (Reviewed / Passed /
    //    Unqualified) - task xong rồi thì không cần mở tab
    //    nữa dù nó chưa kịp biến mất khỏi bảng.
    // ================================================

    const visibleStatusMap = AT.worker.reviewRows.getVisibleRowStatusMap();

    const toPrune = [];

    for (const recordId of pendingTaskRecords) {
      const info = visibleStatusMap.get(recordId);

      // Điều kiện 1: không còn hiển thị trên trang hiện tại
      if (!info) {
        toPrune.push(recordId);
        continue;
      }

      // Điều kiện 2: vẫn hiển thị nhưng đã hoàn thành
      if (info.completed) {
        toPrune.push(recordId);
      }
    }

    if (toPrune.length) {
      window.postMessage(
        {
          __ankerExtension: true,
          type: "PRUNE_POOL",
          recordIds: toPrune,
        },
        "*",
      );
    }

    if (!tasks.length) {
      return;
    }

    window.postMessage(
      {
        __ankerExtension: true,
        type: "FILL_QUEUE",
        tasks,
      },
      "*",
    );
  }

  // =========================================================
  // EXTENSION STATUS
  // =========================================================

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;

    if (!data || data.__ankerExtension !== true) {
      return;
    }

    // DELAY

    if (data.type === "TURBO_DELAY_RESPONSE") {
      const delay = Number(data.delay);

      if (Number.isFinite(delay) && delay >= MIN_TURBO_DELAY) {
        turboDelay = delay;
      }

      return;
    }

    // AUTO RELOAD SETTINGS

    if (data.type === "AUTO_RELOAD_SETTINGS_RESPONSE") {
      applyAutoReloadSettings(data.blankReload, data.maxAutoReload);
      return;
    }

    if (data.type === "AUTO_RELOAD_SETTINGS_CHANGED") {
      applyAutoReloadSettings(data.blankReload, data.maxAutoReload);
      return;
    }

    // -------------------------------------------------
    // CLOSED TASK
    //
    // Background đã đóng task.
    // Worker:
    // 1. Xóa record khỏi active
    // 2. Giảm slot đang dùng
    // 3. Scan lại pagination
    // 4. Mở task mới
    // -------------------------------------------------

    if (data.type === "CLOSED_TASK") {
      const recordId = String(data.recordId || "");

      // Xóa task vừa đóng
      if (recordId) {
        activeTaskRecords.delete(recordId);
      }

      completedCount++;

      // -------------------------------------------------
      // QUAN TRỌNG:
      // Bù ngay slot vừa trống
      // -------------------------------------------------

      if (queueRunning) {
        requestFill();
      }

      updateButton();

      return;
    }

    // QUEUE STATUS

    if (data.type === "QUEUE_STATUS") {
      activeTaskCount = Number(data.activeTabs) || 0;

      // ================================================
      // ACTIVE TASKS
      // ================================================

      if (Array.isArray(data.activeRecords)) {
        activeTaskRecords = new Set(data.activeRecords.map(String));
      }

      // ================================================
      // PENDING TASKS
      // ================================================

      if (Array.isArray(data.pendingRecords)) {
        pendingTaskRecords = new Set(data.pendingRecords.map(String));

        pendingTaskCount = pendingTaskRecords.size;
      } else {
        pendingTaskRecords.clear();

        pendingTaskCount = Number(data.queue) || 0;
      }

      // ================================================
      // AUTO FILL
      // ================================================

      if (queueRunning) {
        const concurrent = Number(data.concurrent) || 1;

        if (activeTaskCount < concurrent) {
          requestFill();
        }
      }

      updateButton();

      return;
    }

    // TASK COMPLETED

    if (data.type === "TASK_COMPLETED") {
      const recordId = String(data.recordId);

      activeTaskRecords.delete(recordId);

      completedCount++;

      if (queueRunning) {
        requestFill();
      }

      updateButton();
    }
  });

  // =========================================================
  // VIDEO PRELOAD & AUTOPLAY
  // =========================================================

  function createUI() {
    AT.worker.ui.create({
      onStart: startQueue,
      onStop: stopQueue,
    });
    updateButton();
  }

  function updateButton() {
    AT.worker.ui.update({
      queueRunning,
      activeTaskCount,
    });
  }

  // =========================================================
  // START UI
  // =========================================================

  async function startUI() {
    initializeWorkerInfo();

    if (isWorkerJobPage()) {
      if (document.body) {
        createUI();
        registerController();
        requestTurboDelay();
      }
      return;
    }

    // =====================================================
    // ONLY TASK TAB
    // /ssr/qa-task-start
    // =====================================================

    if (!isTaskPage()) {
      return;
    }

    // Task page
    requestAutoReloadSettings();
    window.__ankerTurboAnnotationWatcher?.start({
      isWorkerJobPage,
      important,
    });
    window.__ankerTurboVideoPreload?.start();
  }

  // =========================================================
  // DOM READY
  // =========================================================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startUI);
  } else {
    startUI();
  }

  // =========================================================
  // HASH CHANGE
  // =========================================================

  window.addEventListener("hashchange", () => {
    setTimeout(() => {
      if (isWorkerJobPage()) {
        initializeWorkerInfo();

        if (!document.getElementById("anker-next-review-container")) {
          createUI();
        }

        registerController();

        requestTurboDelay();
      }
    }, 300);
  });

  // =========================================================
  // DEBUG
  // =========================================================

  window.ankerReviewDebug = function () {
    console.table(detectedConfig);

    console.log({
      queueRunning,
      openedCount,
      completedCount,
      activeTaskCount,
      pendingTaskCount,
      activeRecords: [...activeTaskRecords],
      pendingRecords: [...pendingTaskRecords],
      delay: turboDelay,
    });
  };
})();
