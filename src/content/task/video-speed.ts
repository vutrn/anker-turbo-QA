(function (AT) {
  "use strict";

  const CHECK_INTERVAL_MS = 300;
  const rateMap = {
    "X0.1": 0.1,
    "X0.25": 0.25,
    "X0.5": 0.5,
    X1: 1,
    X2: 2,
    X4: 4,
  };
  const TARGET_SPEED_LABEL = "X2";

  function tryPlayAndSetSpeed(video) {
    if (!video) return;

    video.playbackRate = rateMap[TARGET_SPEED_LABEL];
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
      document
        .querySelectorAll<HTMLVideoElement>("video.video")
        .forEach((video) => {
        if (processedVideos.has(video)) {
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
