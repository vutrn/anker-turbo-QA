"use strict";

const AT = globalThis.AnkerTurbo;

// =========================================================
// ELEMENTS
// =========================================================

const delayInput = document.getElementById("delay") as HTMLInputElement;

const concurrentInput = document.getElementById("concurrent") as HTMLInputElement;

const blankReloadInput = document.getElementById("blankReload") as HTMLInputElement;

const maxAutoReloadInput = document.getElementById("maxAutoReload") as HTMLInputElement;

const separateTaskWindowInput = document.getElementById("separateTaskWindow") as HTMLInputElement;

const counterEnabledInput = document.getElementById("counterEnabled") as HTMLInputElement;

const antiIdleEnabledInput = document.getElementById("antiIdleEnabled") as HTMLInputElement;

const hotkeyFailInput = document.getElementById("hotkeyFail") as HTMLInputElement;

const hotkeyPassInput = document.getElementById("hotkeyPass") as HTMLInputElement;

const hotkeySubmitInput = document.getElementById("hotkeySubmit") as HTMLInputElement;

const saveButton = document.getElementById("save") as HTMLButtonElement;

const status = document.getElementById("status") as HTMLElement;

function formatHotkey(code) {
  return String(code || "")
    .replace(/^Backquote$/, "Backtick")
    .replace(/^Escape$/, "Esc")
    .replace(/^Key/, "")
    .replace(/^Digit/, "")
    .replace(/^Arrow/, "Arrow ");
}

function setHotkeyInput(input, code) {
  input.dataset.code = code;
  input.value = code ? formatHotkey(code) : "Off";
}

function showStatus(message, color = "#ff4d4f") {
  status.textContent = message;
  status.style.color = color;
}

function hasDuplicateHotkeys() {
  const codes = [
    hotkeyFailInput.dataset.code || "",
    hotkeyPassInput.dataset.code || "",
    hotkeySubmitInput.dataset.code || "",
  ].filter(Boolean);

  return new Set(codes).size !== codes.length;
}

function captureHotkey(event) {
  event.preventDefault();

  if (event.key === "Control" || event.key === "Alt" || event.key === "Shift" || event.key === "Meta") {
    return;
  }

  if (event.key === "Backspace" || event.key === "Delete") {
    setHotkeyInput(event.currentTarget, "");
    return;
  }

  const code = AT.settings.normalizeHotkey(event.code, null);
  if (!code) return;

  const input = event.currentTarget as HTMLInputElement;
  const assignedInputs = [hotkeyFailInput, hotkeyPassInput, hotkeySubmitInput];
  const isAlreadyAssigned = assignedInputs.some(
    (candidate) => candidate !== input && candidate.dataset.code === code,
  );

  if (isAlreadyAssigned) {
    showStatus(`${formatHotkey(code)} is already assigned`, "#ff4d4f");
    return;
  }

  setHotkeyInput(input, code);
  showStatus("");
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
      AT.STORAGE_KEYS.COUNTER_ENABLED,
      AT.STORAGE_KEYS.ANTI_IDLE_ENABLED,
      AT.STORAGE_KEYS.HOTKEY_FAIL,
      AT.STORAGE_KEYS.HOTKEY_PASS,
      AT.STORAGE_KEYS.HOTKEY_SUBMIT,
    ]);

    const settings = AT.settings.normalize({
      delay: result[AT.STORAGE_KEYS.TURBO_DELAY],
      concurrent: result[AT.STORAGE_KEYS.CONCURRENT_TABS],
      blankReload: result[AT.STORAGE_KEYS.BLANK_RELOAD],
      maxAutoReload: result[AT.STORAGE_KEYS.MAX_AUTO_RELOAD],
      separateTaskWindow: result[AT.STORAGE_KEYS.SEPARATE_TASK_WINDOW],
      counterEnabled: result[AT.STORAGE_KEYS.COUNTER_ENABLED],
      antiIdleEnabled: result[AT.STORAGE_KEYS.ANTI_IDLE_ENABLED],
      hotkeyFail: result[AT.STORAGE_KEYS.HOTKEY_FAIL],
      hotkeyPass: result[AT.STORAGE_KEYS.HOTKEY_PASS],
      hotkeySubmit: result[AT.STORAGE_KEYS.HOTKEY_SUBMIT],
    });

    // -----------------------------------------------------
    // SHOW
    // -----------------------------------------------------

    delayInput.value = String(settings.delay);

    concurrentInput.value = String(settings.concurrent);

    blankReloadInput.value = String(settings.blankReload);

    maxAutoReloadInput.value = String(settings.maxAutoReload);

    separateTaskWindowInput.checked = settings.separateTaskWindow;

    counterEnabledInput.checked = settings.counterEnabled;
    antiIdleEnabledInput.checked = settings.antiIdleEnabled;

    setHotkeyInput(hotkeyFailInput, settings.hotkeyFail);
    setHotkeyInput(hotkeyPassInput, settings.hotkeyPass);
    setHotkeyInput(hotkeySubmitInput, settings.hotkeySubmit);
  } catch (error) {
    console.error("[Anker Turbo] Failed to load settings:", error);

    delayInput.value = String(AT.DEFAULTS.delay);

    concurrentInput.value = String(AT.DEFAULTS.concurrent);

    blankReloadInput.value = String(AT.DEFAULTS.blankReload);

    maxAutoReloadInput.value = String(AT.DEFAULTS.maxAutoReload);

    separateTaskWindowInput.checked = AT.DEFAULTS.separateTaskWindow;

    counterEnabledInput.checked = AT.DEFAULTS.counterEnabled;
    antiIdleEnabledInput.checked = AT.DEFAULTS.antiIdleEnabled;

    setHotkeyInput(hotkeyFailInput, AT.DEFAULTS.hotkeyFail);
    setHotkeyInput(hotkeyPassInput, AT.DEFAULTS.hotkeyPass);
    setHotkeyInput(hotkeySubmitInput, AT.DEFAULTS.hotkeySubmit);
  }
}

