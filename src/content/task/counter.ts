(function (AT) {
  "use strict";

  const COUNTER_KEY_PREFIX = "anker_submit_count_";
  const POSITION_KEY_PREFIX = "anker_counter_widget_position_";

  function getCountKey() {
    return `${COUNTER_KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`;
  }

  function readCount(storage, key) {
    const value = Number(storage.getItem(key) || "0");
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function writeCount(storage, key, value) {
    storage.setItem(key, String(Math.max(0, Number(value) || 0)));
  }

  function createCounterWidget() {
    if (window.top !== window.self) {
      return;
    }

    const rootDocument = window.top?.document || document;
    const rootWindow = window.top || window;

    if (!rootDocument.body || rootDocument.getElementById("anker-counter-widget")) {
      return;
    }

    const countKey = getCountKey();
    const positionKey = `${POSITION_KEY_PREFIX}${location.hostname}`;
    let count = readCount(rootWindow.localStorage, countKey);

    const widget = rootDocument.createElement("div");
    widget.id = "anker-counter-widget";
    widget.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      background: rgba(30, 34, 45, 0.95);
      color: #40a9ff;
      border-radius: 10px;
      padding: 6px 12px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      cursor: grab;
      user-select: none;
      transition: transform 0.15s ease;
    `;

    let savedPosition = null;
    try {
      savedPosition = JSON.parse(rootWindow.localStorage.getItem(positionKey) || "null");
    } catch (_) {
      savedPosition = null;
    }

    if (savedPosition && typeof savedPosition.left === "number" && typeof savedPosition.top === "number") {
      widget.style.left = `${savedPosition.left}px`;
      widget.style.top = `${savedPosition.top}px`;
    } else {
      widget.style.left = "10px";
      widget.style.bottom = "50px";
    }

    const animate = () => {
      widget.style.transform = "scale(1.12)";
      setTimeout(() => {
        widget.style.transform = "scale(1)";
      }, 150);
    };

    const updateWidgetDisplay = () => {
      count = readCount(rootWindow.localStorage, countKey);

      widget.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="anker-btn-minus" title="Giảm 1" style="
            background: rgba(255, 77, 79, 0.2);
            border: 1px solid #ff4d4f;
            color: #ff4d4f;
            font-size: 15px;
            font-weight: bold;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            user-select: none;
            transition: all 0.2s ease;
            outline: none;
          ">-</button>

          <span id="anker-count-text" title="Click để đổi số thủ công" style="
            color: #52c41a;
            font-size: 18px;
            min-width: 28px;
            text-align: center;
            cursor: pointer;
          ">${count}</span>

          <button id="anker-btn-plus" title="Cộng 1" style="
            background: rgba(82, 196, 26, 0.2);
            border: 1px solid #52c41a;
            color: #52c41a;
            font-size: 15px;
            font-weight: bold;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            user-select: none;
            transition: all 0.2s ease;
            outline: none;
          ">+</button>
        </div>
      `;

      const btnMinus = widget.querySelector("#anker-btn-minus");
      const btnPlus = widget.querySelector("#anker-btn-plus");
      const countText = widget.querySelector("#anker-count-text");

      btnMinus?.addEventListener("mousedown", (event) => event.stopPropagation());
      btnPlus?.addEventListener("mousedown", (event) => event.stopPropagation());
      countText?.addEventListener("mousedown", (event) => event.stopPropagation());

      btnMinus?.addEventListener("click", (event) => {
        event.stopPropagation();
        count = Math.max(0, count - 1);
        writeCount(rootWindow.localStorage, countKey, count);
        updateWidgetDisplay();
        animate();
      });

      btnPlus?.addEventListener("click", (event) => {
        event.stopPropagation();
        count += 1;
        writeCount(rootWindow.localStorage, countKey, count);
        updateWidgetDisplay();
        animate();
      });

      countText?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (hasMoved) {
          return;
        }

        const nextValue = Number(
          window.prompt("Nhập số lượng sản lượng hiện tại của bạn:", String(count)),
        );

        if (Number.isFinite(nextValue)) {
          count = Math.max(0, nextValue);
          writeCount(rootWindow.localStorage, countKey, count);
          updateWidgetDisplay();
        }
      });
    };

    const incrementCurrentCounter = () => {
      count += 1;
      writeCount(rootWindow.localStorage, countKey, count);
      updateWidgetDisplay();
      animate();
    };

    rootWindow.incrementAnkerCounter = incrementCurrentCounter;

    let isDragging = false;
    let hasMoved = false;
    let offsetX = 0;
    let offsetY = 0;

    widget.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }

      const rect = widget.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      isDragging = true;
      hasMoved = false;
      widget.style.cursor = "grabbing";
      event.preventDefault();
      event.stopPropagation();
    });

    rootWindow.addEventListener("mousemove", (event) => {
      if (!isDragging) {
        return;
      }

      const x = event.clientX - offsetX;
      const y = event.clientY - offsetY;
      widget.style.left = `${x}px`;
      widget.style.top = `${y}px`;
      widget.style.bottom = "auto";
      hasMoved = true;
    });

    rootWindow.addEventListener("mouseup", () => {
      if (!isDragging) {
        return;
      }

      isDragging = false;
      widget.style.cursor = "grab";

      try {
        const position = {
          left: Number.parseFloat(widget.style.left || "0"),
          top: Number.parseFloat(widget.style.top || "0"),
        };

        rootWindow.localStorage.setItem(positionKey, JSON.stringify(position));
      } catch (_) {}
    });

    rootDocument.body.appendChild(widget);
    updateWidgetDisplay();
  }

  function start() {
    if (window.top !== window.self) {
      return;
    }

    createCounterWidget();
  }

  AT.task = AT.task || {};
  AT.task.counter = { start };
})(globalThis.AnkerTurbo);
