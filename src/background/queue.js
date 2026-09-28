(function (AT) {
  "use strict";

  function reconcileQueueRecords({ pendingTasks, recordToTab }) {
    const activeIds = new Set(recordToTab.keys());
    const seen = new Set();

    return pendingTasks.filter((task) => {
      if (!task || !task.recordId || !task.url) return false;

      const recordId = String(task.recordId);
      if (activeIds.has(recordId) || seen.has(recordId)) return false;

      seen.add(recordId);
      task.recordId = recordId;
      task.url = String(task.url);
      return true;
    });
  }

  function getPendingRecordSet(pendingTasks) {
    return new Set(
      pendingTasks
        .filter((task) => task && task.recordId)
        .map((task) => String(task.recordId)),
    );
  }

  function appendPendingTasks({ pendingTasks, tasks, recordToTab }) {
    const nextTasks = reconcileQueueRecords({ pendingTasks, recordToTab });
    if (!Array.isArray(tasks)) return nextTasks;

    const pendingIds = getPendingRecordSet(nextTasks);

    for (const task of tasks) {
      if (!task || !task.recordId || !task.url) continue;

      const recordId = String(task.recordId);
      if (recordToTab.has(recordId) || pendingIds.has(recordId)) continue;

      nextTasks.push({
        recordId,
        url: String(task.url),
      });
      pendingIds.add(recordId);
    }

    return reconcileQueueRecords({ pendingTasks: nextTasks, recordToTab });
  }

  AT.background = AT.background || {};
  AT.background.queue = Object.freeze({
    appendPendingTasks,
    getPendingRecordSet,
    reconcileQueueRecords,
  });
})(globalThis.AnkerTurbo);
