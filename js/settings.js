// @ts-nocheck
(function () {
  "use strict";

  function required(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error("Missing element #" + id);
    return el;
  }

  /* DOM ELEMENTS */
  const themeSelect = required("themeSelect");
  const accentColor = required("accentColor");
  const resetAccent = required("resetAccent");
  const compactToggle = required("compactToggle");
  const reducedMotion = required("reducedMotion");

  const defaultVolume = required("defaultVolume");
  const volLabel = required("volLabel");
  const autoplayToggle = required("autoplayToggle");
  const crossfade = required("crossfade");
  const qualitySelect = required("qualitySelect");

  const explicitToggle = required("explicitToggle");
  const miniPlayerToggle = required("miniPlayerToggle");

  const languageSelect = required("languageSelect");
  const analyticsToggle = required("analyticsToggle");

  const saveBtn = required("saveBtn");
  const exportBtn = required("exportBtn");
  const importBtn = required("importBtn");
  const importFile = required("importFile");
  const resetBtn = required("resetBtn");

  const toastContainer = required("toastContainer");

  const KEY = "omni_settings";

  /* DEFAULT SETTINGS */
  const DEFAULTS = {
    theme: "dark",
    accent: "#8be7ff",
    compact: false,
    reducedMotion: false,

    defaultVolume: 0.8,
    autoplay: true,
    crossfade: 3,
    quality: "320", // <— NEW default High quality

    explicitAllowed: true,
    miniPlayerEnabled: true,

    language: "en",
    analytics: false
  };

  let settings = {};

  /* TOAST */
  function toast(msg, ms = 1400) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 220);
    }, ms);
  }

  /* LOAD */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      settings = raw ? JSON.parse(raw) : { ...DEFAULTS };
    } catch {
      settings = { ...DEFAULTS };
    }
    Object.keys(DEFAULTS).forEach(k => {
      if (settings[k] === undefined) settings[k] = DEFAULTS[k];
    });
  }

  /* SAVE */
  function save() {
    localStorage.setItem(KEY, JSON.stringify(settings));
    toast("Settings Saved");
  }

  /* APPLY TO UI */
  function applyToUI() {
    themeSelect.value = settings.theme;
    accentColor.value = settings.accent;
    compactToggle.checked = settings.compact;
    reducedMotion.checked = settings.reducedMotion;

    defaultVolume.value = settings.defaultVolume;
    volLabel.textContent = settings.defaultVolume.toFixed(2);

    autoplayToggle.checked = settings.autoplay;
    crossfade.value = settings.crossfade;
    qualitySelect.value = settings.quality;

    explicitToggle.checked = settings.explicitAllowed;
    miniPlayerToggle.checked = settings.miniPlayerEnabled;

    languageSelect.value = settings.language;
    analyticsToggle.checked = settings.analytics;
  }

  /* APPLY TO SITE */
  function applyToSite() {
    // theme system
    if (settings.theme === "light") {
      document.documentElement.style.setProperty("--bg", "#f6f9ff");
      document.documentElement.style.setProperty("--text", "#0a0e14");
    } else if (settings.theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        document.documentElement.style.setProperty("--bg", "#051021");
        document.documentElement.style.setProperty("--text", "#e9f3ff");
      } else {
        document.documentElement.style.setProperty("--bg", "#f6f9ff");
        document.documentElement.style.setProperty("--text", "#0a0e14");
      }
    } else {
      document.documentElement.style.setProperty("--bg", "#051021");
      document.documentElement.style.setProperty("--text", "#e9f3ff");
    }

    // accent
    document.documentElement.style.setProperty("--accent", settings.accent);

    // compact UI
    document.body.classList.toggle("compact", settings.compact);

    // reduced motion
    document.body.classList.toggle("reduced-motion", settings.reducedMotion);

    // language
    document.documentElement.lang = settings.language;

    // analytics
    window.__OMNI_ANALYTICS_ALLOWED = settings.analytics;

    // mini-player, playback quality will be read by music-player.js
    window.__OMNI_PREFERENCES = {
      quality: settings.quality,
      explicitAllowed: settings.explicitAllowed,
      miniPlayer: settings.miniPlayerEnabled
    };
  }

  /* EVENT LISTENERS */
  resetAccent.onclick = () => {
    settings.accent = DEFAULTS.accent;
    applyToUI();
    applyToSite();
  };

  defaultVolume.oninput = (e) => {
    settings.defaultVolume = Number(e.target.value);
    volLabel.textContent = settings.defaultVolume.toFixed(2);
    applyToSite();
  };

  themeSelect.onchange = e => { settings.theme = e.target.value; applyToSite(); };
  accentColor.oninput = e => { settings.accent = e.target.value; applyToSite(); };
  compactToggle.onchange = e => { settings.compact = e.target.checked; applyToSite(); };
  reducedMotion.onchange = e => { settings.reducedMotion = e.target.checked; applyToSite(); };

  autoplayToggle.onchange = e => { settings.autoplay = e.target.checked; };
  crossfade.onchange = e => { settings.crossfade = Number(e.target.value); };
  qualitySelect.onchange = e => { settings.quality = e.target.value; };

  explicitToggle.onchange = e => { settings.explicitAllowed = e.target.checked; };
  miniPlayerToggle.onchange = e => { settings.miniPlayerEnabled = e.target.checked; };

  languageSelect.onchange = e => { settings.language = e.target.value; applyToSite(); };
  analyticsToggle.onchange = e => { settings.analytics = e.target.checked; };

  saveBtn.onclick = save;

  /* EXPORT */
  exportBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "omni_settings.json";
    a.click();
  };

  /* IMPORT */
  importBtn.onclick = () => importFile.click();
  importFile.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        settings = { ...DEFAULTS, ...data };
        applyToUI();
        applyToSite();
        save();
        toast("Imported");
      } catch {
        toast("Invalid file");
      }
    };
    reader.readAsText(file);
  };

  /* RESET */
  resetBtn.onclick = () => {
    if (!confirm("Reset all settings?")) return;
    settings = { ...DEFAULTS };
    applyToUI();
    applyToSite();
    save();
  };

  /* SHORTCUT: CTRL+S */
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      save();
    }
  });

  /* INIT */
  load();
  applyToUI();
  applyToSite();

})();
