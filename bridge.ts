"use strict";

const NEXT_TAB_MESSAGE =
  globalThis.AnkerTurbo?.MSG?.NEXT_TAB || "NEXT_TAB";
const HOTKEY_SETTINGS_REQUEST = "GET_HOTKEY_SETTINGS";
const HOTKEY_SETTINGS_RESPONSE = "HOTKEY_SETTINGS_RESPONSE";
const SUBMIT_HOTKEY_SETTINGS_RESPONSE = "SUBMIT_HOTKEY_SETTINGS_RESPONSE";
const COUNTER_SETTINGS_RESPONSE = "COUNTER_SETTINGS_RESPONSE";
const COUNTER_INCLUDE_REWORK_KEY = "counterIncludeRework";

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
    chrome.runtime.sendMessage(message).catch((error) => {
      console.error("[Anker Turbo] Background message failed:", error);
    });
  } catch (error) {
    console.error("[Anker Turbo] Failed to send background message:", error);
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
  // PRUNE POOL
  // =====================================================

  if (data.type === "PRUNE_POOL") {
    sendToBackground({
      type: "PRUNE_POOL",
      recordIds: Array.isArray(data.recordIds) ? data.recordIds : [],
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

  if (data.type === "GET_COUNTER_SETTINGS") {
    try {
      chrome.storage.local
        .get(COUNTER_INCLUDE_REWORK_KEY)
        .then((result) => {
          window.postMessage(
            {
              __ankerExtension: true,
              type: COUNTER_SETTINGS_RESPONSE,
              counterIncludeRework: Boolean(result[COUNTER_INCLUDE_REWORK_KEY]),
            },
            "*",
          );
        })
        .catch((error) => {
          console.error("[Anker Turbo] Failed to load counter settings:", error);
        });
    } catch (error) {
      console.error("[Anker Turbo] Failed to request counter settings:", error);
    }

    return;
  }

  if (data.type === HOTKEY_SETTINGS_REQUEST) {
    try {
      chrome.storage.local
        .get(["hotkeyFail", "hotkeyPass"])
        .then((result) => {
          window.postMessage(
            {
              __ankerExtension: true,
              type: HOTKEY_SETTINGS_RESPONSE,
              hotkeyFail: result.hotkeyFail ?? "KeyE",
              hotkeyPass: result.hotkeyPass ?? "KeyR",
            },
            "*",
          );
        })
        .catch(() => {});
    } catch (_) {}

    return;
  }

  if (data.type === "GET_SUBMIT_HOTKEY_SETTINGS") {
    try {
      chrome.storage.local
        .get("hotkeySubmit")
        .then((result) => {
          window.postMessage(
            {
              __ankerExtension: true,
              type: SUBMIT_HOTKEY_SETTINGS_RESPONSE,
              hotkeySubmit: result.hotkeySubmit ?? "Backquote",
            },
            "*",
          );
        })
        .catch((error) => {
          console.error("[Anker Turbo] Failed to load submit shortcut:", error);
        });
    } catch (error) {
      console.error("[Anker Turbo] Failed to request submit shortcut:", error);
    }

    return;
  }

  // =====================================================
  // SWITCH TO NEXT TAB
  // =====================================================

  if (data.type === NEXT_TAB_MESSAGE) {
    sendToBackground({
      type: NEXT_TAB_MESSAGE,
    });

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

    const relevantKeys = [
      "blankReload",
      "maxAutoReload",
      "antiIdleEnabled",
      "counterEnabled",
      "counterIncludeRework",
      "hotkeyFail",
      "hotkeyPass",
      "hotkeySubmit",
    ];

    if (!relevantKeys.some((key) => changes[key])) return;

    chrome.storage.local.get(relevantKeys).then((settings) => {
      window.postMessage(
        {
          __ankerExtension: true,
          type: "SETTINGS_CHANGED",
          settings,
        },
        "*",
      );
    }).catch((error) => {
      console.error("[Anker Turbo] Failed to broadcast settings changes:", error);
    });

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
