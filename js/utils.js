// utils.js — Global Utility Library for Omni Media Hub
// Safe, defensive, XAMPP-friendly utilities
// @ts-nocheck

(function () {
  if (window.__OMNI_UTILS) return;
  window.__OMNI_UTILS = true;

  /* ----------------------------------------------------------
       BASIC STORAGE HELPERS (safe JSON load/save)
     ---------------------------------------------------------- */

  window.load = function (key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.warn("load() failed for key:", key);
      return fallback;
    }
  };

  window.save = function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn("save() failed for key:", key);
    }
  };

  /* ----------------------------------------------------------
       ESCAPE HTML (safe rendering of text)
     ---------------------------------------------------------- */

  window.escapeHtml = function (str) {
    if (str === undefined || str === null) return "";
    return String(str).replace(/[&<>"']/g, (t) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[t]));
  };

  /* ----------------------------------------------------------
       TOAST NOTIFICATIONS (universal, small & simple)
     ---------------------------------------------------------- */

  window.toast = function (msg, duration = 1700) {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.style.position = "fixed";
      container.style.right = "16px";
      container.style.bottom = "16px";
      container.style.zIndex = "99999";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.textContent = msg;
    toast.style.background = "rgba(0,0,0,0.7)";
    toast.style.color = "#fff";
    toast.style.padding = "10px 14px";
    toast.style.marginTop = "8px";
    toast.style.borderRadius = "10px";
    toast.style.fontSize = "14px";
    toast.style.boxShadow = "0 4px 14px rgba(0,0,0,0.4)";
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.25s ease";
    container.appendChild(toast);

    requestAnimationFrame(() => (toast.style.opacity = "1"));
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  /* ----------------------------------------------------------
       SESSION HELPERS
     ---------------------------------------------------------- */

  window.getSession = function () {
    try {
      const raw =
        localStorage.getItem("omni_session") ||
        sessionStorage.getItem("omni_session");
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  };

  window.setSession = function (sessionObj) {
    try {
      localStorage.setItem("omni_session", JSON.stringify(sessionObj));
    } catch {}
  };

  window.clearSession = function () {
    try {
      localStorage.removeItem("omni_session");
    } catch {}
  };

  /* ----------------------------------------------------------
       JSON FILE LOADER (local XAMPP-friendly)
     ---------------------------------------------------------- */

  window.fetchJson = async function (path, fallback = null) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error("HTTP Error");
      return await res.json();
    } catch (err) {
      console.warn("fetchJson() failed:", path);
      return fallback;
    }
  };

  /* ----------------------------------------------------------
       QUERY HELPERS
     ---------------------------------------------------------- */

  window.q = function (sel, ctx = document) {
    return ctx.querySelector(sel);
  };

  window.qa = function (sel, ctx = document) {
    return Array.from(ctx.querySelectorAll(sel));
  };

  /* ----------------------------------------------------------
       SMOOTH SCROLL & SAFE NAVIGATE
     ---------------------------------------------------------- */

  window.safeScrollTo = function (x = 0, y = 0) {
    try {
      window.scrollTo({ top: y, left: x, behavior: "smooth" });
    } catch {
      window.scrollTo(0, y);
    }
  };

  window.safeRedirect = function (url) {
    if (!url) return;
    location.href = url;
  };

  /* ----------------------------------------------------------
       RANDOM HELPERS
     ---------------------------------------------------------- */

  window.uid = function (prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  };

  window.shuffle = function (arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  };

  /* ----------------------------------------------------------
       DEBUG OVERLAY (optional)
     ---------------------------------------------------------- */

  window.showDebugOverlay = function () {
    let panel = document.getElementById("omniDebugOverlay");
    if (panel) {
      panel.remove();
      return;
    }
    panel = document.createElement("div");
    panel.id = "omniDebugOverlay";
    panel.style.position = "fixed";
    panel.style.bottom = "10px";
    panel.style.left = "10px";
    panel.style.padding = "10px";
    panel.style.background = "rgba(0,0,0,0.75)";
    panel.style.color = "#fff";
    panel.style.fontSize = "12px";
    panel.style.zIndex = "99999";
    panel.style.borderRadius = "8px";
    document.body.appendChild(panel);

    setInterval(() => {
      const ses = getSession();
      panel.innerHTML = `
        <b>DEBUG</b><br>
        Session: ${ses ? ses.email : "none"}<br>
        Time: ${new Date().toLocaleTimeString()}
      `;
    }, 1000);
  };
})();
