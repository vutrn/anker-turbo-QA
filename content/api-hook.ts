"use strict";

// =========================================================
// ANKER API AND NETWORK HOOKS
// =========================================================

(function () {
  let detectedConfig = null;
  let isWorkerJobPage = () => false;
  let getCurrentRecordId = () => null;
  let submitSuccessReported = false;
  let __ankerLastCountedAt = 0;
  const __ankerCountDedupeWindow = 1500;

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

    if (obj.flowId !== undefined && obj.flowId !== null) {
      const flowId = String(obj.flowId).trim();

      if (flowId) {
        detectedConfig.flowId = flowId;
      }
    }

    if (typeof obj.title === "string") {
      const title = obj.title.trim();

      if (title && (title.includes("审核") || title.length > 5)) {
        detectedConfig.title = title;
      }
    }

    if (typeof obj.locale === "string") {
      const locale = obj.locale.trim();

      if (locale) {
        detectedConfig.locale = locale;
      }
    }

    if (obj.jobId !== undefined && obj.jobId !== null) {
      detectedConfig.jobId = String(obj.jobId).trim();
    }

    if (obj.projectId !== undefined && obj.projectId !== null) {
      detectedConfig.projectId = String(obj.projectId).trim();
    }

    if (typeof obj.businessType === "string") {
      const businessType = obj.businessType.trim();

      if (businessType) {
        detectedConfig.businessType = businessType;
      }
    }

    for (const key of Object.keys(obj)) {
      try {
        const value = obj[key];

        if (value && typeof value === "object") {
          scanObject(value, depth + 1);
        }
      } catch (_) {}
    }
  }

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

  function isSubmitApi(url, method) {
    if (!url || String(method || "").toUpperCase() !== "POST") {
      return false;
    }

    try {
      const absoluteUrl = new URL(String(url), location.origin);
      return absoluteUrl.pathname === "/api/task-submit";
    } catch (_) {
      return String(url).includes("/api/task-submit");
    }
  }

  function isReworkTask(url) {
    if (!url) {
      return false;
    }

    try {
      const absoluteUrl = new URL(String(url), location.origin);
      const params = absoluteUrl.searchParams;

      for (const key of ["taskType", "jobType", "type", "reworkFlag", "isRework", "category"]) {
        const value = params.get(key);

        if (value && /rework/i.test(value)) {
          return true;
        }
      }
    } catch (_) {
      if (/rework/i.test(String(url))) {
        return true;
      }
    }

    try {
      const doc = (window.top && window.top.document) || document;
      const bodyText = doc.body ? doc.body.innerText : "";

      if (/\brework\b/i.test(bodyText)) {
        return true;
      }
    } catch (_) {}

    return false;
  }

  function reportSubmitSuccess(url) {
    if (isWorkerJobPage() || submitSuccessReported) {
      return;
    }

    if (isReworkTask(url)) {
      console.log("[Anker Turbo] Skip submit counter for rework task.");
      return;
    }

    const now = Date.now();

    if (now - __ankerLastCountedAt < __ankerCountDedupeWindow) {
      return;
    }

    __ankerLastCountedAt = now;

    if (window.top && typeof window.top.incrementAnkerCounter === "function") {
      window.top.incrementAnkerCounter();
      console.log("[Anker Turbo] +1 submit counter (API success, non-rework). ");
    }

    submitSuccessReported = true;

    console.log(
      "%c[Anker Turbo] SEND SUBMIT → BRIDGE",
      "color:#fa8c16;font-weight:bold",
      {
        recordId: getCurrentRecordId(),
        url: location.href,
      },
    );

    window.postMessage(
      {
        __ankerExtension: true,
        type: "TASK_SUBMIT_SUCCESS",
        recordId: getCurrentRecordId(),
      },
      "*",
    );
  }

  function markSubmitStarted() {
    if (!isWorkerJobPage()) {
      window.__ankerTurboTaskTitle?.set("submitting");
    }
  }

  function installFetchHook() {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      try {
        const requestUrl =
          typeof args[0] === "string"
            ? args[0]
            : args[0] instanceof Request
              ? args[0].url
              : String(args[0]);
        const requestMethod =
          args[0] instanceof Request ? args[0].method : args[1]?.method || "GET";
        const clone = response.clone();
        const contentType = clone.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          clone.json().then(processApiData).catch(() => {});
        } else {
          clone.text().then(processApiData).catch(() => {});
        }

        if (isSubmitApi(requestUrl, requestMethod)) {
          markSubmitStarted();

          if (response.status >= 200 && response.status < 300) {
            reportSubmitSuccess(requestUrl);
          }
        }
      } catch (_) {}

      return response;
    };
  }

  function installXhrHook() {
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
            markSubmitStarted();

            if (this.status >= 200 && this.status < 300) {
              reportSubmitSuccess(this.__ankerUrl);
            }
          }
        } catch (_) {}
      });

      return originalSend.apply(this, args);
    };
  }

  function start(options: any = {}) {
    detectedConfig = options.detectedConfig || {};
    isWorkerJobPage = options.isWorkerJobPage || isWorkerJobPage;
    getCurrentRecordId = options.getCurrentRecordId || getCurrentRecordId;
    installFetchHook();
    installXhrHook();
  }

  window.__ankerTurboApiHook = { start };
})();
