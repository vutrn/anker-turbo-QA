"use strict";

// =========================================================
// ANKER TURBO BACKGROUND
// PERSISTENT / SELF-HEAL VERSION
//
// IMPORTANT:
// Manifest V3 Service Worker có thể bị Chrome terminate.
// State quan trọng được lưu trong chrome.storage.session.
//
// State được lưu:
// - queueEnabled
// - controllerTabId
// - pendingTasks
// - activeTasks
//
// Khi Service Worker chạy lại:
// - restore state
// - kiểm tra các tab task còn tồn tại
// - xóa mapping của tab đã đóng
// - tiếp tục queue
// =========================================================

// =========================================================
// CONFIG
// =========================================================

const DEFAULT_DELAY = 600;
const DEFAULT_CONCURRENT = 3;

const STATE_KEY = "ankerTurboRuntimeState";

const RECONCILE_ALARM = "ankerTurboReconcile";

// =========================================================
// RUNTIME STATE
// =========================================================

let controllerTabId = null;

let queueEnabled = false;

let pendingTasks = [];

// =========================================================
// OPEN COOLDOWN
// =========================================================

let nextTaskOpenAllowedAt = 0;

let openTimer = null;

// =========================================================
// ACTIVE TASKS
//
// tabId -> {
//     tabId,
//     recordId,
//     url,
//     status,
//     createdAt,
//     submitting,
//     invalid,
//     handled
// }
// =========================================================

const taskTabs = new Map();

// =========================================================
// RECORD -> TAB
// =========================================================

const recordToTab = new Map();

// =========================================================
// LOCK
// =========================================================

let fillingQueue = false;

// =========================================================
// STATE INITIALIZATION
// =========================================================

let stateReady = restoreState();

// =========================================================
// SETTINGS
// =========================================================

async function getSettings() {
  const result = await chrome.storage.local.get([
    "turboDelay",
    "concurrentTabs",
  ]);

  let delay = Number(result.turboDelay);

  let concurrent = Number(result.concurrentTabs);

  if (!Number.isFinite(delay)) {
    delay = DEFAULT_DELAY;
  }

  if (!Number.isFinite(concurrent)) {
    concurrent = DEFAULT_CONCURRENT;
  }

  return {
    delay: Math.max(100, delay),

    concurrent: Math.max(1, Math.min(50, Math.round(concurrent))),
  };
}

// =========================================================
// SLEEP
// =========================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =========================================================
// RESTORE STATE
// =========================================================

async function restoreState() {
  try {
    const result = await chrome.storage.session.get(STATE_KEY);

    const saved = result?.[STATE_KEY];

    if (!saved || typeof saved !== "object") {
      return;
    }

    // -----------------------------------------------------
    // BASIC STATE
    // -----------------------------------------------------

    queueEnabled = Boolean(saved.queueEnabled);

    nextTaskOpenAllowedAt = Number(saved.nextTaskOpenAllowedAt) || 0;

    controllerTabId = Number.isInteger(saved.controllerTabId)
      ? saved.controllerTabId
      : null;

    pendingTasks = Array.isArray(saved.pendingTasks)
      ? saved.pendingTasks
          .filter((task) => task && task.recordId && task.url)
          .map((task) => ({
            recordId: String(task.recordId),

            url: String(task.url),
          }))
      : [];

    // -----------------------------------------------------
    // ACTIVE TASKS
    // -----------------------------------------------------

    taskTabs.clear();

    recordToTab.clear();

    if (Array.isArray(saved.activeTasks)) {
      for (const task of saved.activeTasks) {
        if (!task || !Number.isInteger(task.tabId) || !task.recordId) {
          continue;
        }

        const tabId = task.tabId;

        const state = {
          tabId,

          recordId: String(task.recordId),

          url: String(task.url || ""),

          status: task.status || "loading",

          createdAt: Number(task.createdAt) || Date.now(),

          submitting: Boolean(task.submitting),

          invalid: Boolean(task.invalid),

          handled: Boolean(task.handled),
        };

        taskTabs.set(tabId, state);

        recordToTab.set(state.recordId, tabId);
      }
    }

    // -----------------------------------------------------
    // Remove tasks whose tabs no longer exist
    // -----------------------------------------------------

    await reconcileTabsInternal();

    await persistState();
  } catch (error) {
    console.error("[Anker Turbo] State restore error:", error);
  }
}

