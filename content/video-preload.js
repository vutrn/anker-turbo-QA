"use strict";

// =========================================================
// VIDEO PRELOAD & AUTOPLAY
// =========================================================

(function () {
  const preloadedVideos = new WeakSet();
  const VIDEO_SCAN_POLL_INTERVAL = 500;

  function getVideoOriginalSrc(video) {
    if (video.currentSrc) {
      return video.currentSrc;
    }

    const source = video.querySelector("source[src]");

    if (source) {
      return source.src;
    }

    return video.src || null;
  }

  async function warmVideoNetworkCache(video) {
    const originalSrc = getVideoOriginalSrc(video);

    if (!originalSrc) {
      console.warn(
        "[Anker Turbo][preload] Không lấy được URL video, bỏ qua warm-cache",
        video,
      );
      return;
    }

    const shortName = originalSrc.split("/").pop().split("?")[0];

    try {
      const response = await fetch(originalSrc, {
        priority: "high",
      });

      if (!response.ok) {
        console.warn(
          "[Anker Turbo][preload] Fetch trả về lỗi HTTP",
          response.status,
          shortName,
        );
        return;
      }

      const buffer = await response.arrayBuffer();

      console.log(
        "%c[Anker Turbo][preload] Warm-cache OK",
        "color:#52c41a;font-weight:bold",
        shortName,
        `${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`,
      );

      if (document.contains(video) && video.paused && video.currentTime === 0) {
        video.load();
        console.log(
          "[Anker Turbo][preload] Đã gọi lại video.load() để ăn cache",
          shortName,
        );
      } else {
        console.log(
          "[Anker Turbo][preload] Bỏ qua load() lại (video đã phát hoặc bị gỡ khỏi DOM)",
          shortName,
        );
      }
    } catch (error) {
      console.warn(
        "[Anker Turbo][preload] Warm-cache THẤT BẠI",
        shortName,
        error?.name,
        error?.message,
      );
    }
  }

  function prepareVideoForPreload(video) {
    if (preloadedVideos.has(video)) {
      return;
    }

    const originalSrc = getVideoOriginalSrc(video);

    if (!originalSrc) {
      return;
    }

    preloadedVideos.add(video);

    try {
      video.preload = "auto";
      video.muted = true;
      video.load();
    } catch (_) {}

    warmVideoNetworkCache(video);
  }

  function scanAndPreloadVideos() {
    document.querySelectorAll("video").forEach(prepareVideoForPreload);
  }

  function playAllVideos() {
    document.querySelectorAll("video").forEach((video) => {
      const playPromise = video.play();

      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    });
  }

  function start() {
    scanAndPreloadVideos();

    const observer = new MutationObserver(scanAndPreloadVideos);

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });

    setInterval(scanAndPreloadVideos, VIDEO_SCAN_POLL_INTERVAL);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        playAllVideos();
      }
    });
  }

  window.__ankerTurboVideoPreload = { start };
})();
