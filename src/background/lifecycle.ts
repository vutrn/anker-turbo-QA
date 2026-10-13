(function (AT) {
  "use strict";

  function createLifecycle({
    getStateReady,
    getTaskTabs,
    removeTaskMapping,
    bumpCooldown,
    persistState,
    sleep,
    notifyController,
    fillPendingTasks,
    closeTab,
  }) {
    async function handleTaskSubmitSuccess(tabId) {
      await getStateReady();

      const task = getTaskTabs().get(tabId);
      if (!task || task.handled || task.submitting) return false;

      task.handled = true;
      task.submitting = true;
      task.status = "submitted";

      const recordId = String(task.recordId);
      removeTaskMapping(tabId);
      await bumpCooldown();
      await persistState();

      try {
        await closeTab(tabId);
      } catch (_) {
        // Already closed.
      }

      await sleep(150);
      await notifyController({
        type: AT.MSG.CLOSED_TASK,
        recordId,
      });
      await fillPendingTasks();
      return true;
    }

    async function handleInvalidTaskPage(tabId) {
      await getStateReady();

      const task = getTaskTabs().get(tabId);

      if (task) {
        if (task.handled || task.invalid) return false;

        task.handled = true;
        task.invalid = true;
        task.status = "invalid";

        const recordId = String(task.recordId);
        removeTaskMapping(tabId);
        await bumpCooldown();
        await persistState();

        try {
          await closeTab(tabId);
        } catch (_) {
          // Already closed.
        }

        await sleep(150);
        await notifyController({
          type: AT.MSG.CLOSED_TASK,
          recordId,
        });
        await fillPendingTasks();
        return true;
      }

      console.warn(
        "[Anker Turbo] INVALID_TASK_PAGE trên tab không được track:",
        tabId,
      );

      try {
        await closeTab(tabId);
      } catch (_) {
        // Already closed.
      }

      await bumpCooldown();
      await fillPendingTasks();
      return true;
    }

    async function handleTabClosed(tabId) {
      await getStateReady();

      const task = getTaskTabs().get(tabId);
      if (!task) return;

      removeTaskMapping(tabId);
      await bumpCooldown();
      await persistState();
    }

    return Object.freeze({
      handleInvalidTaskPage,
      handleTabClosed,
      handleTaskSubmitSuccess,
    });
  }

  AT.background = AT.background || {};
  AT.background.lifecycle = Object.freeze({ createLifecycle });
})(globalThis.AnkerTurbo);