// =========================================================
// INTERNAL RECONCILE
// Không được await stateReady ở đây,
// vì hàm này được gọi trong restoreState().
// =========================================================

async function reconcileTabsInternal() {
  const tabs = await chrome.tabs.query({});

  const existingTabIds = new Set(
    tabs.map((tab) => tab.id).filter((id) => id !== undefined),
  );

  for (const tabId of [...taskTabs.keys()]) {
    if (!existingTabIds.has(tabId)) {
      removeTaskMapping(tabId);
    }
  }
}

// =========================================================
// PERSIST STATE
// =========================================================

async function persistState() {
  try {
    const activeTasks = [...taskTabs.values()].map((task) => ({
      tabId: task.tabId,

      recordId: String(task.recordId),

      url: task.url || "",

      status: task.status || "",

      createdAt: task.createdAt || Date.now(),

      submitting: Boolean(task.submitting),

      invalid: Boolean(task.invalid),

      handled: Boolean(task.handled),
    }));

    await chrome.storage.session.set({
      [STATE_KEY]: {
        queueEnabled: Boolean(queueEnabled),

        controllerTabId,

        nextTaskOpenAllowedAt,

        pendingTasks: pendingTasks.map((task) => ({
          recordId: String(task.recordId),

          url: String(task.url),
        })),

        activeTasks,
      },
    });
  } catch (error) {
    console.error("[Anker Turbo] State save error:", error);
  }
}

// =========================================================
// CONTROLLER
// =========================================================

function setController(tabId) {
  controllerTabId = tabId;
}

// =========================================================
// OPEN TASK
// =========================================================

async function openTask(task) {
  if (!task || !task.url || !task.recordId) {
    return null;
  }

  const recordId = String(task.recordId);

  // ---------------------------------------------------------
  // Already open
  // ---------------------------------------------------------

  const existingTabId = recordToTab.get(recordId);

  if (existingTabId !== undefined) {
    const existingTask = taskTabs.get(existingTabId);

    if (existingTask) {
      return null;
    }

    recordToTab.delete(recordId);
  }

  // ---------------------------------------------------------
  // Create background tab
  // ---------------------------------------------------------

  try {
    const tab = await chrome.tabs.create({
      url: task.url,

      active: false,
    });

    if (!tab || tab.id === undefined) {
      return null;
    }

    const tabId = tab.id;

    const state = {
      tabId,

      recordId,

      url: task.url,

      status: "loading",

      createdAt: Date.now(),

      submitting: false,

      invalid: false,

      handled: false,
    };

    taskTabs.set(tabId, state);

    recordToTab.set(recordId, tabId);

    await persistState();

    return tab;
  } catch (error) {
    console.error("[Anker Turbo] openTask error:", error);

    return null;
  }
}

// =========================================================
// REMOVE TASK MAPPING
// =========================================================

function removeTaskMapping(tabId) {
  const task = taskTabs.get(tabId);

  if (!task) {
    return null;
  }

  taskTabs.delete(tabId);

  recordToTab.delete(String(task.recordId));

  return task;
}

// =========================================================
// APPEND PENDING TASKS
// =========================================================

function appendPendingTasks(tasks) {
  if (!Array.isArray(tasks)) {
    return;
  }

  for (const task of tasks) {
    if (!task || !task.recordId || !task.url) {
      continue;
    }

    const recordId = String(task.recordId);

    // Already active
    if (recordToTab.has(recordId)) {
      continue;
    }

    // Already pending
    const exists = pendingTasks.some(
      (item) => String(item.recordId) === recordId,
    );

    if (exists) {
      continue;
    }

    pendingTasks.push({
      recordId,

      url: String(task.url),
    });
  }
}

// =========================================================
// FILL TASKS
//
// Delay áp dụng cho TẤT CẢ lần mở task:
//
// - START QUEUE
// - Task submit → đóng → task mới
// - Invalid task → đóng → task mới
// - Worker FILL_QUEUE
// =========================================================

