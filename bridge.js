"use strict";

// =========================================================
// ANKER TURBO BRIDGE
// =========================================================

// =========================================================
// CHECK WORKER PAGE
// =========================================================

function isWorkerPage() {
  return /^#\/worker-job\/[^?]+/.test(location.hash);
}

// =========================================================
// SEND TO BACKGROUND
// =========================================================

function sendToBackground(message) {
  try {
    chrome.runtime.sendMessage(message).catch(() => {});
  } catch (_) {
    // Ignore
  }
}

// =========================================================
// PAGE → EXTENSION
// =========================================================

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }

  const data = event.data;

  if (!data || data.__ankerExtension !== true) {
    return;
  }

  // =====================================================
  // REGISTER CONTROLLER
  // =====================================================

  if (data.type === "REGISTER_CONTROLLER") {
    sendToBackground({
      type: "REGISTER_CONTROLLER",
    });

    return;
  }

  // =====================================================
  // START QUEUE
  // =====================================================

  if (data.type === "START_QUEUE") {
    sendToBackground({
      type: "START_QUEUE",

      tasks: Array.isArray(data.tasks) ? data.tasks : [],
    });

    return;
  }

  // =====================================================
  // FILL QUEUE
  // =====================================================

  if (data.type === "FILL_QUEUE") {
    sendToBackground({
      type: "FILL_QUEUE",
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
    });

    return;
  }

  // =====================================================
  // STOP QUEUE
  // =====================================================

  if (data.type === "STOP_QUEUE") {
    sendToBackground({
      type: "STOP_QUEUE",
    });

    return;
  }

  // =====================================================
  // RESET QUEUE
  // =====================================================

  if (data.type === "RESET_QUEUE") {
    sendToBackground({
      type: "RESET_QUEUE",
    });

    return;
  }

  // =====================================================
  // TASK SUBMIT SUCCESS
  //
  // Task tab:
  // KHÔNG LOG
  // Chỉ gửi background.
  // =====================================================

  if (data.type === "TASK_SUBMIT_SUCCESS") {
    sendToBackground({
      type: "TASK_SUBMIT_SUCCESS",

      recordId: data.recordId || null,

      msgIds: data.msgIds || [],

      jobId: data.jobId || null,

      taskType: data.taskType || null,

      duration: data.duration || null,
    });

    return;
  }

  // =====================================================
  // INVALID TASK PAGE
  // =====================================================

  if (data.type === "INVALID_TASK_PAGE") {
    if (isWorkerPage()) {
      return;
    }

    console.warn("[Anker Turbo] INVALID TASK PAGE");

    sendToBackground({
      type: "INVALID_TASK_PAGE",
    });

    return;
  }

  // =====================================================
  // GET DELAY
  // =====================================================

  if (data.type === "GET_TURBO_DELAY") {
    try {
      chrome.runtime
        .sendMessage({
          type: "GET_TURBO_DELAY",
        })
        .then((response) => {
          window.postMessage(
            {
              __ankerExtension: true,

              type: "TURBO_DELAY_RESPONSE",

              delay: response?.delay || 600,
            },
            "*",
          );
        })
        .catch(() => {});
    } catch (_) {}

    return;
  }

  // =====================================================
  // GET DELAY
  // =====================================================

  if (data.type === "GET_AUTO_RELOAD_SETTINGS") {
    try {
      chrome.storage.local
        .get(["blankReload", "maxAutoReload"])
        .then((result) => {
          window.postMessage(
            {
              __ankerExtension: true,
              type: "AUTO_RELOAD_SETTINGS_RESPONSE",
              blankReload: result.blankReload,
              maxAutoReload: result.maxAutoReload,
            },
            "*",
          );
        })
        .catch(() => {});
    } catch (_) {}

    return;
  }
});

// =========================================================
// EXTENSION → PAGE
// =========================================================

try {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message) {
      return;
    }

    // =================================================
    // CLOSED TASK
    //
    // CHỈ WORKER MỚI LOG
    // =================================================

    if (message.type === "CLOSED_TASK") {
      if (!isWorkerPage()) {
        return;
      }

      const recordId = String(message.recordId || "UNKNOWN");

      console.log(
        "%c[Anker Turbo] CLOSED TASK → " + recordId,
        "color:#3368A0;font-weight:bold",
      );

      window.postMessage(
        {
          __ankerExtension: true,

          type: "CLOSED_TASK",

          recordId,
        },

        "*",
      );

      return;
    }

    // =================================================
    // QUEUE STATUS
    // =================================================

    if (message.type !== "QUEUE_STATUS") return;

    window.postMessage(
      {
        __ankerExtension: true,
        type: "QUEUE_STATUS",
        activeTabs: message.activeTabs || 0,
        queue: message.queue || 0,
        concurrent: message.concurrent || 0,
        delay: message.delay || 600,
        activeRecords: message.activeRecords || [],
        pendingRecords: message.pendingRecords || [],
        activeTasks: message.activeTasks || [],
      },
      "*",
    );
  });
} catch (_) {
  // Ignore
}

// =========================================================
// LIVE UPDATE: AUTO RELOAD SETTINGS   <-- THÊM MỚI TỪ ĐÂY
// =========================================================

try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;

    if (!changes.blankReload && !changes.maxAutoReload) return;

    window.postMessage(
      {
        __ankerExtension: true,
        type: "AUTO_RELOAD_SETTINGS_CHANGED",
        blankReload: changes.blankReload
          ? changes.blankReload.newValue
          : undefined,
        maxAutoReload: changes.maxAutoReload
          ? changes.maxAutoReload.newValue
          : undefined,
      },
      "*",
    );
  });
} catch (_) {}
