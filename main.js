// =========================================================
// ANKER TURBO - MAIN.JS
// Clean Console Version
// =========================================================

(function () {
  "use strict";

  // =========================================================
  // CONFIG
  // =========================================================

  const DEFAULT_TURBO_DELAY = 600;
  const MIN_TURBO_DELAY = 100;

  const ANNOTATION_IFRAME_SELECTOR =
    'iframe[src="/ssr/tools/video-track-v2.html"]';

  const MULTIPLE_TASK_WARNING_TEXT =
    "Note: Please do not open multiple task page";

  // =========================================================
  // STATE
  // =========================================================

  let turboDelay = DEFAULT_TURBO_DELAY;

  let queueRunning = false;
  const DEFAULT_ANNOTATION_LOAD_TIMEOUT = 8000;
  const DEFAULT_MAX_AUTO_RELOAD = 3;

  const ANNOTATION_CHECK_INTERVAL = 500;

  let annotationLoadTimeout = DEFAULT_ANNOTATION_LOAD_TIMEOUT;

  let maxAutoReload = DEFAULT_MAX_AUTO_RELOAD;

  let annotationWatcher = null;
  let annotationBlankSince = null;

  let multipleTaskWarningWatcher = null;

  let submitSuccessReported = false;
  let invalidTaskReported = false;
  let currentRecordId = null;

  let activeTaskRecords = new Set();
  let pendingTaskRecords = new Set();

  let activeTaskCount = 0;
  let pendingTaskCount = 0;

  let openedCount = 0;
  let completedCount = 0;

  let nextButton = null;

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
    const b = Number(blankReload);
    const m = Number(maxReload);

    if (Number.isFinite(b)) {
      annotationLoadTimeout = Math.max(1000, Math.min(60000, Math.round(b)));
    }

    if (Number.isFinite(m)) {
      maxAutoReload = Math.max(0, Math.min(20, Math.round(m)));
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
  // SCAN OBJECT
  // =========================================================

  function scanObject(obj, depth = 0) {
    if (depth > 30 || !obj || typeof obj !== "object") {
      return;
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        scanObject(item, depth + 1);
      }

      return;
    }

    // FLOW ID

    if (obj.flowId !== undefined && obj.flowId !== null) {
      const flowId = String(obj.flowId).trim();

      if (flowId) {
        detectedConfig.flowId = flowId;
      }
    }

    // TITLE

    if (typeof obj.title === "string") {
      const title = obj.title.trim();

      if (title && (title.includes("审核") || title.length > 5)) {
        detectedConfig.title = title;
      }
    }

    // LOCALE

    if (typeof obj.locale === "string") {
      const locale = obj.locale.trim();

      if (locale) {
        detectedConfig.locale = locale;
      }
    }

    // JOB ID

    if (obj.jobId !== undefined && obj.jobId !== null) {
      detectedConfig.jobId = String(obj.jobId).trim();
    }

    // PROJECT ID

    if (obj.projectId !== undefined && obj.projectId !== null) {
      detectedConfig.projectId = String(obj.projectId).trim();
    }

    // BUSINESS TYPE

    if (typeof obj.businessType === "string") {
      const businessType = obj.businessType.trim();

      if (businessType) {
        detectedConfig.businessType = businessType;
      }
    }

    // RECURSIVE

    for (const key of Object.keys(obj)) {
      try {
        const value = obj[key];

        if (value && typeof value === "object") {
          scanObject(value, depth + 1);
        }
      } catch (_) {}
    }
  }

  // =========================================================
  // PROCESS API DATA
  // =========================================================

  function processApiData(data) {
    if (!data) {
      return;
    }

    try {
      if (typeof data === "string") {
        const text = data.trim();

        if (!text) {
          return;
        }

        if (text.startsWith("{") || text.startsWith("[")) {
          scanObject(JSON.parse(text));
        }

        return;
      }

      if (typeof data === "object") {
        scanObject(data);
      }
    } catch (_) {}
  }

  // =========================================================
  // SUBMIT API CHECK
  // =========================================================

  function isSubmitApi(url, method) {
    if (!url) {
      return false;
    }

    if (String(method || "").toUpperCase() !== "POST") {
      return false;
    }

    try {
      const absoluteUrl = new URL(String(url), location.origin);

      return absoluteUrl.pathname === "/api/task-submit";
    } catch (_) {
      return String(url).includes("/api/task-submit");
    }
  }

  // =========================================================
  // REPORT SUBMIT SUCCESS
  // =========================================================

  function reportSubmitSuccess(url) {
    if (isWorkerJobPage()) {
      return;
    }

    if (submitSuccessReported) {
      return;
    }

    submitSuccessReported = true;

    console.log(
      "%c[Anker Turbo] SEND SUBMIT → BRIDGE",
      "color:#fa8c16;font-weight:bold",
      {
        recordId: currentRecordId,

        url: location.href,
      },
    );

    window.postMessage(
      {
        __ankerExtension: true,

        type: "TASK_SUBMIT_SUCCESS",

        recordId: currentRecordId,
      },
      "*",
    );
  }

  // =========================================================
  // FETCH HOOK
  // =========================================================

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const requestUrl = typeof args[0] === "string" ? args[0] : args[0]?.url;

      const requestMethod =
        args[0] instanceof Request ? args[0].method : args[1]?.method || "GET";

      // API DATA SCAN

      const clone = response.clone();

      const contentType = clone.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        clone
          .json()
          .then((data) => {
            processApiData(data);
          })
          .catch(() => {});
      } else {
        clone
          .text()
          .then((text) => {
            processApiData(text);
          })
          .catch(() => {});
      }

      // SUBMIT

      if (isSubmitApi(requestUrl, requestMethod)) {
        if (response.status >= 200 && response.status < 300) {
          reportSubmitSuccess(requestUrl);
        }
      }
    } catch (_) {}

    return response;
  };

  // =========================================================
  // XHR HOOK
  // =========================================================

  const originalOpen = XMLHttpRequest.prototype.open;

  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__ankerMethod = method;

    this.__ankerUrl = url;

    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        processApiData(this.responseText);

        if (isSubmitApi(this.__ankerUrl, this.__ankerMethod)) {
          if (this.status >= 200 && this.status < 300) {
            reportSubmitSuccess(this.__ankerUrl);
          }
        }
      } catch (_) {}
    });

    return originalSend.apply(this, args);
  };

  // =========================================================
  // GET REVIEW ROWS
  // =========================================================

  function getReviewRows() {
    return [
      ...document.querySelectorAll("tbody.ant-table-tbody tr.ant-table-row"),
    ].filter((row) => {
      if (row.getAttribute("aria-hidden") === "true") {
        return false;
      }

      const recordId = row.dataset.rowKey;

      if (!recordId) {
        return false;
      }

      const cells = row.querySelectorAll("td.ant-table-cell");

      if (cells.length < 5) {
        return false;
      }

      const dataStatus = cells[2].textContent.trim().toLowerCase();

      const reviewConclusion = cells[3].textContent.trim().toLowerCase();

      // Reviewed → không mở

      if (dataStatus === "reviewed") {
        return false;
      }

      // Passed → không mở

      if (reviewConclusion === "passed") {
        return false;
      }

      // Chỉ task chưa hoàn thành

      const canReview =
        dataStatus === "to be submitted" ||
        dataStatus === "assigned for collection";

      if (!canReview) {
        return false;
      }

      // Review button

      const reviewButton = cells[4].querySelector("button.ant-btn-link");

      if (!reviewButton) {
        return false;
      }

      if (reviewButton.textContent.trim().toLowerCase() !== "review") {
        return false;
      }

      if (reviewButton.offsetParent === null) {
        return false;
      }

      return true;
    });
  }

  // =========================================================
  // GET VISIBLE ROW STATUS MAP (trang hiện tại)
  //
  // Lấy toàn bộ recordId đang hiển thị trên trang hiện tại,
  // kèm theo việc nó đã hoàn thành (Reviewed / Passed /
  // Unqualified) hay chưa. Dùng để quyết định prune pool
  // theo 2 điều kiện:
  //
  // 1. Không còn hiển thị trên trang hiện tại nữa → prune.
  // 2. Vẫn hiển thị nhưng đã hoàn thành (Reviewed/Passed/
  //    Unqualified) → cũng prune, vì task đã xong không cần
  //    mở tab nữa dù nó chưa kịp biến mất khỏi bảng.
  // =========================================================

  function getVisibleRowStatusMap() {
    const rows = [
      ...document.querySelectorAll("tbody.ant-table-tbody tr.ant-table-row"),
    ];

    const map = new Map();

    for (const row of rows) {
      if (row.getAttribute("aria-hidden") === "true") continue;

      const recordId = row.dataset.rowKey;
      if (!recordId) continue;

      const cells = row.querySelectorAll("td.ant-table-cell");
      if (cells.length < 5) continue;

      const dataStatus = cells[2].textContent.trim().toLowerCase();
      const reviewConclusion = cells[3].textContent.trim().toLowerCase();

      // Reviewed = đã có kết luận (Passed hoặc Unqualified).
      // Kiểm tra cả dataStatus lẫn reviewConclusion để chắc chắn
      // không bỏ sót trường hợp nào.

      const completed =
        dataStatus === "reviewed" ||
        reviewConclusion === "passed" ||
        reviewConclusion === "unqualified";

      map.set(String(recordId), { completed });
    }

    return map;
  }

  // =========================================================
  // CREATE REVIEW URL
  // =========================================================

  function createReviewUrl(recordId) {
    const worker = getWorkerInfo();

    if (!worker) {
      return null;
    }

    const jobId = detectedConfig.jobId || worker.jobId;

    const projectId = detectedConfig.projectId || worker.projectId;

    const businessType =
      detectedConfig.businessType || worker.businessType || "WORK";

    const locale = detectedConfig.locale || "en-US";

    const flowId = detectedConfig.flowId;

    const title = detectedConfig.title;

    if (!jobId || !projectId || !flowId || !title || !recordId) {
      return null;
    }

    const url = new URL("/ssr/qa-task-start", location.origin);

    url.searchParams.set("jobId", jobId);

    url.searchParams.set("jobType", "REVIEW");

    url.searchParams.set("locale", locale);

    url.searchParams.set("flowId", flowId);

    url.searchParams.set("title", title);

    url.searchParams.set("projectId", projectId);

    url.searchParams.set("recordId", recordId);

    url.searchParams.set("businessType", businessType);

    return url.href;
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

    const rows = getReviewRows();

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

      const url = createReviewUrl(recordId);

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

    const visibleStatusMap = getVisibleRowStatusMap();

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
  // MULTIPLE TASK WARNING
  // =========================================================

  function isMultipleTaskWarningPage() {
    const bodyText = document.body?.innerText || "";

    return bodyText.includes(MULTIPLE_TASK_WARNING_TEXT);
  }

  // =========================================================
  // CHECK WARNING
  // =========================================================

  function checkMultipleTaskWarning() {
    if (isWorkerJobPage()) {
      return;
    }

    if (invalidTaskReported) {
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

  // =========================================================
  // WARNING WATCHER
  // =========================================================

  function startMultipleTaskWarningWatcher() {
    if (multipleTaskWarningWatcher) {
      return;
    }

    multipleTaskWarningWatcher = setInterval(checkMultipleTaskWarning, 500);
  }

  // =========================================================
  // ANNOTATION CHECK
  // =========================================================

  function isAnnotationLoaded() {
    return !!document.querySelector(ANNOTATION_IFRAME_SELECTOR);
  }

  // =========================================================
  // RELOAD COUNT
  // =========================================================

  function getAnnotationReloadCount() {
    try {
      return (
        Number(sessionStorage.getItem("anker_annotation_reload_count")) || 0
      );
    } catch (_) {
      return 0;
    }
  }

  // =========================================================
  // RESET RELOAD COUNT
  // =========================================================

  function resetAnnotationReloadCount() {
    try {
      sessionStorage.removeItem("anker_annotation_reload_count");
    } catch (_) {}
  }

  // =========================================================
  // RELOAD BLANK TASK
  // =========================================================

  function reloadAnnotationPage() {
    const count = getAnnotationReloadCount();

    // Auto reload disabled
    if (maxAutoReload <= 0) {
      if (annotationWatcher) {
        clearInterval(annotationWatcher);
        annotationWatcher = null;
      }
      return;
    }

    // Reached maximum
    if (count >= maxAutoReload) {
      important("MAX AUTO RELOAD REACHED", `${count}/${maxAutoReload}`);

      // QUAN TRỌNG:
      // dừng watcher để không log liên tục

      if (annotationWatcher) {
        clearInterval(annotationWatcher);
        annotationWatcher = null;
      }
      return;
    }

    try {
      sessionStorage.setItem(
        "anker_annotation_reload_count",
        String(count + 1),
      );
    } catch (_) {}

    important("RELOAD BLANK TASK", `${count + 1}/${maxAutoReload}`);

    // -----------------------------------------------------
    // QUAN TRỌNG:
    // Dừng watcher NGAY trước khi reload, để trang cũ
    // (vẫn có thể còn sống vài trăm ms trong lúc chờ
    // điều hướng) không tự trigger thêm reload liên tiếp.
    // -----------------------------------------------------

    if (annotationWatcher) {
      clearInterval(annotationWatcher);
      annotationWatcher = null;
    }

    location.reload();
  }

  // =========================================================
  // ANNOTATION WATCHER
  // =========================================================

  function startAnnotationWatcher() {
    if (annotationWatcher) {
      return;
    }

    annotationWatcher = setInterval(() => {
      if (isWorkerJobPage()) {
        return;
      }

      if (isMultipleTaskWarningPage()) {
        return;
      }

      if (isAnnotationLoaded()) {
        annotationBlankSince = null;

        resetAnnotationReloadCount();

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
    }, ANNOTATION_CHECK_INTERVAL);
  }

  // =========================================================
  // CREATE UI
  // =========================================================

  function createUI() {
    if (document.getElementById("anker-next-review-container")) {
      return;
    }

    const container = document.createElement("div");

    container.id = "anker-next-review-container";

    Object.assign(container.style, {
      position: "fixed",

      left: "20px",

      bottom: "80px",

      zIndex: "999999",

      display: "flex",

      gap: "8px",
    });

    // START

    nextButton = document.createElement("button");

    nextButton.textContent = "START QUEUE";

    Object.assign(nextButton.style, {
      padding: "12px 18px",

      background: "#1677ff",

      color: "#fff",

      border: "none",

      borderRadius: "6px",

      fontWeight: "bold",

      cursor: "pointer",
    });

    nextButton.onclick = startQueue;

    // STOP

    const stopButton = document.createElement("button");

    stopButton.textContent = "STOP";

    Object.assign(stopButton.style, {
      padding: "12px 18px",

      background: "#fa8c16",

      color: "#fff",

      border: "none",

      borderRadius: "6px",

      fontWeight: "bold",

      cursor: "pointer",
    });

    stopButton.onclick = stopQueue;

    // RESET

    const resetButton = document.createElement("button");

    resetButton.textContent = "RESET";

    Object.assign(resetButton.style, {
      padding: "12px 18px",

      background: "#ff4d4f",

      color: "#fff",

      border: "none",

      borderRadius: "6px",

      fontWeight: "bold",

      cursor: "pointer",
    });

    resetButton.onclick = resetQueue;

    container.appendChild(nextButton);

    container.appendChild(stopButton);

    container.appendChild(resetButton);

    document.body.appendChild(container);

    updateButton();
  }

  // =========================================================
  // UPDATE BUTTON
  // =========================================================

  function updateButton() {
    if (!nextButton) {
      return;
    }

    if (queueRunning) {
      nextButton.textContent = `RUNNING (${activeTaskCount})`;

      nextButton.style.background = "#fa8c16";

      return;
    }

    if (activeTaskCount > 0) {
      nextButton.textContent = `PAUSED (${activeTaskCount})`;

      nextButton.style.background = "#8c8c8c";

      return;
    }

    nextButton.textContent = "START QUEUE";

    nextButton.style.background = "#1677ff";
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
    submitSuccessReported = false;
    invalidTaskReported = false;
    requestAutoReloadSettings();
    startMultipleTaskWarningWatcher();
    startAnnotationWatcher();
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
      submitSuccessReported,
      invalidTaskReported,
      delay: turboDelay,
    });
  };
})();
