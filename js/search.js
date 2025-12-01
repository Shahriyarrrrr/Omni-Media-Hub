// @ts-nocheck
(function () {
  "use strict";

  function required(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error("Missing element #" + id);
    return el;
  }

  const searchInput = required("searchInput");
  const resultsGrid = required("resultsGrid");
  const resultsSection = required("resultsSection");
  const toastContainer = required("toastContainer");

  const historyList = required("searchHistory");
  const clearHistoryBtn = required("clearHistory");

  const filters = document.querySelectorAll(".filter");

  /* ------------------- STATE ------------------- */
  const KEY_HISTORY = "omni_search_history";

  let history = [];
  let filterMode = "all";

  /* -------------- TOAST ---------------- */
  function toast(msg, ms = 1500) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 200);
    }, ms);
  }

  /* -------------- HISTORY ---------------- */
  function loadHistory() {
    const raw = localStorage.getItem(KEY_HISTORY);
    history = raw ? JSON.parse(raw) : [];
    renderHistory();
  }

  function saveHistory() {
    localStorage.setItem(KEY_HISTORY, JSON.stringify(history));
  }

  function renderHistory() {
    historyList.innerHTML = "";
    if (!history.length) {
      historyList.innerHTML = `<div class="muted">No recent searches.</div>`;
      return;
    }
    history.forEach((h) => {
      const item = document.createElement("div");
      item.className = "history-item";
      item.textContent = h;
      item.onclick = () => performSearch(h);
      historyList.appendChild(item);
    });
  }

  clearHistoryBtn.onclick = function () {
    history = [];
    saveHistory();
    renderHistory();
    toast("History cleared");
  };

  /* -------------- FILTERS ---------------- */
  filters.forEach((btn) => {
    btn.addEventListener("click", () => {
      filters.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterMode = btn.dataset.filter;
      performSearch(searchInput.value.trim());
    });
  });

  /* -------------- DATA LOADING ---------------- */
  let songs = [];
  let movies = [];
  let playlists = [];
  let artists = [];

  async function loadEverything() {
    try {
      const musicRes = await fetch("data/music.json");
      songs = await musicRes.json();
    } catch {
      songs = [];
    }

    try {
      const moviesRes = await fetch("data/movies.json");
      movies = await moviesRes.json();
    } catch {
      movies = [];
    }

    // localStorage-driven lists
    playlists = JSON.parse(localStorage.getItem("omni_playlists") || "[]");
    artists = JSON.parse(localStorage.getItem("omni_artists") || "[]");
  }

  /* -------------- SEARCH LOGIC ---------------- */
  function performSearch(q) {
    q = q.toLowerCase();

    resultsGrid.innerHTML = "";

    if (!q) return;

    // Save query
    if (!history.includes(q)) {
      history.unshift(q);
      if (history.length > 10) history.pop();
      saveHistory();
      renderHistory();
    }

    const resultCards = [];

    function matches(text) {
      return text.toLowerCase().includes(q);
    }

    /* songs */
    if (filterMode === "all" || filterMode === "songs") {
      songs.forEach((s) => {
        if (matches(s.title) || matches(s.artist)) {
          resultCards.push(makeCard("song", s.cover, s.title, s.id));
        }
      });
    }

    /* movies */
    if (filterMode === "all" || filterMode === "movies") {
      movies.forEach((m) => {
        if (matches(m.title)) {
          resultCards.push(makeCard("movie", m.poster, m.title, m.id));
        }
      });
    }

    /* artists */
    if (filterMode === "all" || filterMode === "artists") {
      artists.forEach((a) => {
        if (matches(a.name)) {
          resultCards.push(makeCard("artist", a.image, a.name, a.id));
        }
      });
    }

    /* playlists */
    if (filterMode === "all" || filterMode === "playlists") {
      playlists.forEach((p) => {
        if (matches(p.name)) {
          resultCards.push(makeCard("playlist", p.image, p.name, p.id));
        }
      });
    }

    if (!resultCards.length) {
      resultsGrid.innerHTML = `<div class="muted">No results found.</div>`;
      return;
    }

    resultCards.forEach((c) => resultsGrid.appendChild(c));
  }

  /* -------------- CREATE RESULT CARD ---------------- */
  function makeCard(type, imgSrc, title, id) {
    const card = document.createElement("div");
    card.className = "result-card";

    const img = document.createElement("img");
    img.className = "result-img";
    img.src = imgSrc || "assets/images/placeholder.jpg";

    const t = document.createElement("div");
    t.className = "result-title";
    t.textContent = title;

    const label = document.createElement("div");
    label.className = "type-label";
    label.textContent = type.toUpperCase();

    card.append(img, t, label);

    card.addEventListener("click", () => {
      if (type === "song") {
        localStorage.setItem("omni_queue", JSON.stringify([{ id, title, cover: imgSrc }]));
        localStorage.setItem("omni_current_index", "0");
        window.location.href = "music-player.html";
      }
      if (type === "movie") {
        window.location.href = "movie-details.html?id=" + id;
      }
      if (type === "artist") {
        window.location.href = "artist-details.html?id=" + id;
      }
      if (type === "playlist") {
        window.location.href = "playlist-details.html?id=" + id;
      }
    });

    return card;
  }

  /* -------------- SEARCH EVENTS ---------------- */
  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.trim();
    performSearch(q);
  });

  /* -------------- INIT ---------------- */
  loadHistory();
  loadEverything().then(() => {
    performSearch(searchInput.value.trim());
  });

})();