async function fillPendingTasks() {
  await stateReady;

  if (fillingQueue || !queueEnabled) {
    return;
  }

  if (!pendingTasks.length) {
    return;
  }

  fillingQueue = true;

  try {
    const settings = await getSettings();

    while (
      queueEnabled &&
      taskTabs.size < settings.concurrent &&
      pendingTasks.length > 0
    ) {
      // -------------------------------------------------
      // COOLDOWN
      // -------------------------------------------------

      const now = Date.now();

      const wait = Math.max(0, nextTaskOpenAllowedAt - now);

      if (wait > 0) {
        await sleep(wait);
      }

      // Queue có thể đã STOP trong lúc chờ
      if (!queueEnabled) {
        break;
      }

      if (taskTabs.size >= settings.concurrent) {
        break;
      }

      if (!pendingTasks.length) {
        break;
      }

      // -------------------------------------------------
      // LẤY TASK
      // -------------------------------------------------

      const task = pendingTasks.shift();

      if (!task) {
        continue;
      }

      const recordId = String(task.recordId);

      // -------------------------------------------------
      // DUPLICATE
      // -------------------------------------------------

      if (recordToTab.has(recordId)) {
        continue;
      }

      // -------------------------------------------------
      // OPEN
      // -------------------------------------------------

      const opened = await openTask(task);

      if (!opened) {
        pendingTasks.unshift(task);

        break;
      }

      // -------------------------------------------------
      // ĐẶT COOLDOWN CHO LẦN MỞ TIẾP THEO
      // -------------------------------------------------

      await notifyController();

      nextTaskOpenAllowedAt = Date.now() + settings.delay;

      await persistState();

      // -------------------------------------------------
      // Không cần sleep ở đây nữa.
      // Vòng lặp tiếp theo sẽ tự chờ
      // tới nextTaskOpenAllowedAt.
      // -------------------------------------------------
    }
  } catch (error) {
    console.error("[Anker Turbo] fillPendingTasks error:", error);
  } finally {
    fillingQueue = false;
  }

  console.log(
  "%c[Anker Turbo] POOL",
  "color:#722ed1;font-weight:bold",
  `pending=${pendingTasks.length}`,
  pendingTasks.map((x) => x.recordId),
);

  notifyController();
}

// =========================================================
// BUMP COOLDOWN (gọi cả khi OPEN lẫn khi CLOSE)
// =========================================================
async function bumpCooldown() {
  const settings = await getSettings();
  const candidate = Date.now() + settings.delay;
  if (candidate > nextTaskOpenAllowedAt) {
    nextTaskOpenAllowedAt = candidate;
  }
}

// =========================================================
// SUBMIT SUCCESS
// =========================================================

async function handleTaskSubmitSuccess(tabId) {
  await stateReady;

  const task = taskTabs.get(tabId);

  if (!task) {
    return false;
  }

  if (task.handled || task.submitting) {
    return false;
  }

  task.handled = true;

  task.submitting = true;

  task.status = "submitted";

  const recordId = String(task.recordId);

  // ---------------------------------------------------------
  // Remove state BEFORE closing tab
  // ---------------------------------------------------------

  removeTaskMapping(tabId);
  await bumpCooldown();
  await persistState();

  // ---------------------------------------------------------
  // Close tab
  // ---------------------------------------------------------

  try {
    await chrome.tabs.remove(tabId);
  } catch (_) {
    // Already closed
  }

  await sleep(150);

  // ---------------------------------------------------------
  // Tell Worker which task closed
  // ---------------------------------------------------------

  await notifyController({
    type: "CLOSED_TASK",
    recordId,
  });

  // ---------------------------------------------------------
  // Fill pending tasks if any
  // ---------------------------------------------------------

  await fillPendingTasks();
  return true;
}

// =========================================================
// INVALID TASK PAGE
// =========================================================

