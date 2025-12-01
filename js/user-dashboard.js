// @ts-nocheck
/**
 * js/user-dashboard.js
 * Frontend-only user dashboard for Omni Media Hub.
 *
 * Protects page: requires a session in localStorage/sessionStorage with role 'user'.
 *
 * Local storage keys read/written:
 * - omni_users, omni_movies, omni_music, omni_logs, omni_playlists, omni_favorites, omni_settings
 *
 * Mini-player uses HTML5 <audio> and stores playback state in-memory.
 */

(function () {
  "use strict";

  // helpers
  function required(id) { const el = document.getElementById(id); if (!el) throw new Error('Missing #' + id); return el; }
  function q(sel, ctx=document) { return ctx.querySelector(sel); }
  function qa(sel, ctx=document) { return Array.from(ctx.querySelectorAll(sel)); }
  function load(key, def) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; } catch { return def; } }
  function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function uid(pref='id') { return pref + '_' + Math.random().toString(36).slice(2,9); }
  function nowISO() { return new Date().toISOString(); }

  // session check (user)
  function requireUser() {
    try {
      const raw = localStorage.getItem('omni_session') || sessionStorage.getItem('omni_session');
      if (!raw) { window.location.href = 'login.html'; return null; }
      const s = JSON.parse(raw);
      if (!s || s.role !== 'user') { window.location.href = 'login.html'; return null; }
      return s;
    } catch (e) { window.location.href = 'login.html'; return null; }
  }

  const session = requireUser();
  if (!session) return;

  // DOM refs
  const navBtns = qa('.nav-btn');
  const sections = qa('.section');
  const userNameEl = required('userName');
  const userEmailEl = required('userEmail');
  const userAvatarEl = required('userAvatar');
  const greetingNameEl = required('greetingName');
  const playlistsListEl = required('playlistsList');
  const recommendListEl = required('recommendList');
  const playlistViewEl = required('playlistView');
  const recommendFullEl = required('recommendFull');
  const historyListEl = required('historyList');
  const volSettingEl = required('volSetting');
  const miniToggleEl = required('miniToggle');

  // player elements
  const audio = required('audioPlayer');
  const playPauseBtn = required('playPauseBtn');
  const prevBtn = required('prevBtn');
  const nextBtn = required('nextBtn');
  const mpTitle = required('mpTitle');
  const mpArtist = required('mpArtist');
  const mpSeek = required('mpSeek');
  const miniPlayerWrap = required('miniPlayer');

  // other UI
  const logoutBtn = required('logoutBtn');
  const searchInput = required('searchInput');
  const newPlaylistBtn = required('newPlaylistBtn');

  // state
  let playlists = load('omni_playlists', []);
  let favorites = load('omni_favorites', []);
  let music = load('omni_music', []);
  let movies = load('omni_movies', []);
  let logs = load('omni_logs', []);
  let settings = load('omni_settings', {});
  let currentQueue = []; // array of track objects {id, title, artist, src}
  let currentIndex = -1;
  let isPlaying = false;
  let seekTimer = null;

  // init UI with session user
  function initUser() {
    userNameEl.textContent = session.name || (session.email || 'User').split('@')[0];
    greetingNameEl.textContent = userNameEl.textContent;
    userEmailEl.textContent = session.email || '';
    userAvatarEl.textContent = (session.name || session.email || 'U').slice(0,1).toUpperCase();
  }

  // seed some minimal structures if missing
  function ensureStores() {
    if (!Array.isArray(music)) { music = []; save('omni_music', music); }
    if (!Array.isArray(movies)) { movies = []; save('omni_movies', movies); }
    if (!Array.isArray(playlists)) { playlists = []; save('omni_playlists', playlists); }
    if (!Array.isArray(favorites)) { favorites = []; save('omni_favorites', favorites); }
    if (!Array.isArray(logs)) { logs = []; save('omni_logs', logs); }
  }

  // render playlists list (summary)
  function renderPlaylists() {
    playlistsListEl.innerHTML = '';
    if (playlists.length === 0) {
      playlistsListEl.innerHTML = '<div class="small muted">No playlists yet.</div>';
      return;
    }
    playlists.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.dataset.id = pl.id;
      item.innerHTML = `
        <div>
          <div style="font-weight:700">${pl.name}</div>
          <div class="small muted">${(pl.items||[]).length} items</div>
        </div>
        <div class="playlist-actions">
          <button class="btn" data-action="open">Open</button>
          <button class="btn" data-action="play">Play</button>
          <button class="btn small" data-action="del">Delete</button>
        </div>
      `;
      playlistsListEl.appendChild(item);
    });
  }

  // render recommendations (quick)
  function renderRecommendations(limit=6) {
    recommendListEl.innerHTML = '';
    recommendFullEl.innerHTML = '';

    // Recommend: top music items that are not in favorites (simple heuristic)
    const pool = music.concat(movies.map(m => ({...m, artist: m.artist || '', title: m.title})));
    const filtered = pool.filter(i => !favorites.includes(i.id));
    const top = filtered.slice(0, limit);
    top.forEach(it => {
      const el = document.createElement('div');
      el.className = 'rec-item';
      el.innerHTML = `
        <div class="recommend-cover"></div>
        <div class="meta">
          <div style="font-weight:700">${it.title}</div>
          <div class="small muted">${it.artist || it.year || ''}</div>
        </div>
        <div>
          <button class="btn small" data-action="fav" data-id="${it.id}">${favorites.includes(it.id) ? '★' : '☆'}</button>
          <button class="btn small" data-action="play" data-id="${it.id}">Play</button>
        </div>
      `;
      recommendListEl.appendChild(el);
    });

    // full recommendations grid
    const full = filtered.slice(0, 24);
    full.forEach(it => {
      const c = document.createElement('div');
      c.className = 'recommend-card';
      c.innerHTML = `<div class="recommend-cover"></div><div style="flex:1"><div style="font-weight:700">${it.title}</div><div class="small muted">${it.artist||it.year||''}</div></div>
        <div><button class="btn small" data-action="play" data-id="${it.id}">Play</button></div>`;
      recommendFullEl.appendChild(c);
    });
  }

  // render history from omni_logs (recent playback logs)
  function renderHistory() {
    historyListEl.innerHTML = '';
    const recent = logs.slice(0, 100);
    if (recent.length === 0) { historyListEl.innerHTML = '<div class="small muted">No history yet.</div>'; return; }
    recent.forEach(l => {
      const it = document.createElement('div');
      it.className = 'list-item';
      it.innerHTML = `<div><div class="small muted">${new Date(l.time).toLocaleString()}</div><div>${l.msg}</div></div>`;
      historyListEl.appendChild(it);
    });
  }

  // open playlist view
  function openPlaylist(plId) {
    const pl = playlists.find(p => p.id === plId);
    if (!pl) return alert('Playlist not found');
    // show modal with playlist details
    openModal(`
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:800">${pl.name}</div>
        <button data-close class="btn">Close</button>
      </div>
      <div style="margin-top:12px">
        <div id="plItems" style="display:flex;flex-direction:column;gap:8px"></div>
        <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
          <button id="plShuffle" class="btn">Shuffle Play</button>
        </div>
      </div>
    `);

    const container = modalPanel.querySelector('#plItems');
    (pl.items||[]).forEach(id => {
      // find item in music/movies
      const it = music.find(m => m.id === id) || movies.find(m => m.id === id) || { title: 'Unknown' };
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML = `<div><div style="font-weight:700">${it.title}</div><div class="small muted">${it.artist||it.year||''}</div></div>
        <div><button class="btn small" data-action="play" data-id="${id}">Play</button></div>`;
      container.appendChild(row);
    });

    // play handlers inside modal
    modalPanel.querySelector('#plShuffle').addEventListener('click', () => {
      playQueue(pl.items.slice().sort(()=>Math.random()-0.5), 0);
      closeModal();
    });
    modalBackdrop.setAttribute('aria-hidden','false');
  }

  // play a single item by id
  function playItemById(id) {
    // find in music or movies (use music as audio; movies will be ignored or treated same)
    const track = music.find(m => m.id === id);
    if (!track) { alert('Item not playable'); return; }
    playQueue([id], 0);
  }

  // queue play
  function playQueue(ids, startIndex=0) {
    currentQueue = ids.map(id => {
      const t = music.find(m => m.id === id) || { id, title: 'Unknown', artist: '' };
      return { id: t.id, title: t.title, artist: t.artist || '', src: t.src || '' };
    });
    currentIndex = startIndex;
    startPlayback();
  }

  // start playback (play currentIndex of queue)
  function startPlayback() {
    if (!currentQueue.length || currentIndex < 0 || currentIndex >= currentQueue.length) { stopPlayback(); return; }
    const track = currentQueue[currentIndex];
    // if no src provided, attempt to use a placeholder silent audio (base64 short mp3) or skip
    const src = track.src || '';
    if (!src) {
      // no audio resource — log and show title only (no sound)
      mpTitle.textContent = track.title;
      mpArtist.textContent = track.artist;
      logHistory(`Played (no audio) ${track.title}`);
      isPlaying = false;
      playPauseBtn.textContent = '▶';
      return;
    }
    audio.src = src;
    audio.volume = Number(settings.defaultVolume ?? 0.8);
    audio.play().then(() => {
      isPlaying = true;
      playPauseBtn.textContent = '⏸';
      mpTitle.textContent = track.title;
      mpArtist.textContent = track.artist;
      logHistory(`Playing ${track.title}`);
    }).catch(() => {
      isPlaying = false;
      playPauseBtn.textContent = '▶';
      logHistory(`Playback failed ${track.title}`);
    });
  }

  function stopPlayback() {
    audio.pause();
    isPlaying = false;
    playPauseBtn.textContent = '▶';
    mpTitle.textContent = '—';
    mpArtist.textContent = '—';
  }

  function prevTrack() {
    if (currentIndex > 0) { currentIndex--; startPlayback(); }
  }
  function nextTrack() {
    if (currentIndex < currentQueue.length -1) { currentIndex++; startPlayback(); }
  }

  function togglePlayPause() {
    if (!currentQueue.length) return;
    if (isPlaying) { audio.pause(); isPlaying = false; playPauseBtn.textContent = '▶'; }
    else { audio.play().then(()=>{ isPlaying=true; playPauseBtn.textContent='⏸'; }).catch(()=>{}); }
  }

  // update seek bar
  function attachAudioEvents() {
    audio.addEventListener('timeupdate', () => {
      if (!audio.duration || isNaN(audio.duration)) return;
      const p = Math.floor((audio.currentTime / audio.duration) * 100);
      mpSeek.value = String(p);
    });
    audio.addEventListener('ended', () => {
      // auto next
      if (currentIndex < currentQueue.length -1) { currentIndex++; startPlayback(); }
      else { isPlaying = false; playPauseBtn.textContent = '▶'; }
    });
    mpSeek.addEventListener('input', () => {
      if (!audio.duration || isNaN(audio.duration)) return;
      const pct = Number(mpSeek.value) / 100;
      audio.currentTime = audio.duration * pct;
    });
  }

  // favorites
  function toggleFavorite(id, buttonEl) {
    const idx = favorites.indexOf(id);
    if (idx === -1) { favorites.push(id); buttonEl.textContent = '★'; }
    else { favorites.splice(idx,1); buttonEl.textContent = '☆'; }
    save('omni_favorites', favorites);
  }

  // logs history
  function logHistory(msg) {
    logs.unshift({ id: uid('log'), time: nowISO(), msg });
    save('omni_logs', logs);
    renderHistory();
  }

  // modal helpers
  const modalBackdrop = required('modalBackdrop');
  const modalPanel = required('modalPanel');
  function openModal(html) { modalPanel.innerHTML = html; modalBackdrop.setAttribute('aria-hidden', 'false'); const close = modalPanel.querySelector('[data-close]'); if (close) close.addEventListener('click', closeModal); }
  function closeModal() { modalBackdrop.setAttribute('aria-hidden', 'true'); }

  // create playlist
  function createPlaylist(name) {
    if (!name) return alert('Enter a name');
    const pl = { id: uid('pl'), name, items: [] };
    playlists.unshift(pl);
    save('omni_playlists', playlists);
    renderPlaylists();
    logHistory(`Created playlist ${name}`);
  }

  // delete playlist
  function deletePlaylist(id) {
    const idx = playlists.findIndex(p => p.id === id);
    if (idx === -1) return;
    const rem = playlists.splice(idx,1)[0];
    save('omni_playlists', playlists);
    renderPlaylists();
    logHistory(`Deleted playlist ${rem.name}`);
  }

  // open playlist for editing/playing
  function openPlaylistEditor(id) {
    const pl = playlists.find(p => p.id === id);
    if (!pl) return;
    openModal(`
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:800">${pl.name}</div><button data-close class="btn">Close</button>
      </div>
      <div style="margin-top:12px">
        <div id="plEditorList" style="display:flex;flex-direction:column;gap:8px"></div>
        <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
          <button id="plAddSong" class="btn">Add Song</button>
          <button id="plSave" class="btn primary">Save</button>
        </div>
      </div>
    `);
    const editorList = modalPanel.querySelector('#plEditorList');
    function refreshEditor() {
      editorList.innerHTML = '';
      (pl.items||[]).forEach(id => {
        const it = music.find(m => m.id === id) || { title: 'Unknown' };
        const row = document.createElement('div');
        row.className = 'list-item';
        row.innerHTML = `<div>${it.title}</div><div><button class="btn small" data-action="remove" data-id="${id}">Remove</button></div>`;
        editorList.appendChild(row);
      });
    }
    refreshEditor();
    modalPanel.querySelector('#plAddSong').addEventListener('click', () => {
      // show simple chooser
      const choices = music.map(m => `<option value="${m.id}">${m.title} ${m.artist? '— '+m.artist:''}</option>`).join('');
      const html = `<div style="font-weight:700">Add song to ${pl.name}</div>
        <div style="margin-top:8px"><select id="chooseSong">${choices}</select></div>
        <div style="margin-top:12px;text-align:right"><button id="chooseSave" class="btn primary">Add</button></div>`;
      openModal(html);
      modalPanel.querySelector('#chooseSave').addEventListener('click', () => {
        const sel = modalPanel.querySelector('#chooseSong').value;
        // append to playlist
        const targetPl = playlists.find(p=>p.id===pl.id);
        if (!targetPl.items) targetPl.items = [];
        targetPl.items.push(sel);
        save('omni_playlists', playlists);
        closeModal();
        openPlaylistEditor(pl.id); // reopen editor
      });
    });

    // remove handler via delegate
    modalPanel.addEventListener('click', function onDel(e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.action === 'remove') {
        const id = btn.dataset.id;
        const idx = pl.items.indexOf(id);
        if (idx !== -1) pl.items.splice(idx,1);
        save('omni_playlists', playlists);
        refreshEditor();
      }
      if (btn.id === 'plSave') {
        save('omni_playlists', playlists);
        closeModal();
        renderPlaylists();
      }
    }, { once: false });
  }

  // UI interactions wiring
  function wireUI() {
    // nav
    navBtns.forEach(b => b.addEventListener('click', () => {
      navBtns.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const sec = b.dataset.section;
      sections.forEach(s => s.classList.remove('active'));
      document.querySelector(`.section[data-section="${sec}"]`).classList.add('active');
    }));

    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('omni_session'); sessionStorage.removeItem('omni_session');
      window.location.href = 'login.html';
    });

    // search
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      // simple filter in recommendations
      renderRecommendations(12);
      // highlight results visually if needed
    });

    // playlists list click
    playlistsListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.closest('.list-item').dataset.id;
      const action = btn.dataset.action;
      if (action === 'open') openPlaylist(id);
      if (action === 'play') {
        const pl = playlists.find(p=>p.id===id);
        if (pl && pl.items && pl.items.length) playQueue(pl.items,0);
      }
      if (action === 'del') {
        if (confirm('Delete playlist?')) deletePlaylist(id);
      }
    });

    // playlist view handlers
    playlistViewEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      const pid = btn.dataset.pl;
      if (action === 'open') openPlaylistEditor(pid);
      if (action === 'play') { const pl = playlists.find(p=>p.id===pid); if (pl) playQueue(pl.items,0); }
    });

    // recommendation play/favorite
    recommendListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action; const id = btn.dataset.id;
      if (action === 'play') playItemById(id);
      if (action === 'fav') toggleFavorite(id, btn);
    });

    recommendFullEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.dataset.id;
      playItemById(id);
    });

    // history interactions (none for now)

    // new playlist
    newPlaylistBtn.addEventListener('click', () => {
      openModal(`
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:800">New Playlist</div><button data-close class="btn">Close</button>
        </div>
        <div style="margin-top:12px">
          <label class="small">Playlist name</label>
          <input id="plName" />
          <div style="text-align:right;margin-top:12px"><button id="createPlBtn" class="btn primary">Create</button></div>
        </div>
      `);
      modalPanel.querySelector('#createPlBtn').addEventListener('click', () => {
        const name = modalPanel.querySelector('#plName').value.trim();
        if (!name) return alert('Enter a name');
        createPlaylist(name);
        closeModal();
      });
    });

    // settings
    volSettingEl.addEventListener('input', (e) => {
      settings.defaultVolume = Number(e.target.value);
      save('omni_settings', settings);
      audio.volume = settings.defaultVolume;
    });
    miniToggleEl.addEventListener('change', (e) => {
      settings.miniPlayerEnabled = !!e.target.checked;
      save('omni_settings', settings);
      miniPlayerWrap.style.display = settings.miniPlayerEnabled ? 'flex' : 'none';
    });

    // mini player controls
    playPauseBtn.addEventListener('click', togglePlayPause);
    prevBtn.addEventListener('click', prevTrack);
    nextBtn.addEventListener('click', nextTrack);

    // audio events
    attachAudioEvents();

    // modal backdrop click to close
    modalBackdrop.addEventListener('click', (ev) => { if (ev.target === modalBackdrop) closeModal(); });
  }

  // open modal/backdrop references (from above)
  const modalBackdrop = required('modalBackdrop');
  const modalPanel = required('modalPanel');

  // initial render and binding
  function init() {
    ensureStores();
    renderPlaylists();
    renderRecommendations();
    renderHistory();
    // load playlists into playlist view (summary cards)
    renderPlaylistView();
    // load settings
    settings = load('omni_settings', settings);
    volSettingEl.value = Number(settings.defaultVolume ?? 0.8);
    miniToggleEl.checked = !!settings.miniPlayerEnabled;
    miniPlayerWrap.style.display = settings.miniPlayerEnabled ? 'flex' : 'none';
    // initialize UI & events
    initUser();
    wireUI();
    // initialize audio volume
    audio.volume = Number(settings.defaultVolume ?? 0.8);
  }

  // render playlist view (cards)
  function renderPlaylistView() {
    playlistViewEl.innerHTML = '';
    if (playlists.length === 0) { playlistViewEl.innerHTML = '<div class="small muted">No playlists created yet.</div>'; return; }
    playlists.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:800">${pl.name}</div>
        <div class="playlist-actions">
          <button class="btn" data-action="open" data-pl="${pl.id}">Edit</button>
          <button class="btn" data-action="play" data-pl="${pl.id}">Play</button>
        </div></div>
        <div class="playlist-controls small muted">${(pl.items||[]).length} items</div>`;
      playlistViewEl.appendChild(card);
    });
  }

  // expose a small public helper for other pages (optional)
  window.omniUserPlayer = {
    playItemById, playQueue, stopPlayback
  };

  // start
  init();

})();
