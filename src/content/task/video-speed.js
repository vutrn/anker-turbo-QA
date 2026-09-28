(function (AT) {
  "use strict";

  const TARGET_SPEED_LABEL = "X2";
  const CHECK_INTERVAL_MS = 300;
  const rateMap = {
    "X0.1": 0.1,
    "X0.25": 0.25,
    "X0.5": 0.5,
    X1: 1,
    X2: 2,
    X4: 4,
  };

  function findSpeedInput(root) {
    const labels = root.querySelectorAll(".speed-group label.el-radio-button");

    for (const label of labels) {
      const span = label.querySelector(".el-radio-button__inner");

      if (span && span.textContent.trim() === TARGET_SPEED_LABEL) {
        return label.querySelector("input.el-radio-button__orig-radio");
      }
    }

    return null;
  }

  function clickSpeedButton(video) {
    const container = video.closest(".el-col") || document;
    const input = findSpeedInput(container);

    if (!input) return false;

    const label = input.closest("label.el-radio-button");
    if (label && label.classList.contains("is-active")) return true;

    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("click", { bubbles: true }));
    if (label) label.click();

    return true;
  }

  function tryPlayAndSetSpeed(video) {
    if (!video) return;

    video.playbackRate = rateMap[TARGET_SPEED_LABEL];
    clickSpeedButton(video);
    video.muted = true;

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        document.addEventListener("click", () => video.play(), { once: true });
      });
    }
  }

  function start() {
    const processedVideos = new WeakSet();

    function scanVideos() {
      document.querySelectorAll("video.video").forEach((video) => {
        if (processedVideos.has(video)) {
          if (video.playbackRate !== rateMap[TARGET_SPEED_LABEL]) {
            video.playbackRate = rateMap[TARGET_SPEED_LABEL];
          }
          return;
        }

        processedVideos.add(video);

        if (video.readyState >= 1) {
          tryPlayAndSetSpeed(video);
        } else {
          video.addEventListener(
            "loadedmetadata",
            () => tryPlayAndSetSpeed(video),
            { once: true },
          );
        }
      });
    }

    setInterval(scanVideos, CHECK_INTERVAL_MS);
    scanVideos();
  }

  AT.task = AT.task || {};
  AT.task.videoSpeed = { start };
})(globalThis.AnkerTurbo);