async function handleInvalidTaskPage(tabId) {
  await stateReady;

  const task = taskTabs.get(tabId);

  if (!task) {
    return false;
  }

  if (task.handled || task.invalid) {
    return false;
  }

  task.handled = true;
  task.invalid = true;
  task.status = "invalid";

  const recordId = String(task.recordId);

  // ---------------------------------------------------------
  // Remove mapping
  // ---------------------------------------------------------

  removeTaskMapping(tabId);
  await bumpCooldown();
  await persistState();

  // ---------------------------------------------------------
  // Close invalid tab
  // ---------------------------------------------------------

  try {
    await chrome.tabs.remove(tabId);
  } catch (_) {}

  await sleep(150);

  // ---------------------------------------------------------
  // Worker can scan again
  // ---------------------------------------------------------

  await notifyController({
    type: "CLOSED_TASK",

    recordId,
  });

  await fillPendingTasks();

  return true;
}

// =========================================================
// TAB CLOSED
// =========================================================

async function handleTabClosed(tabId) {
  await stateReady;

  const task = taskTabs.get(tabId);

  if (!task) {
    return;
  }

  removeTaskMapping(tabId);
  await bumpCooldown();
  await persistState();

  // ---------------------------------------------------------
  // Important:
  //
  // Manual close itself does not immediately create a new task.
  // The next FILL_QUEUE from Worker handles it.
  // ---------------------------------------------------------
}

// =========================================================
// TAB REMOVED
// =========================================================

chrome.tabs.onRemoved.addListener((tabId) => {
  handleTabClosed(tabId).catch(() => {});
});

// =========================================================
// TAB UPDATED
// =========================================================

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  stateReady.then(async () => {
    const task = taskTabs.get(tabId);

    if (!task) {
      return;
    }

    if (changeInfo.status) {
      task.status = changeInfo.status;
    }

    if (changeInfo.url) {
      task.url = changeInfo.url;
    }

    await persistState();
  });
});

// =========================================================
// RECONCILE REAL CHROME TABS
// =========================================================

async function reconcileTabs(notify = true) {
  await stateReady;

  await reconcileTabsInternal();

  await persistState();

  if (notify) {
    notifyController();
  }
}

// =========================================================
// MESSAGE HANDLER
// =========================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) {
    return;
  }

  // =====================================================
  // REGISTER CONTROLLER
  // =====================================================

  if (message.type === "REGISTER_CONTROLLER") {
    stateReady.then(async () => {
      if (sender.tab?.id !== undefined) {
        setController(sender.tab.id);
      }

      queueEnabled = true;

      await persistState();

      await reconcileTabs();

      notifyController();

      sendResponse({
        ok: true,
      });
    });

    return true;
  }

  // =====================================================
  // START QUEUE
  // =====================================================

  if (message.type === "START_QUEUE") {
    stateReady
      .then(async () => {
        if (sender.tab?.id !== undefined) {
          setController(sender.tab.id);
        }

        queueEnabled = true;

        appendPendingTasks(message.tasks || []);

        await persistState();

        await fillPendingTasks();

        sendResponse({
          ok: true,

          activeTabs: taskTabs.size,

          pending: pendingTasks.length,
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,

          error: String(error),
        });
      });

    return true;
  }

  // =====================================================
  // FILL QUEUE
  // =====================================================

  if (message.type === "FILL_QUEUE") {
    stateReady
      .then(async () => {
        if (!queueEnabled) {
          sendResponse({
            ok: false,

            error: "Queue is stopped",
          });

          return;
        }

        if (sender.tab?.id !== undefined) {
          setController(sender.tab.id);
        }

        appendPendingTasks(message.tasks || []);

        await persistState();

        await fillPendingTasks();

        sendResponse({
          ok: true,

          activeTabs: taskTabs.size,

          pending: pendingTasks.length,
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,

          error: String(error),
        });
      });

    return true;
  }

  // =====================================================
  // STOP
  // =====================================================

  if (message.type === "STOP_QUEUE") {
    stateReady.then(async () => {
      queueEnabled = false;

      pendingTasks = [];

      await persistState();

      notifyController();

      sendResponse({
        ok: true,
      });
    });

    return true;
  }

  // =====================================================
  // RESET
  // =====================================================

  if (message.type === "RESET_QUEUE") {
    stateReady.then(async () => {
      queueEnabled = false;

      pendingTasks = [];

      await persistState();

      notifyController();

      sendResponse({
        ok: true,
      });
    });

    return true;
  }

  // =====================================================
  // TASK SUBMIT
  // =====================================================

  if (message.type === "TASK_SUBMIT_SUCCESS") {
    const tabId = sender.tab?.id;

    if (tabId === undefined) {
      sendResponse({
        ok: false,
      });

      return;
    }

    handleTaskSubmitSuccess(tabId)
      .then((success) => {
        sendResponse({
          ok: success,
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,

          error: String(error),
        });
      });

    return true;
  }

  // =====================================================
  // INVALID TASK
  // =====================================================

  if (message.type === "INVALID_TASK_PAGE") {
    const tabId = sender.tab?.id;

    if (tabId === undefined) {
      sendResponse({
        ok: false,
      });

      return;
    }

    handleInvalidTaskPage(tabId)
      .then((success) => {
        sendResponse({
          ok: success,
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,

          error: String(error),
        });
      });

    return true;
  }

  // =====================================================
  // GET DELAY
  // =====================================================

  if (message.type === "GET_TURBO_DELAY") {
    chrome.storage.local.get("turboDelay").then((result) => {
      sendResponse({
        delay: Number(result.turboDelay) || DEFAULT_DELAY,
      });
    });

    return true;
  }

  // =====================================================
  // GET STATUS
  // =====================================================

  if (message.type === "GET_QUEUE_STATUS") {
    stateReady.then(getSettings).then((settings) => {
      sendResponse({
        ok: true,

        activeTabs: taskTabs.size,

        pending: pendingTasks.length,

        concurrent: settings.concurrent,

        delay: settings.delay,
      });
    });

    return true;
  }
});

