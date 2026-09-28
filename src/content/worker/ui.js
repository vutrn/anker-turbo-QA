(function (AT) {
  "use strict";

  let nextButton = null;

  function create({ onStart, onStop }) {
    if (document.getElementById("anker-next-review-container")) return;

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
    nextButton.onclick = onStart;

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
    stopButton.onclick = onStop;

    container.appendChild(nextButton);
    container.appendChild(stopButton);
    document.body.appendChild(container);
  }

  function update({ queueRunning, activeTaskCount }) {
    if (!nextButton) return;

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

  AT.worker = AT.worker || {};
  AT.worker.ui = Object.freeze({ create, update });
})(globalThis.AnkerTurbo);
