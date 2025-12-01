// @ts-nocheck
(function () {
  "use strict";

  function required(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error("Missing required element: #" + id);
    return el;
  }

  const artistNameEl = required("artistName");
  const artistImageEl = required("artistImage");
  const artistBioEl = required("artistBio");
  const artistFollowersEl = required("artistFollowers");
  const songListEl = required("songList");

  const followBtn = required("followBtn");
  const shuffleBtn = required("shuffleBtn");
  const editBtn = required("editBtn");
  const toastContainer = required("toastContainer");

  let artist = null;
  let artistId = null;
  let musicData = [];
  let isFollowing = false;

  /* ---------------- TOAST ---------------- */
  function toast(msg, ms = 1500) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 220);
    }, ms);
  }

  /* ---------------- URL PARAM ---------------- */
  function getArtistId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  }

  /* ---------------- LOAD ARTIST ---------------- */
  function loadArtistData() {
    const raw = localStorage.getItem("omni_artists");
    let list = [];

    try {
      list = raw ? JSON.parse(raw) : [];
    } catch (e) {
      list = [];
    }

    artist = list.find((a) => String(a.id) === String(artistId));
    if (!artist) {
      toast("Artist not found");
      return;
    }

    renderArtistInfo();
  }

  /* ---------------- LOAD MUSIC ---------------- */
  async function loadMusicData() {
    try {
      const res = await fetch("data/music.json");
      musicData = await res.json();
    } catch (e) {
      musicData = [];
    }
    renderSongs();
  }

  /* ---------------- RENDER ARTIST HEADER ---------------- */
  function renderArtistInfo() {
    artistNameEl.textContent = artist.name || "Unknown Artist";
    artistImageEl.src = artist.image || "assets/images/artist-placeholder.jpg";
    artistBioEl.textContent = artist.bio || "No biography available.";

    // Fake dynamic followers for UI effect
    const followers = Math.floor(Math.random() * 80000) + 5000;
    artistFollowersEl.textContent = followers.toLocaleString() + " followers";

    // Hero background
    const hero = document.getElementById("hero");
    hero.style.backgroundImage = `url('${artist.image}')`;
  }

  /* ---------------- RENDER SONGS ---------------- */
  function renderSongs() {
    songListEl.innerHTML = "";

    const songs = musicData.filter((m) => m.artistId === artistId);

    if (songs.length === 0) {
      const p = document.createElement("div");
      p.style.opacity = 0.7;
      p.textContent = "No songs available";
      songListEl.appendChild(p);
      return;
    }

    songs.forEach((s) => {
      const card = document.createElement("div");
      card.className = "song-card";

      const img = document.createElement("img");
      img.className = "song-cover";
      img.src = s.cover || "assets/images/song-placeholder.jpg";

      const info = document.createElement("div");
      info.className = "song-info";

      const title = document.createElement("div");
      title.className = "song-title";
      title.textContent = s.title;

      const dur = document.createElement("div");
      dur.className = "song-duration";
      dur.textContent = s.duration;

      info.appendChild(title);
      info.appendChild(dur);

      card.appendChild(img);
      card.appendChild(info);

      // click → open music player
      card.addEventListener("click", () => {
        localStorage.setItem("omni_current_track", JSON.stringify(s));
        window.location.href = "music-player.html";
      });

      songListEl.appendChild(card);
    });
  }

  /* ---------------- FOLLOW / SHUFFLE / EDIT ---------------- */

  followBtn.addEventListener("click", () => {
    isFollowing = !isFollowing;
    followBtn.textContent = isFollowing ? "Following" : "Follow";
    toast(isFollowing ? "You are now following" : "Unfollowed");
  });

  shuffleBtn.addEventListener("click", () => {
    toast("Shuffling songs...");
    window.location.href = "music-player.html";
  });

  editBtn.addEventListener("click", () => {
    window.location.href = "artists.html";
  });

  /* ---------------- INIT ---------------- */
  (function init() {
    artistId = getArtistId();
    if (!artistId) {
      toast("Invalid artist id");
      return;
    }

    loadArtistData();
    loadMusicData();
  })();
})();
