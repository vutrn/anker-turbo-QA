(function (AT) {
  "use strict";

  function getReviewRows() {
    return [
      ...document.querySelectorAll("tbody.ant-table-tbody tr.ant-table-row"),
    ].filter((row) => {
      if (row.getAttribute("aria-hidden") === "true") return false;

      const recordId = row.dataset.rowKey;
      if (!recordId) return false;

      const cells = row.querySelectorAll("td.ant-table-cell");
      if (cells.length < 5) return false;

      const dataStatus = cells[2].textContent.trim().toLowerCase();
      const reviewConclusion = cells[3].textContent.trim().toLowerCase();

      if (dataStatus === "reviewed" || reviewConclusion === "passed") {
        return false;
      }

      const canReview =
        dataStatus === "to be submitted" ||
        dataStatus === "assigned for collection";
      if (!canReview) return false;

      const reviewButton = cells[4].querySelector("button.ant-btn-link");
      if (!reviewButton) return false;
      if (reviewButton.textContent.trim().toLowerCase() !== "review") {
        return false;
      }

      return reviewButton.offsetParent !== null;
    });
  }

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
      const completed =
        dataStatus === "reviewed" ||
        reviewConclusion === "passed" ||
        reviewConclusion === "unqualified";

      map.set(String(recordId), { completed });
    }

    return map;
  }

  AT.worker = AT.worker || {};
  AT.worker.reviewRows = Object.freeze({
    getReviewRows,
    getVisibleRowStatusMap,
  });
})(globalThis.AnkerTurbo);
