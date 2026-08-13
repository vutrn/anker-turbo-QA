"use strict";

// =========================================================
// DEFAULTS
// =========================================================

const DEFAULT_DELAY = 600;
const DEFAULT_CONCURRENT = 3;

const DEFAULT_BLANK_RELOAD = 8000;
const DEFAULT_MAX_AUTO_RELOAD = 3;

// =========================================================
// LIMITS
// =========================================================

const MIN_DELAY = 100;
const MAX_DELAY = 10000;

const MIN_CONCURRENT = 1;
const MAX_CONCURRENT = 50;

const MIN_BLANK_RELOAD = 1000;
const MAX_BLANK_RELOAD = 60000;

const MIN_MAX_AUTO_RELOAD = 0;
const MAX_MAX_AUTO_RELOAD = 20;

// =========================================================
// ELEMENTS
// =========================================================

const delayInput = document.getElementById("delay");

const concurrentInput = document.getElementById("concurrent");

const blankReloadInput = document.getElementById("blankReload");

const maxAutoReloadInput = document.getElementById("maxAutoReload");

const saveButton = document.getElementById("save");

const status = document.getElementById("status");

// =========================================================
// LOAD SETTINGS
// =========================================================

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get([
      "turboDelay",
      "concurrentTabs",
      "blankReload",
      "maxAutoReload",
    ]);

    // -----------------------------------------------------
    // DELAY
    // -----------------------------------------------------

    let delay = Number(result.turboDelay);

    if (!Number.isFinite(delay)) {
      delay = DEFAULT_DELAY;
    }

    delay = Math.max(MIN_DELAY, Math.min(MAX_DELAY, Math.round(delay)));

    // -----------------------------------------------------
    // CONCURRENT
    // -----------------------------------------------------

    let concurrent = Number(result.concurrentTabs);

    if (!Number.isFinite(concurrent)) {
      concurrent = DEFAULT_CONCURRENT;
    }

    concurrent = Math.max(
      MIN_CONCURRENT,
      Math.min(MAX_CONCURRENT, Math.round(concurrent)),
    );

    // -----------------------------------------------------
    // BLANK RELOAD
    // -----------------------------------------------------

    let blankReload = Number(result.blankReload);

    if (!Number.isFinite(blankReload)) {
      blankReload = DEFAULT_BLANK_RELOAD;
    }

    blankReload = Math.max(
      MIN_BLANK_RELOAD,
      Math.min(MAX_BLANK_RELOAD, Math.round(blankReload)),
    );

    // -----------------------------------------------------
    // MAX AUTO RELOAD
    // -----------------------------------------------------

    let maxAutoReload = Number(result.maxAutoReload);

    if (!Number.isFinite(maxAutoReload)) {
      maxAutoReload = DEFAULT_MAX_AUTO_RELOAD;
    }

    maxAutoReload = Math.max(
      MIN_MAX_AUTO_RELOAD,
      Math.min(MAX_MAX_AUTO_RELOAD, Math.round(maxAutoReload)),
    );

    // -----------------------------------------------------
    // SHOW
    // -----------------------------------------------------

    delayInput.value = String(delay);

    concurrentInput.value = String(concurrent);

    blankReloadInput.value = String(blankReload);

    maxAutoReloadInput.value = String(maxAutoReload);
  } catch (error) {
    console.error("[Anker Turbo] Failed to load settings:", error);

    delayInput.value = String(DEFAULT_DELAY);

    concurrentInput.value = String(DEFAULT_CONCURRENT);

    blankReloadInput.value = String(DEFAULT_BLANK_RELOAD);

    maxAutoReloadInput.value = String(DEFAULT_MAX_AUTO_RELOAD);
  }
}

// =========================================================
// SAVE SETTINGS
// =========================================================

async function saveSettings() {
  // -----------------------------------------------------
  // READ
  // -----------------------------------------------------

  let delay = Number(delayInput.value);

  let concurrent = Number(concurrentInput.value);

  let blankReload = Number(blankReloadInput.value);

  let maxAutoReload = Number(maxAutoReloadInput.value);

  // -----------------------------------------------------
  // DELAY
  // -----------------------------------------------------

  if (!Number.isFinite(delay)) {
    delay = DEFAULT_DELAY;
  }

  delay = Math.max(MIN_DELAY, Math.min(MAX_DELAY, Math.round(delay)));

  // -----------------------------------------------------
  // CONCURRENT
  // -----------------------------------------------------

  if (!Number.isFinite(concurrent)) {
    concurrent = DEFAULT_CONCURRENT;
  }

  concurrent = Math.max(
    MIN_CONCURRENT,
    Math.min(MAX_CONCURRENT, Math.round(concurrent)),
  );

  // -----------------------------------------------------
  // BLANK RELOAD
  // -----------------------------------------------------

  if (!Number.isFinite(blankReload)) {
    blankReload = DEFAULT_BLANK_RELOAD;
  }

  blankReload = Math.max(
    MIN_BLANK_RELOAD,
    Math.min(MAX_BLANK_RELOAD, Math.round(blankReload)),
  );

  // -----------------------------------------------------
  // MAX AUTO RELOAD
  // -----------------------------------------------------

  if (!Number.isFinite(maxAutoReload)) {
    maxAutoReload = DEFAULT_MAX_AUTO_RELOAD;
  }

  maxAutoReload = Math.max(
    MIN_MAX_AUTO_RELOAD,
    Math.min(MAX_MAX_AUTO_RELOAD, Math.round(maxAutoReload)),
  );

  // -----------------------------------------------------
  // UPDATE INPUTS
  // -----------------------------------------------------

  delayInput.value = String(delay);

  concurrentInput.value = String(concurrent);

  blankReloadInput.value = String(blankReload);

  maxAutoReloadInput.value = String(maxAutoReload);

  // -----------------------------------------------------
  // SAVE
  // -----------------------------------------------------

  try {
    await chrome.storage.local.set({
      turboDelay: delay,

      concurrentTabs: concurrent,

      blankReload: blankReload,

      maxAutoReload: maxAutoReload,
    });

    status.textContent = `Saved: ${delay}ms / ${concurrent} tabs / Blank ${blankReload}ms / Max reload ${maxAutoReload}`;

    status.style.color = "#52c41a";

    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  } catch (error) {
    console.error("[Anker Turbo] Failed to save settings:", error);

    status.textContent = "Save failed";

    status.style.color = "#ff4d4f";
  }
}

// =========================================================
// EVENTS
// =========================================================

saveButton.addEventListener("click", saveSettings);

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
