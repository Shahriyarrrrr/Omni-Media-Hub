/**
 * js/playlists.js
 * Playlist manager for Omni Media Hub (Spotify-style).
 *
 * Features:
 * - Create, rename, delete playlists
 * - View playlist details modal
 * - Reorder playlists via drag & drop
 * - Reorder tracks inside a playlist
 * - Add / remove tracks (manual entry)
 * - Export / import playlists JSON
 * - Play playlist (pushes playlist tracks to omni_queue & opens player)
 *
 * Storage keys:
 * - omni_playlists (array of { name, id, tracks: [trackId or track object], createdAt, updatedAt })
 * - omni_queue (shared with music player)
 */

(function () {
  // small runtime guard to ensure required DOM elements exist
  function required(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error('Required DOM element missing: #' + id);
    return el;
  }

  // DOM
  const plSearch = required('plSearch');
  const newPlInput = required('newPlInput');
  const createPlBtn = required('createPlBtn');
  const playlistsGrid = required('playlistsGrid');
  const importBtn = required('importBtn');
  const exportBtn = required('exportBtn');
  const importFile = required('importFile');
  const plModal = required('plModal');
  const closePlModal = required('closePlModal');
  const plModalTitle = required('plModalTitle');
  const plCover = required('plCover');
  const plNameInput = required('plNameInput');
  const plStats = required('plStats');
  const plTrackList = required('plTrackList');
  const playPlBtn = required('playPlBtn');
  const queuePlBtn = required('queuePlBtn');
  const deletePlBtn = required('deletePlBtn');
  const addTrackManual = required('addTrackManual');
  const savePlBtn = required('savePlBtn');
  const toastContainer = required('toastContainer');

  // storage keys
  const KEY_PLAYLISTS = 'omni_playlists';
  const KEY_QUEUE = 'omni_queue';
  const KEY_CUR_INDEX = 'omni_current_index';

  // state
  let playlists = JSON.parse(localStorage.getItem(KEY_PLAYLISTS) || '[]');
  let activePl = null; // currently open playlist object
  let dragSrcIndex = null; // for playlist card drag
  let trackDragSrc = null; // for track reorder inside modal

  // helpers
  function savePlaylists() {
    playlists = playlists || [];
    localStorage.setItem(KEY_PLAYLISTS, JSON.stringify(playlists));
  }

  function toast(msg, t = 1800) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    toastContainer.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 240); }, t);
  }

  // Basic ID generator
  function genId(prefix = 'pl') {
    return prefix + '_' + Math.random().toString(36).slice(2, 9);
  }

  // Gradient generator from string (deterministic)
  function gradientFor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
    const c1 = ((hash >> 0) & 0xffffff).toString(16).padStart(6, '0');
    const c2 = ((hash >> 8) & 0xffffff).toString(16).padStart(6, '0');
    return `linear-gradient(135deg,#${c1},#${c2})`;
  }

  // Simple playlist card template
  function createPlaylistCard(pl, idx) {
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.draggable = true;
    card.dataset.idx = String(idx);
    card.style.background = gradientFor(pl.name || 'Playlist');
    card.innerHTML = `
      <div class="card-top">
        <div class="pl-title">${escapeHtml(pl.name)}</div>
        <div class="card-controls">
          <button class="icon-btn btn-open" title="Open">Open</button>
          <button class="icon-btn btn-more" title="More">⋯</button>
        </div>
      </div>
      <div class="pl-sub">${(pl.tracks||[]).length} track(s)</div>
      <div class="pl-cover-mini" aria-hidden="true"><svg width="200" height="200" viewBox="0 0 200 200" fill="none"><rect width="200" height="200" rx="12" fill="rgba(0,0,0,0.08)"/></svg></div>
    `;
    // open on click
    card.querySelector('.btn-open').addEventListener('click', (e) => {
      e.stopPropagation();
      openPlaylistModal(pl);
    });
    // also card click opens
    card.addEventListener('click', () => openPlaylistModal(pl));

    // drag handlers
    card.addEventListener('dragstart', (e) => {
      dragSrcIndex = Number(card.dataset.idx);
      card.classList.add('dragging');
      try { e.dataTransfer.effectAllowed = 'move'; } catch (err) { /* ignore */ }
    });
    card.addEventListener('dragover', (e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (err) {} });
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetIdx = Number(card.dataset.idx);
      if (!Number.isFinite(dragSrcIndex)) return;
      const item = playlists.splice(dragSrcIndex, 1)[0];
      playlists.splice(targetIdx, 0, item);
      dragSrcIndex = null;
      savePlaylists();
      renderGrid();
      toast('Playlists reordered');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    return card;
  }

  // escape helpers
  function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escapeAttr(s) { return String(s||'').replace(/"/g,'&quot;'); }

  // render grid
  function renderGrid(filter = '') {
    playlistsGrid.innerHTML = '';
    const list = playlists.filter(pl => pl.name.toLowerCase().includes(filter.toLowerCase()));
    if (!list.length) {
      const p = document.createElement('div'); p.className = 'muted'; p.textContent = 'No playlists yet — create one.';
      playlistsGrid.appendChild(p);
      return;
    }
    list.forEach((pl, i) => playlistsGrid.appendChild(createPlaylistCard(pl, i)));
  }

  // create new playlist
  createPlBtn.addEventListener('click', () => {
    const name = newPlInput.value.trim();
    if (!name) return toast('Enter playlist name');
    const pl = { id: genId('pl'), name, tracks: [], createdAt: Date.now(), updatedAt: Date.now() };
    playlists.unshift(pl);
    savePlaylists();
    newPlInput.value = '';
    renderGrid(plSearch.value || '');
    toast('Playlist created');
  });

  // search
  plSearch.addEventListener('input', (e) => renderGrid(e.target.value));

  // import/export
  exportBtn.addEventListener('click', () => {
    try {
      const blob = new Blob([JSON.stringify(playlists, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omni_playlists_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Playlists exported');
    } catch (err) { toast('Export failed'); }
  });

  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const obj = JSON.parse(ev.target.result);
        if (!Array.isArray(obj)) throw new Error('Invalid file');
        // append imported but ensure unique ids
        obj.forEach(pl => {
          pl.id = pl.id || genId('pl');
          pl.tracks = pl.tracks || [];
          pl.createdAt = pl.createdAt || Date.now();
          pl.updatedAt = Date.now();
          playlists.unshift(pl);
        });
        savePlaylists();
        renderGrid();
        toast('Imported playlists');
      } catch (err) { toast('Import failed'); }
    };
    reader.readAsText(f);
    // reset file input
    e.target.value = '';
  });

  // Playlist modal logic
  function openPlaylistModal(pl) {
    activePl = pl;
    plModal.setAttribute('aria-hidden', 'false');
    plModalTitle.textContent = pl.name || 'Playlist';
    plCover.style.background = gradientFor(pl.name || 'Playlist');
    plNameInput.value = pl.name || '';
    plStats.textContent = `${(pl.tracks||[]).length} track(s) • Created ${new Date(pl.createdAt).toLocaleDateString()}`;
    renderTrackList();
  }

  closePlModal.addEventListener('click', () => { plModal.setAttribute('aria-hidden', 'true'); activePl = null; });

  // track list inside modal
  function renderTrackList() {
    plTrackList.innerHTML = '';
    if (!activePl || !Array.isArray(activePl.tracks) || activePl.tracks.length === 0) {
      plTrackList.innerHTML = '<li class="muted">No tracks — add manually or from library.</li>';
      return;
    }
    activePl.tracks.forEach((t, i) => {
      const li = document.createElement('li');
      li.className = 'pl-track';
      li.draggable = true;
      li.dataset.i = String(i);
      // allow t to be object with title/artist/cover or a string id/title fallback
      const title = t.title || String(t);
      const artist = t.artist || '';
      const cover = t.cover || 'assets/images/music-placeholder.jpg';
      li.innerHTML = `
        <img class="t-cover" src="${escapeAttr(cover)}" alt="cover">
        <div class="t-info"><strong>${escapeHtml(title)}</strong><div class="muted">${escapeHtml(artist)}</div></div>
        <div class="t-actions">
          <button class="btn play" data-i="${i}">Play</button>
          <button class="btn remove" data-i="${i}">Remove</button>
        </div>
      `;
      li.querySelector('.play').addEventListener('click', () => playPlaylistFrom(i));
      li.querySelector('.remove').addEventListener('click', () => { activePl.tracks.splice(i,1); plStats.textContent = `${activePl.tracks.length} track(s)`; renderTrackList(); });

      // drag inside track list
      li.addEventListener('dragstart', (e) => { trackDragSrc = Number(li.dataset.i); li.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; } catch (err) {} });
      li.addEventListener('dragover', (e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (err) {} });
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetIdx = Number(li.dataset.i);
        if (trackDragSrc === null) return;
        const item = activePl.tracks.splice(trackDragSrc,1)[0];
        activePl.tracks.splice(targetIdx,0,item);
        trackDragSrc = null;
        renderTrackList();
      });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));

      plTrackList.appendChild(li);
    });
  }

  // play playlist from index (pushes to omni_queue and opens player)
  function playPlaylistFrom(index) {
    const q = JSON.parse(localStorage.getItem(KEY_QUEUE) || '[]');
    // push playlist tracks at front of queue, in-play order (index first)
    const plTracks = activePl.tracks.slice(index).concat(activePl.tracks.slice(0, index));
    // For simplicity store full track objects if present; otherwise store titles
    localStorage.setItem(KEY_QUEUE, JSON.stringify(plTracks));
    // set current index 0 and open player
    localStorage.setItem(KEY_CUR_INDEX, '0');
    // navigate to music player
    window.location.href = 'music-player.html';
  }

  // add to queue (append)
  function queuePlaylist() {
    const q = JSON.parse(localStorage.getItem(KEY_QUEUE) || '[]');
    const newQ = q.concat(activePl.tracks || []);
    localStorage.setItem(KEY_QUEUE, JSON.stringify(newQ));
    toast('Playlist added to queue');
  }

  // delete playlist
  deletePlBtn.addEventListener('click', () => {
    if (!activePl) return;
    if (!confirm('Delete playlist "' + activePl.name + '"?')) return;
    playlists = playlists.filter(p => p.id !== activePl.id);
    savePlaylists();
    plModal.setAttribute('aria-hidden','true');
    activePl = null;
    renderGrid();
    toast('Playlist deleted');
  });

  playPlBtn.addEventListener('click', () => {
    if (!activePl) return;
    // set omni_queue to this playlist tracks and open player at index 0
    localStorage.setItem(KEY_QUEUE, JSON.stringify(activePl.tracks || []));
    localStorage.setItem(KEY_CUR_INDEX, '0');
    window.location.href = 'music-player.html';
  });

  queuePlBtn.addEventListener('click', () => {
    if (!activePl) return queuePlaylist();
    queuePlaylist();
  });

  // add track manually (prompts for basic fields)
  addTrackManual.addEventListener('click', () => {
    if (!activePl) return;
    const title = prompt('Track title (required)').trim();
    if (!title) return;
    const artist = prompt('Artist (optional)').trim();
    const file = prompt('Audio file path or URL (optional)').trim();
    const cover = prompt('Cover image path or URL (optional)').trim();
    activePl.tracks.push({ title, artist, file, cover });
    plStats.textContent = `${activePl.tracks.length} track(s)`;
    renderTrackList();
  });

  // save playlist changes (rename etc.)
  savePlBtn.addEventListener('click', () => {
    if (!activePl) return;
    const newName = plNameInput.value.trim();
    if (!newName) return toast('Playlist name required');
    activePl.name = newName;
    activePl.updatedAt = Date.now();
    savePlaylists();
    renderGrid();
    toast('Playlist saved');
  });

  // initialization
  function init() {
    // if no playlists, seed a sample one for demo
    if (!Array.isArray(playlists) || playlists.length === 0) {
      playlists = [{
        id: genId('pl'),
        name: 'Favorites',
        tracks: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }];
      savePlaylists();
    }
    renderGrid();
  }

  // expose for debugging
  window.__OMNI_PLAYLISTS = { get: () => playlists, save: savePlaylists, open: openPlaylistModal };

  init();

})();
