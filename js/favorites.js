// @ts-nocheck
(function () {
  'use strict';

  function required(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error("Missing element: #" + id);
    return el;
  }

  // DOM
  const favSongsEl = required("favSongs");
  const favMoviesEl = required("favMovies");
  const noSongsEl = required("noSongs");
  const noMoviesEl = required("noMovies");
  const toastContainer = required("toastContainer");

  // Confirmation modal
  const confirmOverlay = required("confirmOverlay");
  const confirmCancel = required("confirmCancel");
  const confirmYes = required("confirmYes");

  // Storage Keys
  const KEY = "omni_favorites";
  const KEY_QUEUE = "omni_queue";
  const KEY_CUR_INDEX = "omni_current_index";

  // State
  let state = { songs: [], movies: [] };
  let pendingRemove = null;

  /* ------------------ Persistence ------------------ */

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : { songs: [], movies: [] };
      if (!state || typeof state !== "object") state = { songs: [], movies: [] };
      state.songs ||= [];
      state.movies ||= [];
    } catch {
      state = { songs: [], movies: [] };
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  /* ------------------ Toast ------------------ */

  function toast(msg, ms = 1600) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    toastContainer.appendChild(t);

    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 220);
    }, ms);
  }

  /* ------------------ Modal ------------------ */

  function showConfirm(removeAction) {
    pendingRemove = removeAction;
    confirmOverlay.classList.add("active");
  }

  function hideConfirm() {
    pendingRemove = null;
    confirmOverlay.classList.remove("active");
  }

  confirmCancel.addEventListener("click", hideConfirm);
  confirmYes.addEventListener("click", () => {
    if (pendingRemove) pendingRemove();
    hideConfirm();
  });

  /* ------------------ Song Card ------------------ */

  function createSongCard(song, idx) {
    const card = document.createElement("div");
    card.className = "fav-card";

    const cover = document.createElement("img");
    cover.src = song.cover || "assets/images/music-placeholder.jpg";
    cover.className = "fav-cover";

    const info = document.createElement("div");
    info.className = "fav-info";

    const title = document.createElement("div");
    title.className = "fav-title";
    title.textContent = song.title;

    const sub = document.createElement("div");
    sub.className = "fav-sub";
    sub.textContent = song.artist || "";

    const actions = document.createElement("div");
    actions.className = "fav-actions";

    const playBtn = document.createElement("button");
    playBtn.className = "icon-btn";
    playBtn.textContent = "►";

    const addPl = document.createElement("button");
    addPl.className = "icon-btn";
    addPl.textContent = "＋";

    const removeBtn = document.createElement("button");
    removeBtn.className = "icon-btn";
    removeBtn.textContent = "✕";

    info.append(title, sub);
    actions.append(playBtn, addPl, removeBtn);
    card.append(cover, info, actions);

    playBtn.addEventListener("click", () => {
      localStorage.setItem(KEY_QUEUE, JSON.stringify([song]));
      localStorage.setItem(KEY_CUR_INDEX, "0");
      window.location.href = "music-player.html";
    });

    addPl.addEventListener("click", () => {
      if (window.__OMNI_PLAYLISTS?.open) {
        window.__OMNI_PLAYLISTS.open(song);
        toast("Add to playlist…");
      } else toast("Playlist system missing");
    });

    removeBtn.addEventListener("click", () => {
      showConfirm(() => {
        state.songs.splice(idx, 1);
        save();
        renderSongs();
        toast("Removed from favorites");
      });
    });

    return card;
  }

  /* ------------------ Movie Card ------------------ */

  function createMovieCard(movie, idx) {
    const card = document.createElement("div");
    card.className = "fav-card";

    const cover = document.createElement("img");
    cover.src = movie.poster || "assets/images/movie-placeholder.jpg";
    cover.className = "fav-cover";

    const info = document.createElement("div");
    info.className = "fav-info";

    const title = document.createElement("div");
    title.className = "fav-title";
    title.textContent = movie.title;

    const sub = document.createElement("div");
    sub.className = "fav-sub";
    sub.textContent = movie.year || "";

    const actions = document.createElement("div");
    actions.className = "fav-actions";

    const playBtn = document.createElement("button");
    playBtn.className = "icon-btn";
    playBtn.textContent = "▶";

    const removeBtn = document.createElement("button");
    removeBtn.className = "icon-btn";
    removeBtn.textContent = "✕";

    info.append(title, sub);
    actions.append(playBtn, removeBtn);
    card.append(cover, info, actions);

    playBtn.addEventListener("click", () => {
      if (movie.id) window.location.href = "movie-details.html?id=" + movie.id;
      else toast("Movie missing ID");
    });

    removeBtn.addEventListener("click", () => {
      showConfirm(() => {
        state.movies.splice(idx, 1);
        save();
        renderMovies();
        toast("Removed from favorites");
      });
    });

    return card;
  }

  /* ------------------ Rendering ------------------ */

  function renderSongs() {
    favSongsEl.innerHTML = "";
    if (!state.songs.length) {
      noSongsEl.style.display = "block";
      return;
    }
    noSongsEl.style.display = "none";
    state.songs.forEach((s, i) => favSongsEl.append(createSongCard(s, i)));
  }

  function renderMovies() {
    favMoviesEl.innerHTML = "";
    if (!state.movies.length) {
      noMoviesEl.style.display = "block";
      return;
    }
    noMoviesEl.style.display = "none";
    state.movies.forEach((m, i) => favMoviesEl.append(createMovieCard(m, i)));
  }

  /* ------------------ INIT ------------------ */

  load();
  renderSongs();
  renderMovies();

  // Expose debugging API
  window.__OMNI_FAVORITES = {
    addSong: (s) => { state.songs.push(s); save(); renderSongs(); },
    addMovie: (m) => { state.movies.push(m); save(); renderMovies(); }
  };

})();
