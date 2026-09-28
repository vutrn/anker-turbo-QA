"use strict";

const AT = globalThis.AnkerTurbo;

// =========================================================
// ELEMENTS
// =========================================================

const delayInput = document.getElementById("delay");

const concurrentInput = document.getElementById("concurrent");

const blankReloadInput = document.getElementById("blankReload");

const maxAutoReloadInput = document.getElementById("maxAutoReload");

const separateTaskWindowInput = document.getElementById("separateTaskWindow");

const hotkeyFailInput = document.getElementById("hotkeyFail");

const hotkeyPassInput = document.getElementById("hotkeyPass");

const saveButton = document.getElementById("save");

const status = document.getElementById("status");

function formatHotkey(code) {
  return String(code || "")
    .replace(/^Key/, "")
    .replace(/^Digit/, "")
    .replace(/^Arrow/, "Arrow ");
}

function setHotkeyInput(input, code) {
  input.dataset.code = code;
  input.value = formatHotkey(code);
}

function captureHotkey(event) {
  event.preventDefault();

  if (event.key === "Control" || event.key === "Alt" || event.key === "Shift" || event.key === "Meta") {
    return;
  }

  const code = AT.settings.normalizeHotkey(event.code, null);
  if (!code) return;

  setHotkeyInput(event.currentTarget, code);
}

// =========================================================
// LOAD SETTINGS
// =========================================================

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get([
      AT.STORAGE_KEYS.TURBO_DELAY,
      AT.STORAGE_KEYS.CONCURRENT_TABS,
      AT.STORAGE_KEYS.BLANK_RELOAD,
      AT.STORAGE_KEYS.MAX_AUTO_RELOAD,
      AT.STORAGE_KEYS.SEPARATE_TASK_WINDOW,
      AT.STORAGE_KEYS.HOTKEY_FAIL,
      AT.STORAGE_KEYS.HOTKEY_PASS,
    ]);

    const settings = AT.settings.normalize({
      delay: result[AT.STORAGE_KEYS.TURBO_DELAY],
      concurrent: result[AT.STORAGE_KEYS.CONCURRENT_TABS],
      blankReload: result[AT.STORAGE_KEYS.BLANK_RELOAD],
      maxAutoReload: result[AT.STORAGE_KEYS.MAX_AUTO_RELOAD],
      separateTaskWindow: result[AT.STORAGE_KEYS.SEPARATE_TASK_WINDOW],
      hotkeyFail: result[AT.STORAGE_KEYS.HOTKEY_FAIL],
      hotkeyPass: result[AT.STORAGE_KEYS.HOTKEY_PASS],
    });

    // -----------------------------------------------------
    // SHOW
    // -----------------------------------------------------

    delayInput.value = String(settings.delay);

    concurrentInput.value = String(settings.concurrent);

    blankReloadInput.value = String(settings.blankReload);

    maxAutoReloadInput.value = String(settings.maxAutoReload);

    separateTaskWindowInput.checked = settings.separateTaskWindow;

    setHotkeyInput(hotkeyFailInput, settings.hotkeyFail);
    setHotkeyInput(hotkeyPassInput, settings.hotkeyPass);
  } catch (error) {
    console.error("[Anker Turbo] Failed to load settings:", error);

    delayInput.value = String(AT.DEFAULTS.delay);

    concurrentInput.value = String(AT.DEFAULTS.concurrent);

    blankReloadInput.value = String(AT.DEFAULTS.blankReload);

    maxAutoReloadInput.value = String(AT.DEFAULTS.maxAutoReload);

    separateTaskWindowInput.checked = AT.DEFAULTS.separateTaskWindow;

    setHotkeyInput(hotkeyFailInput, AT.DEFAULTS.hotkeyFail);
    setHotkeyInput(hotkeyPassInput, AT.DEFAULTS.hotkeyPass);
  }
}

// =========================================================
// SAVE SETTINGS
// =========================================================

async function saveSettings() {
  try {
    const settings = AT.settings.normalize({
      delay: delayInput.value,
      concurrent: concurrentInput.value,
      blankReload: blankReloadInput.value,
      maxAutoReload: maxAutoReloadInput.value,
      separateTaskWindow: separateTaskWindowInput.checked,
      hotkeyFail: hotkeyFailInput.dataset.code,
      hotkeyPass: hotkeyPassInput.dataset.code,
    });

    delayInput.value = String(settings.delay);
    concurrentInput.value = String(settings.concurrent);
    blankReloadInput.value = String(settings.blankReload);
    maxAutoReloadInput.value = String(settings.maxAutoReload);
    setHotkeyInput(hotkeyFailInput, settings.hotkeyFail);
    setHotkeyInput(hotkeyPassInput, settings.hotkeyPass);

    await chrome.storage.local.set({
      [AT.STORAGE_KEYS.TURBO_DELAY]: settings.delay,
      [AT.STORAGE_KEYS.CONCURRENT_TABS]: settings.concurrent,
      [AT.STORAGE_KEYS.BLANK_RELOAD]: settings.blankReload,
      [AT.STORAGE_KEYS.MAX_AUTO_RELOAD]: settings.maxAutoReload,
      [AT.STORAGE_KEYS.SEPARATE_TASK_WINDOW]: settings.separateTaskWindow,
      [AT.STORAGE_KEYS.HOTKEY_FAIL]: settings.hotkeyFail,
      [AT.STORAGE_KEYS.HOTKEY_PASS]: settings.hotkeyPass,
    });

    status.textContent = "Settings saved";

    status.style.color = "#52c41a";

    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  } catch (error) {
    console.error("[Anker Turbo] Failed to save settings:", error);

    status.textContent = `Save failed: ${error?.message || "unknown error"}`;

    status.style.color = "#ff4d4f";
  }
}

// =========================================================
// EVENTS
// =========================================================

saveButton.addEventListener("click", saveSettings);

hotkeyFailInput.addEventListener("keydown", captureHotkey);
hotkeyPassInput.addEventListener("keydown", captureHotkey);

// ENTER → SAVE
[delayInput, concurrentInput, blankReloadInput, maxAutoReloadInput].forEach(
  (input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        saveSettings();
      }
    });
  },
);

// =========================================================
// INIT
// =========================================================

loadSettings();
