/**
 * js/playlist-details.js
 * Deep editor for a single playlist.
 *
 * Usage:
 * - This page expects a query param ?id=<playlistId>
 * - If no id is provided, it will open the first playlist saved in localStorage
 *
 * Keys:
 * - omni_playlists: array of playlist objects { id, name, description, tags, cover, tracks: [...] }
 * - omni_queue: used to queue tracks or start playback via music-player.html
 */

(function () {
  function required(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error('Required DOM element missing: #' + id);
    return el;
  }

  // DOM refs
  const plCoverImage = required('plCoverImage');
  const plCoverInput = required('plCoverInput');
  const plTitle = required('plTitle');
  const plDesc = required('plDesc');
  const plTags = required('plTags');
  const saveBtn = required('saveBtn');
  const discardBtn = required('discardBtn');
  const exportBtn = required('exportBtn');
  const shareBtn = required('shareBtn');
  const addTrackBtn = required('addTrackBtn');
  const bulkAddBtn = required('bulkAddBtn');
  const clearTracksBtn = required('clearTracksBtn');
  const tracksList = required('tracksList');
  const tracksCount = required('tracksCount');
  const previewAudio = required('previewAudio');
  const bulkModal = required('bulkModal');
  const bulkArea = required('bulkArea');
  const closeBulk = required('closeBulk');
  const pasteDemo = required('pasteDemo');
  const applyBulk = required('applyBulk');
  const previewAllBtn = required('previewAllBtn');
  const queueAllBtn = required('queueAllBtn');
  const toastContainer = required('toastContainer');

  const KEY_PLAYLISTS = 'omni_playlists';
  const KEY_QUEUE = 'omni_queue';
  const KEY_CUR_INDEX = 'omni_current_index';

  let playlists = JSON.parse(localStorage.getItem(KEY_PLAYLISTS) || '[]');
  let plId = (new URLSearchParams(location.search)).get('id') || (playlists[0] && playlists[0].id);
  let active = playlists.find(p => p.id === plId) || null;
  let originalSnapshot = null; // used for discard
  let trackDragSrc = null;

  function toast(msg, t = 1600) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    toastContainer.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 220); }, t);
  }

  function savePlaylists() {
    localStorage.setItem(KEY_PLAYLISTS, JSON.stringify(playlists));
  }

  function ensureActive() {
    if (!active) {
      if (!playlists.length) {
        const id = 'pl_' + Math.random().toString(36).slice(2,9);
        active = { id, name: 'New Playlist', description: '', tags: [], cover: '', tracks: [], createdAt: Date.now(), updatedAt: Date.now() };
        playlists.push(active);
        savePlaylists();
      } else {
        active = playlists[0];
      }
    }
  }

  function renderHeader() {
    plCoverImage.src = active.cover || 'assets/images/music-placeholder.jpg';
    plCoverInput.value = active.cover || '';
    plTitle.value = active.name || '';
    plDesc.value = active.description || '';
    plTags.value = (active.tags || []).join(', ');
    updateTrackCount();
  }

  function updateTrackCount() {
    const n = (active.tracks || []).length;
    tracksCount.textContent = `${n} track${n === 1 ? '' : 's'}`;
  }

  function renderTracks() {
    tracksList.innerHTML = '';
    if (!active.tracks || active.tracks.length === 0) {
      const li = document.createElement('li'); li.className = 'muted'; li.textContent = 'No tracks — add one.';
      tracksList.appendChild(li);
      updateTrackCount();
      return;
    }
    active.tracks.forEach((t, i) => {
      const li = document.createElement('li');
      li.className = 'track-item';
      li.draggable = true;
      li.dataset.i = String(i);
      const title = t.title || String(t);
      const artist = t.artist || '';
      const cover = t.cover || 'assets/images/music-placeholder.jpg';
      li.innerHTML = `
        <img class="t-cover" src="${cover}" alt="cover">
        <div class="t-meta">
          <input class="t-title" value="${escapeHtml(title)}" />
          <div class="muted t-sub">${escapeHtml(artist)}</div>
        </div>
        <div class="t-controls">
          <button class="btn preview" data-i="${i}">Preview</button>
          <button class="btn edit" data-i="${i}">Edit</button>
          <button class="btn remove" data-i="${i}">Remove</button>
        </div>
      `;
      // preview
      li.querySelector('.preview').addEventListener('click', () => {
        const s = t.file || t.preview || '';
        if (!s) return toast('No audio file for preview');
        previewAudio.src = s;
        previewAudio.play().catch(()=>{ toast('Playback blocked — interact with page'); });
      });
      // edit metadata inline
      li.querySelector('.t-title').addEventListener('change', (e) => {
        const v = e.target.value.trim();
        active.tracks[i].title = v;
        savePlaylists();
      });
      // remove
      li.querySelector('.remove').addEventListener('click', () => {
        if (!confirm('Remove track?')) return;
        active.tracks.splice(i,1);
        savePlaylists();
        renderTracks();
        updateTrackCount();
        toast('Track removed');
      });
      // drag handlers
      li.addEventListener('dragstart', (e) => { trackDragSrc = Number(li.dataset.i); li.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; } catch (err) {} });
      li.addEventListener('dragover', (e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (err) {} });
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetIdx = Number(li.dataset.i);
        if (trackDragSrc === null) return;
        const item = active.tracks.splice(trackDragSrc, 1)[0];
        active.tracks.splice(targetIdx, 0, item);
        trackDragSrc = null;
        savePlaylists();
        renderTracks();
      });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));

      tracksList.appendChild(li);
    });
    updateTrackCount();
  }

  // Add single track (prompt)
  addTrackBtn.addEventListener('click', () => {
    const title = prompt('Track title (required)');
    if (!title) return;
    const artist = prompt('Artist (optional)') || '';
    const file = prompt('Audio URL or path (optional)') || '';
    const cover = prompt('Cover image URL (optional)') || '';
    active.tracks.push({ title, artist, file, cover, id: 't_' + Math.random().toString(36).slice(2,9) });
    savePlaylists();
    renderTracks();
    toast('Track added');
  });

  // Bulk add modal
  bulkAddBtn.addEventListener('click', () => {
    bulkModal.setAttribute('aria-hidden','false');
    bulkArea.value = '';
  });
  closeBulk.addEventListener('click', () => bulkModal.setAttribute('aria-hidden','true'));
  pasteDemo.addEventListener('click', () => {
    const demo = [
      { title: 'Demo Song 1', artist: 'Demo Artist', file: 'assets/audio/demo1.mp3', cover: '' },
      { title: 'Demo Song 2', artist: 'Demo Artist', file: 'assets/audio/demo2.mp3', cover: '' }
    ];
    bulkArea.value = JSON.stringify(demo, null, 2);
  });
  applyBulk.addEventListener('click', () => {
    try {
      const arr = JSON.parse(bulkArea.value);
      if (!Array.isArray(arr)) throw new Error('Invalid JSON');
      arr.forEach(item => { item.id = item.id || 't_' + Math.random().toString(36).slice(2,9); active.tracks.push(item); });
      savePlaylists();
      renderTracks();
      bulkModal.setAttribute('aria-hidden','true');
      toast('Bulk tracks added');
    } catch (err) {
      toast('Invalid JSON');
    }
  });

  // clear tracks
  clearTracksBtn.addEventListener('click', () => {
    if (!confirm('Clear all tracks from this playlist?')) return;
    active.tracks = [];
    savePlaylists();
    renderTracks();
    toast('Tracks cleared');
  });

  // export single playlist
  exportBtn.addEventListener('click', () => {
    try {
      const blob = new Blob([JSON.stringify(active, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `playlist_${(active.name||'playlist').replace(/\s+/g,'_')}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Exported playlist');
    } catch (err) { toast('Export failed'); }
  });

  // share (generate embed code or copy URL)
  shareBtn.addEventListener('click', async () => {
    const shareUrl = location.origin + location.pathname + '?id=' + encodeURIComponent(active.id);
    const payload = { title: active.name, text: active.description || '', url: shareUrl };
    if (navigator.share) {
      try { await navigator.share(payload); toast('Shared'); } catch (e) { toast('Share cancelled'); }
    } else {
      try { await navigator.clipboard.writeText(shareUrl); toast('Link copied'); } catch (e) { toast('Copy failed'); }
    }
  });

  // Save / Discard
  saveBtn.addEventListener('click', () => {
    active.name = plTitle.value.trim() || active.name;
    active.description = plDesc.value.trim();
    active.tags = plTags.value.split(',').map(s => s.trim()).filter(Boolean);
    active.cover = plCoverInput.value.trim();
    active.updatedAt = Date.now();
    // save into playlists array
    const idx = playlists.findIndex(p => p.id === active.id);
    if (idx >= 0) playlists[idx] = active;
    else playlists.push(active);
    savePlaylists();
    originalSnapshot = JSON.stringify(active);
    toast('Playlist saved');
  });

  discardBtn.addEventListener('click', () => {
    if (!originalSnapshot) {
      toast('Nothing to discard');
      return;
    }
    active = JSON.parse(originalSnapshot);
    // update playlists array
    const idx = playlists.findIndex(p => p.id === active.id);
    if (idx >= 0) playlists[idx] = active;
    savePlaylists();
    renderHeader();
    renderTracks();
    toast('Changes discarded');
  });

  // preview all (plays first track)
  previewAllBtn.addEventListener('click', () => {
    const first = (active.tracks||[])[0];
    if (!first || !first.file) return toast('No preview available');
    previewAudio.src = first.file;
    previewAudio.play().catch(()=>toast('Playback blocked — interact first'));
  });

  // queue all tracks (append to omni_queue)
  queueAllBtn.addEventListener('click', () => {
    const q = JSON.parse(localStorage.getItem(KEY_QUEUE) || '[]');
    const newQ = q.concat(active.tracks || []);
    localStorage.setItem(KEY_QUEUE, JSON.stringify(newQ));
    toast('Playlist added to queue');
  });

  // keyboard shortcuts (save: Ctrl+S)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveBtn.click();
    }
  });

  // initialization
  function init() {
    playlists = JSON.parse(localStorage.getItem(KEY_PLAYLISTS) || '[]');
    ensureActive();
    // capture snapshot
    originalSnapshot = JSON.stringify(active);
    renderHeader();
    renderTracks();
  }

  init();

})();