// =========================================================
// SAVE SETTINGS
// =========================================================

async function saveSettings() {
  try {
    if (hasDuplicateHotkeys()) {
      showStatus("Fail and Pass shortcuts must be different", "#ff4d4f");
      return;
    }

    const settings = AT.settings.normalize({
      delay: delayInput.value,
      concurrent: concurrentInput.value,
      blankReload: blankReloadInput.value,
      maxAutoReload: maxAutoReloadInput.value,
      separateTaskWindow: separateTaskWindowInput.checked,
      counterEnabled: counterEnabledInput.checked,
      antiIdleEnabled: antiIdleEnabledInput.checked,
      hotkeyFail: hotkeyFailInput.dataset.code,
      hotkeyPass: hotkeyPassInput.dataset.code,
      hotkeySubmit: hotkeySubmitInput.dataset.code,
    });

    delayInput.value = String(settings.delay);
    concurrentInput.value = String(settings.concurrent);
    blankReloadInput.value = String(settings.blankReload);
    maxAutoReloadInput.value = String(settings.maxAutoReload);
    separateTaskWindowInput.checked = settings.separateTaskWindow;
    counterEnabledInput.checked = settings.counterEnabled;
    antiIdleEnabledInput.checked = settings.antiIdleEnabled;
    setHotkeyInput(hotkeyFailInput, settings.hotkeyFail);
    setHotkeyInput(hotkeyPassInput, settings.hotkeyPass);
    setHotkeyInput(hotkeySubmitInput, settings.hotkeySubmit);

    await chrome.storage.local.set({
      [AT.STORAGE_KEYS.TURBO_DELAY]: settings.delay,
      [AT.STORAGE_KEYS.CONCURRENT_TABS]: settings.concurrent,
      [AT.STORAGE_KEYS.BLANK_RELOAD]: settings.blankReload,
      [AT.STORAGE_KEYS.MAX_AUTO_RELOAD]: settings.maxAutoReload,
      [AT.STORAGE_KEYS.SEPARATE_TASK_WINDOW]: settings.separateTaskWindow,
      [AT.STORAGE_KEYS.COUNTER_ENABLED]: settings.counterEnabled,
      [AT.STORAGE_KEYS.ANTI_IDLE_ENABLED]: settings.antiIdleEnabled,
      [AT.STORAGE_KEYS.HOTKEY_FAIL]: settings.hotkeyFail,
      [AT.STORAGE_KEYS.HOTKEY_PASS]: settings.hotkeyPass,
      [AT.STORAGE_KEYS.HOTKEY_SUBMIT]: settings.hotkeySubmit,
    });

    showStatus("Settings saved", "#52c41a");

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
hotkeySubmitInput.addEventListener("keydown", captureHotkey);

document.getElementById("generalTab")?.addEventListener("click", () => {
  document.getElementById("generalTab")?.classList.add("active");
  document.getElementById("helpersTab")?.classList.remove("active");
  document.getElementById("generalTab")?.setAttribute("aria-selected", "true");
  document.getElementById("helpersTab")?.setAttribute("aria-selected", "false");
  document.getElementById("generalPanel")?.classList.remove("hidden");
  document.getElementById("helpersPanel")?.classList.add("hidden");
});

document.getElementById("helpersTab")?.addEventListener("click", () => {
  document.getElementById("helpersTab")?.classList.add("active");
  document.getElementById("generalTab")?.classList.remove("active");
  document.getElementById("helpersTab")?.setAttribute("aria-selected", "true");
  document.getElementById("generalTab")?.setAttribute("aria-selected", "false");
  document.getElementById("helpersPanel")?.classList.remove("hidden");
  document.getElementById("generalPanel")?.classList.add("hidden");
});

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
