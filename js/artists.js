// @ts-nocheck
/**
 * js/artists.js
 * Artists page script — rewritten with runtime guards and TS-check disabled.
 *
 * Place this file at js/artists.js and overwrite existing file.
 * Requires the artists.html DOM elements with the IDs used below.
 *
 * LocalStorage key: "omni_artists"
 */

(function () {
  'use strict';

  // Throw a clear error if a required element is missing
  function requiredElement(id) {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error('Required DOM element not found: #' + id);
    }
    return el;
  }

  // DOM references (validated at runtime)
  const searchInput = /** @type {HTMLInputElement} */ (requiredElement('searchInput'));
  const sortSelect = /** @type {HTMLSelectElement} */ (requiredElement('sortSelect'));
  const newArtistBtn = requiredElement('newArtistBtn');
  const artistsGrid = requiredElement('artistsGrid');

  const artistModal = requiredElement('artistModal');
  const closeModal = requiredElement('closeModal');
  const modalTitle = requiredElement('modalTitle');
  const artistName = /** @type {HTMLInputElement} */ (requiredElement('artistName'));
  const artistImage = /** @type {HTMLInputElement} */ (requiredElement('artistImage'));
  const artistBio = /** @type {HTMLTextAreaElement} */ (requiredElement('artistBio'));
  const saveArtist = requiredElement('saveArtist');
  const toastContainer = requiredElement('toastContainer');

  const KEY_ARTISTS = 'omni_artists';

  // state
  let artists = [];
  let editingId = null;

  // Utility: toast
  function toast(msg, ms) {
    ms = typeof ms === 'number' ? ms : 1500;
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    toastContainer.appendChild(d);
    setTimeout(function () {
      d.style.opacity = '0';
      setTimeout(function () { d.remove(); }, 220);
    }, ms);
  }

  // Storage helpers
  function save() {
    try {
      localStorage.setItem(KEY_ARTISTS, JSON.stringify(artists));
    } catch (err) {
      console.warn('save error', err);
      toast('Save failed');
    }
  }
  function loadArtists() {
    try {
      const raw = localStorage.getItem(KEY_ARTISTS);
      artists = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(artists)) artists = [];
    } catch (err) {
      console.warn('load error', err);
      artists = [];
    }
  }

  function genId(prefix) {
    prefix = prefix || 'artist';
    return prefix + '_' + Math.random().toString(36).slice(2, 9);
  }

  // Modal controls
  function openModal(editArtist) {
    if (editArtist && typeof editArtist === 'object') {
      editingId = String(editArtist.id || '');
      modalTitle.textContent = 'Edit Artist';
      artistName.value = editArtist.name || '';
      artistImage.value = editArtist.image || '';
      artistBio.value = editArtist.bio || '';
    } else {
      editingId = null;
      modalTitle.textContent = 'Add Artist';
      artistName.value = '';
      artistImage.value = '';
      artistBio.value = '';
    }
    artistModal.setAttribute('aria-hidden', 'false');
  }
  function closeArtistModal() {
    artistModal.setAttribute('aria-hidden', 'true');
  }
  closeModal.addEventListener('click', closeArtistModal);

  // Save / Create handling
  saveArtist.addEventListener('click', function () {
    const name = (artistName.value || '').trim();
    const image = (artistImage.value || '').trim();
    const bio = (artistBio.value || '').trim();

    if (!name) {
      toast('Artist name is required');
      return;
    }

    if (editingId) {
      let idx = -1;
      for (let i = 0; i < artists.length; i++) { if (String(artists[i].id) === editingId) { idx = i; break; } }
      if (idx >= 0) {
        artists[idx].name = name;
        artists[idx].image = image;
        artists[idx].bio = bio;
        artists[idx].updatedAt = Date.now();
      } else {
        artists.push({ id: editingId || genId(), name: name, image: image, bio: bio, songs: 0, createdAt: Date.now(), updatedAt: Date.now() });
      }
      toast('Artist updated');
    } else {
      artists.push({ id: genId(), name: name, image: image, bio: bio, songs: 0, createdAt: Date.now(), updatedAt: Date.now() });
      toast('Artist created');
    }

    save();
    renderArtists();
    closeArtistModal();
  });

  // Create a single card
  function createArtistCard(a) {
    const card = document.createElement('div');
    card.className = 'artist-card';

    const img = document.createElement('img');
    img.className = 'artist-img';
    img.alt = a.name || 'artist';
    img.src = a.image || 'assets/images/artist-placeholder.jpg';

    const nameEl = document.createElement('div');
    nameEl.className = 'artist-name';
    nameEl.textContent = a.name || 'Unknown';

    const meta = document.createElement('div');
    meta.className = 'artist-meta';
    meta.textContent = (a.songs || 0) + ' song' + ((a.songs || 0) === 1 ? '' : 's');

    card.appendChild(img);
    card.appendChild(nameEl);
    card.appendChild(meta);

    // left click -> artist details
    card.addEventListener('click', function (e) {
      e.preventDefault();
      const id = String(a.id || '');
      if (!id) { toast('Invalid artist id'); return; }
      window.location.href = 'artist-details.html?id=' + encodeURIComponent(id);
    });

    // right-click -> edit modal
    card.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      openModal(a);
    });

    return card;
  }

  // Render with search & sort
  function renderArtists() {
    const q = (searchInput.value || '').trim().toLowerCase();
    const sortVal = (sortSelect.value || 'az');

    let list = artists.slice();

    if (q) {
      list = list.filter(function (a) {
        const name = String(a.name || '').toLowerCase();
        const bio = String(a.bio || '').toLowerCase();
        return name.indexOf(q) !== -1 || bio.indexOf(q) !== -1;
      });
    }

    if (sortVal === 'az') list.sort(function (x, y) { return String(x.name || '').localeCompare(String(y.name || '')); });
    else if (sortVal === 'za') list.sort(function (x, y) { return String(y.name || '').localeCompare(String(x.name || '')); });
    else if (sortVal === 'songs') list.sort(function (x, y) { return (Number(y.songs || 0) - Number(x.songs || 0)); });
    else if (sortVal === 'recent') list.sort(function (x, y) { return (Number(y.createdAt || 0) - Number(x.createdAt || 0)); });

    artistsGrid.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      const p = document.createElement('div');
      p.className = 'muted';
      p.style.gridColumn = '1/-1';
      p.style.textAlign = 'center';
      p.textContent = 'No artists found';
      artistsGrid.appendChild(p);
      return;
    }

    for (var i = 0; i < list.length; i++) {
      artistsGrid.appendChild(createArtistCard(list[i]));
    }
  }

  // Events
  searchInput.addEventListener('input', function () { renderArtists(); });
  sortSelect.addEventListener('change', function () { renderArtists(); });
  newArtistBtn.addEventListener('click', function () { openModal(null); });

  // Init
  (function init() {
    loadArtists();
    if (!Array.isArray(artists) || artists.length === 0) {
      artists = [{
        id: genId(),
        name: 'Sample Artist',
        image: 'assets/images/artist-placeholder.jpg',
        bio: 'Demo artist — edit or remove.',
        songs: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }];
      save();
    }
    renderArtists();
  }());

  // Expose lightweight debug API
  window.__OMNI_ARTISTS = {
    list: function () { return artists.slice(); },
    reload: function () { loadArtists(); renderArtists(); }
  };

})(); // IIFE
