(function (AT) {
  "use strict";

  const ACTIVITY_INTERVAL_MS = 10 * 1000;

  function enableSilentAudioAntiSuspend() {
    if (window.__ankerTurboAudioContext) {
      return;
    }

    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioCtor) {
      return;
    }

    try {
      const context = new AudioCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 220;
      gain.gain.value = 0.0001;

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();

      context.resume().catch(() => {});
      window.__ankerTurboAudioContext = context;
      console.log("[Anti-Suspend 6.6] Silent Audio Stream activated.");
    } catch (error) {
      console.log("[Anti-Suspend 6.6] Audio Context error / chưa tương tác:", error);
    }
  }

  function requestWakeLock() {
    const nav = navigator as any;

    if (!nav || !("wakeLock" in nav)) {
      return;
    }

    nav.wakeLock
      .request("screen")
      .then(() => {
        console.log("[Anti-Suspend 6.6] Screen Wake Lock active.");
      })
      .catch((error) => {
        console.log("[Anti-Suspend 6.6] Wake Lock error:", error?.message || error);
      });
  }

  function simulateUserActivity() {
    const width = window.innerWidth || 1200;
    const height = window.innerHeight || 800;
    const x = Math.floor(width * 0.4 + Math.random() * width * 0.2);
    const y = Math.floor(height * 0.4 + Math.random() * height * 0.2);

    document.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      }),
    );

    window.dispatchEvent(new Event("scroll"));

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Shift",
        code: "ShiftLeft",
        keyCode: 16,
        which: 16,
        bubbles: true,
      }),
    );

    window.dispatchEvent(new Event("focus"));
    console.log(
      `[Anti-Idle 6.6] ${new Date().toLocaleTimeString()} (X: ${Math.round(x)}, Y: ${Math.round(y)})`,
    );
  }

  function start() {
    if (window.top !== window.self) {
      return;
    }

    enableSilentAudioAntiSuspend();
    window.addEventListener("click", enableSilentAudioAntiSuspend, { once: true });
    window.addEventListener("keydown", enableSilentAudioAntiSuspend, { once: true });

    requestWakeLock();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    });

    setInterval(simulateUserActivity, ACTIVITY_INTERVAL_MS);
    console.log("[Anti-Idle 6.6] Khởi chạy thành công.");
  }

  AT.task = AT.task || {};
  AT.task.antiIdle = { start };
})(globalThis.AnkerTurbo);