// =========================================================
// NOTIFY WORKER
// =========================================================

async function notifyController(extra = {}) {
  await stateReady;

  if (controllerTabId === null) {
    return;
  }

  try {
    const settings = await getSettings();

    const activeTasks = [...taskTabs.values()];

    await chrome.tabs.sendMessage(
      controllerTabId,

      {
        type: extra.type || "QUEUE_STATUS",

        recordId: extra.recordId || null,

        activeTabs: activeTasks.length,

        queue: pendingTasks.length,

        concurrent: settings.concurrent,

        delay: settings.delay,

        activeRecords: activeTasks.map((task) => String(task.recordId)),

        activeTasks: activeTasks.map((task) => ({
          tabId: task.tabId,

          recordId: task.recordId,

          status: task.status,
        })),
      },
    );
  } catch (_) {
    // Worker đang reload/chưa ready
  }
}

// =========================================================
// SELF-HEAL
// =========================================================

async function selfHeal() {
  await stateReady;

  if (!queueEnabled) {
    return;
  }

  await reconcileTabs(false);

  // Nếu còn pending, mở tiếp.
  if (pendingTasks.length) {
    await fillPendingTasks();
  }

  notifyController();
}

// =========================================================
// ALARM
//
// MV3 Service Worker có thể ngủ.
// Alarm đánh thức worker và self-heal.
//
// Chrome yêu cầu alarm interval tối thiểu 30s trên Chrome 120+.
// =========================================================

async function ensureReconcileAlarm() {
  try {
    const existing = await chrome.alarms.get(RECONCILE_ALARM);

    if (!existing) {
      await chrome.alarms.create(RECONCILE_ALARM, {
        periodInMinutes: 0.5,

        persistAcrossSessions: true,
      });
    }
  } catch (_) {
    // Ignore
  }
}

// =========================================================
// ALARM HANDLER
// =========================================================

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== RECONCILE_ALARM) {
    return;
  }

  selfHeal().catch(() => {});
});

// =========================================================
// STARTUP
// =========================================================

stateReady.then(async () => {
  await ensureReconcileAlarm();

  await reconcileTabs(false);
});

// =========================================================
// INSTALL / UPDATE
// =========================================================

chrome.runtime.onInstalled.addListener(() => {
  ensureReconcileAlarm().catch(() => {});
});

// =========================================================
// BROWSER START
// =========================================================

chrome.runtime.onStartup.addListener(() => {
  ensureReconcileAlarm().catch(() => {});
});
