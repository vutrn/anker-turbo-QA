# Message Protocol

Message names are defined in `src/shared/constants.js` under `AnkerTurbo.MSG`.

| Message | Direction | Purpose |
|---|---|---|
| `REGISTER_CONTROLLER` | page -> background | Register the worker page controlling the queue. |
| `START_QUEUE` | page -> background | Start queue processing with initial tasks. |
| `FILL_QUEUE` | page -> background | Add visible worker tasks to the queue. |
| `STOP_QUEUE` | page -> background | Stop opening pending tasks. |
| `RESET_QUEUE` | page -> background | Clear pending queue state. |
| `PRUNE_POOL` | page -> background | Remove tasks no longer visible or already complete. |
| `TASK_SUBMIT_SUCCESS` | task -> background | Report a successful task submission. |
| `INVALID_TASK_PAGE` | task -> background | Report an invalid or duplicate task page. |
| `NEXT_TAB` | task -> background | Activate the next tab in the same window. |
| `QUEUE_STATUS` | background -> page | Publish active and pending queue state. |
| `CLOSED_TASK` | background -> worker | Notify the worker that a task tab closed. |
| `TURBO_DELAY_RESPONSE` | bridge -> page | Return the configured task-open delay. |
| `AUTO_RELOAD_SETTINGS_RESPONSE` | bridge -> page | Return blank-page reload settings. |

Page-to-extension messages use `window.postMessage` with
`__ankerExtension: true`. The bridge validates that marker before forwarding.
