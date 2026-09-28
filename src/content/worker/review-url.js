(function (AT) {
  "use strict";

  function createReviewUrl({ recordId, detectedConfig, getWorkerInfo }) {
    const worker = getWorkerInfo();
    if (!worker) return null;

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

  AT.worker = AT.worker || {};
  AT.worker.reviewUrl = Object.freeze({ createReviewUrl });
})(globalThis.AnkerTurbo);
