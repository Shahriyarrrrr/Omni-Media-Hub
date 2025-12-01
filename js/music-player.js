// @ts-nocheck
/**
 * js/music-player.js
 * Working, production-ready music player JS with WebAudio circular visualizer.
 * This file disables TS checking for smooth editor experience (useful for large JS projects).
 *
 * Requirements:
 * - Place at js/music-player.js
 * - Ensure music-player.html contains elements with the IDs referenced below
 * - Serve via HTTP (XAMPP) for proper media/AudioContext behavior
 */

/* eslint-disable no-console */
(function () {
  // Helper: ensure DOM element exists (throws helpful runtime error if not)
  function requiredElement(id) {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`Required DOM element not found: #${id}`);
    }
    return el;
  }

  // DOM elements (validated at runtime)
  const audio = /** @type {HTMLAudioElement} */ (requiredElement('audioElement'));
  const visualizerCanvas = /** @type {HTMLCanvasElement} */ (requiredElement('visualizer'));
  const canvasCtx = visualizerCanvas.getContext('2d');

  const coverImg = /** @type {HTMLImageElement} */ (requiredElement('playerCover'));
  const titleEl = /** @type {HTMLElement} */ (requiredElement('playerTitle'));
  const artistEl = /** @type {HTMLElement} */ (requiredElement('playerArtist'));
  const playBtn = /** @type {HTMLElement} */ (requiredElement('playBtn'));
  const prevBtn = /** @type {HTMLElement} */ (requiredElement('prevBtn'));
  const nextBtn = /** @type {HTMLElement} */ (requiredElement('nextBtn'));
  const loopBtn = /** @type {HTMLElement} */ (requiredElement('loopBtn'));
  const seek = /** @type {HTMLInputElement} */ (requiredElement('seek'));
  const curTime = /** @type {HTMLElement} */ (requiredElement('curTime'));
  const durTime = /** @type {HTMLElement} */ (requiredElement('durTime'));
  const muteBtn = /** @type {HTMLElement} */ (requiredElement('muteBtn'));
  const volume = /** @type {HTMLInputElement} */ (requiredElement('volume'));
  const shareBtn = /** @type {HTMLElement} */ (requiredElement('shareBtn'));
  const addPlBtn = /** @type {HTMLElement} */ (requiredElement('addPlBtn'));
  const lyricsEl = /** @type {HTMLElement} */ (requiredElement('lyrics'));
  const queueEl = /** @type {HTMLElement} */ (requiredElement('queue'));
  const shuffleBtn = /** @type {HTMLElement} */ (requiredElement('shuffleBtn'));
  const clearQueueBtn = /** @type {HTMLElement} */ (requiredElement('clearQueueBtn'));
  const toastContainer = /** @type {HTMLElement} */ (requiredElement('toastContainer'));
  const addPlModal = /** @type {HTMLElement} */ (requiredElement('addPlModal'));
  const plList = /** @type {HTMLElement} */ (requiredElement('plList'));
  const closeAddPl = /** @type {HTMLElement} */ (requiredElement('closeAddPl'));
  const newPlaylistName = /** @type {HTMLInputElement} */ (requiredElement('newPlaylistName'));
  const createPlBtn = /** @type {HTMLElement} */ (requiredElement('createPlBtn'));

  // LocalStorage keys
  const KEY_QUEUE = 'omni_queue';
  const KEY_CUR_INDEX = 'omni_current_index';
  const KEY_CUR_TRACK = 'omni_current_track';
  const KEY_PLAYLISTS = 'omni_playlists';

  // App state
  let queue = JSON.parse(localStorage.getItem(KEY_QUEUE) || '[]');
  let currentIndex = Number(localStorage.getItem(KEY_CUR_INDEX) || -1);
  let playlists = JSON.parse(localStorage.getItem(KEY_PLAYLISTS) || '[]');

  // WebAudio nodes
  let audioCtx = null;
  let analyser = null;
  let dataArray = null;
  let sourceNode = null;
  let rafId = null;

  // UI helpers
  function toast(msg, t = 2000) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    toastContainer.appendChild(d);
    setTimeout(() => {
      d.style.opacity = '0';
      setTimeout(() => {
        d.remove();
      }, 240);
    }, t);
  }

  function formatTime(s) {
    if (!s || Number.isNaN(s)) return '0:00';
    const sec = Math.floor(s);
    const m = Math.floor(sec / 60);
    const secPart = sec % 60;
    return `${m}:${secPart.toString().padStart(2, '0')}`;
  }

  function saveState() {
    try {
      localStorage.setItem(KEY_QUEUE, JSON.stringify(queue));
      localStorage.setItem(KEY_CUR_INDEX, String(currentIndex));
      if (currentTrack()) localStorage.setItem(KEY_CUR_TRACK, JSON.stringify(currentTrack()));
      localStorage.setItem(KEY_PLAYLISTS, JSON.stringify(playlists));
    } catch (err) {
      console.warn('saveState error', err);
    }
  }

  function currentTrack() {
    if (!Array.isArray(queue) || queue.length === 0 || currentIndex < 0) return null;
    return queue[currentIndex] || null;
  }

  function loadTrack(t) {
    if (!t) return;
    const src = t.file || t.preview || '';
    audio.src = src;
    coverImg.src = t.cover || 'assets/images/music-placeholder.jpg';
    titleEl.textContent = t.title || 'Unknown';
    artistEl.textContent = t.artist || 'Unknown';
    seek.value = '0';
    curTime.textContent = '0:00';
    durTime.textContent = '0:00';
    loadLyricsForTrack(t);
    saveState();
    tryStartAudioContext();
  }

  function tryStartAudioContext() {
    if (audioCtx) return;
    const AudioCtxConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxConstructor) {
      console.warn('Web Audio API not supported in this browser.');
      return;
    }
    audioCtx = new AudioCtxConstructor();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    try {
      sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      renderVisualizer();
    } catch (err) {
      console.warn('AudioContext / MediaElementSource error', err);
    }
  }

  function renderVisualizer() {
    if (!analyser || !dataArray || !visualizerCanvas || !canvasCtx) return;
    const canvas = visualizerCanvas;
    const ctx = canvasCtx;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.18;
    const bars = 120;
    const barMaxLength = Math.min(canvas.width, canvas.height) * 0.38;

    function draw() {
      if (!analyser || !dataArray) return;
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(centerX, centerY);
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor((i * dataArray.length) / bars);
        const val = (dataArray[idx] || 0) / 255;
        const angle = (i / bars) * Math.PI * 2;
        const len = radius + val * barMaxLength;
        const x1 = Math.cos(angle) * radius;
        const y1 = Math.sin(angle) * radius;
        const x2 = Math.cos(angle) * len;
        const y2 = Math.sin(angle) * len;
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, 'rgba(255,159,122,0.95)');
        grad.addColorStop(1, 'rgba(124,255,204,0.15)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(2, Math.min(8, val * 12));
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
      rafId = requestAnimationFrame(draw);
    }

    if (typeof rafId === 'number') cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(draw);
  }

  // audio events
  audio.addEventListener('timeupdate', function () {
    const d = audio.duration || 0;
    const cur = audio.currentTime || 0;
    if (d) {
      seek.value = String((cur / d) * 100);
    }
    curTime.textContent = formatTime(cur);
    durTime.textContent = formatTime(d);
  });

  audio.addEventListener('loadedmetadata', function () {
    durTime.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('ended', function () {
    if (audio.loop) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    if (currentIndex < queue.length - 1) {
      currentIndex++;
      const t = queue[currentIndex];
      loadTrack(t);
      audio.play().catch(() => {});
      saveState();
    } else {
      toast('Queue ended');
    }
  });

  // controls
  seek.addEventListener('input', function (e) {
    const target = e.target;
    if (!audio.duration) return;
    const p = Number(target.value) / 100;
    audio.currentTime = p * audio.duration;
  });

  playBtn.addEventListener('click', function () {
    if (audio.paused) {
      audio.play().catch(() => {});
      playBtn.textContent = '❚❚';
    } else {
      audio.pause();
      playBtn.textContent = '►';
    }
    tryStartAudioContext();
  });

  prevBtn.addEventListener('click', function () {
    if (currentIndex > 0) {
      currentIndex--;
      loadTrack(queue[currentIndex]);
      audio.play().catch(() => {});
      saveState();
    }
  });

  nextBtn.addEventListener('click', function () {
    if (currentIndex < queue.length - 1) {
      currentIndex++;
      loadTrack(queue[currentIndex]);
      audio.play().catch(() => {});
      saveState();
    }
  });

  loopBtn.addEventListener('click', function () {
    audio.loop = !audio.loop;
    loopBtn.style.opacity = audio.loop ? '1' : '0.6';
  });

  muteBtn.addEventListener('click', function () {
    audio.muted = !audio.muted;
    muteBtn.textContent = audio.muted ? '🔇' : '🔈';
  });

  volume.addEventListener('input', function (e) {
    const v = e.target;
    audio.volume = Number(v.value);
  });

  shareBtn.addEventListener('click', async function () {
    const t = currentTrack();
    if (!t) return toast('No track to share');
    const payload = { title: t.title, text: t.artist || '', url: location.href };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        toast('Shared');
      } catch (err) {
        toast('Share cancelled');
      }
    } else {
      try {
        await navigator.clipboard.writeText(location.href);
        toast('Link copied');
      } catch (err) {
        toast('Copy failed');
      }
    }
  });

  addPlBtn.addEventListener('click', function () {
    openAddPlaylistModal();
  });

  function openAddPlaylistModal() {
    addPlModal.setAttribute('aria-hidden', 'false');
    plList.innerHTML = '';
    playlists.forEach(function (p, idx) {
      const d = document.createElement('div');
      d.className = 'playlist-item';
      d.innerHTML = `<div>${escapeHtml(p.name)}</div><div><button class="btn" data-i="${idx}">Add</button></div>`;
      const btn = d.querySelector('button');
      if (btn) {
        btn.addEventListener('click', function () {
          const t = currentTrack();
          if (!t) {
            toast('No track loaded');
            return;
          }
          if (!p.tracks) p.tracks = [];
          p.tracks.push(t.id || t.title);
          playlists[idx] = p;
          saveState();
          toast('Added to ' + p.name);
          addPlModal.setAttribute('aria-hidden', 'true');
        });
      }
      plList.appendChild(d);
    });
  }

  closeAddPl.addEventListener('click', function () {
    addPlModal.setAttribute('aria-hidden', 'true');
  });

  createPlBtn.addEventListener('click', function () {
    const name = newPlaylistName.value.trim();
    if (!name) return toast('Enter playlist name');
    const t = currentTrack();
    const arr = t ? [t.id || t.title] : [];
    playlists.push({ name, tracks: arr });
    newPlaylistName.value = '';
    saveState();
    toast('Playlist created');
    addPlModal.setAttribute('aria-hidden', 'true');
  });

  // queue rendering and drag/drop
  function renderQueue() {
    queueEl.innerHTML = '';
    if (!Array.isArray(queue) || queue.length === 0) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'Queue is empty';
      queueEl.appendChild(li);
      return;
    }
    queue.forEach(function (t, idx) {
      const li = document.createElement('li');
      li.className = 'queue-item';
      li.draggable = true;
      li.dataset.i = String(idx);
      li.innerHTML = `<img class="qi-cover" src="${escapeAttr(t.cover || 'assets/images/music-placeholder.jpg')}" alt="cover"><div class="qi-info"><strong>${escapeHtml(t.title)}</strong><div class="muted">${escapeHtml(t.artist || '')}</div></div><div class="qi-actions"><button class="btn play" data-i="${idx}">Play</button></div>`;
      const playBtnLocal = li.querySelector('button.play');
      if (playBtnLocal) {
        playBtnLocal.addEventListener('click', function () {
          currentIndex = idx;
          loadTrack(queue[currentIndex]);
          audio.play().catch(() => {});
          saveState();
        });
      }
      li.addEventListener('dragstart', dragStart);
      li.addEventListener('dragover', dragOver);
      li.addEventListener('drop', dropItem);
      li.addEventListener('dragend', dragEnd);
      queueEl.appendChild(li);
    });
  }

  let dragSrcIndex = null;
  function dragStart(e) {
    const target = e.currentTarget;
    dragSrcIndex = Number(target.dataset.i);
    target.classList.add('dragging');
    try {
      e.dataTransfer.effectAllowed = 'move';
    } catch (err) {}
  }
  function dragOver(e) {
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = 'move';
    } catch (err) {}
  }
  function dropItem(e) {
    e.preventDefault();
    const target = e.currentTarget;
    const targetIndex = Number(target.dataset.i);
    if (dragSrcIndex === null || Number.isNaN(targetIndex)) return;
    const item = queue.splice(dragSrcIndex, 1)[0];
    queue.splice(targetIndex, 0, item);
    dragSrcIndex = null;
    renderQueue();
    saveState();
  }
  function dragEnd(e) {
    e.currentTarget.classList.remove('dragging');
  }

  shuffleBtn.addEventListener('click', function () {
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    currentIndex = 0;
    renderQueue();
    saveState();
    toast('Queue shuffled');
  });

  clearQueueBtn.addEventListener('click', function () {
    if (!confirm('Clear queue?')) return;
    queue = [];
    currentIndex = -1;
    audio.pause();
    audio.src = '';
    renderQueue();
    saveState();
    toast('Queue cleared');
  });

  // lyrics load & LRC parsing
  function loadLyricsForTrack(t) {
    lyricsEl.textContent = 'No lyrics available';
    if (!t || !t.lyrics) return;
    fetch(t.lyrics)
      .then((r) => r.text())
      .then((txt) => {
        if (txt.includes('[') && txt.includes(']')) {
          const lines = parseLRC(txt);
          displaySyncedLyrics(lines);
        } else {
          lyricsEl.textContent = txt;
        }
      })
      .catch(() => {
        lyricsEl.textContent = 'No lyrics available';
      });
  }

  function parseLRC(lrc) {
    const rows = lrc.split(/\r?\n/);
    const out = [];
    rows.forEach(function (row) {
      const match = row.match(/\[(\d+):(\d+)(?:\.(\d+))?\](.*)/);
      if (match) {
        const minutes = Number(match[1]);
        const seconds = Number(match[2]);
        const frac = match[3] ? Number('0.' + match[3]) : 0;
        const t = minutes * 60 + seconds + frac;
        out.push({ t, text: match[4].trim() });
      }
    });
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  function displaySyncedLyrics(lines) {
    lyricsEl.innerHTML = lines
      .map((l, i) => `<div class="ly-line" data-t="${l.t}" id="ly${i}">${escapeHtml(l.text)}</div>`)
      .join('\n');

    audio.addEventListener('timeupdate', function () {
      const tNow = audio.currentTime;
      let idx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (tNow >= lines[i].t) idx = i;
        else break;
      }
      if (idx >= 0) {
        const el = document.getElementById('ly' + idx);
        if (el) {
          Array.from(lyricsEl.children).forEach((c) => c.classList.remove('active'));
          el.classList.add('active');
          try {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch (err) {}
        }
      }
    });
  }

  // utility
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  // initialize from storage
  function initFromStorage() {
    try {
      queue = JSON.parse(localStorage.getItem(KEY_QUEUE) || '[]');
      currentIndex = Number(localStorage.getItem(KEY_CUR_INDEX) || -1);
      playlists = JSON.parse(localStorage.getItem(KEY_PLAYLISTS) || '[]');
    } catch (err) {
      queue = [];
      currentIndex = -1;
      playlists = [];
    }
    if (currentIndex < 0 && queue.length) currentIndex = 0;
    if (queue.length && currentIndex >= 0) {
      loadTrack(queue[currentIndex]);
    }
    renderQueue();
  }

  document.addEventListener('keydown', function (e) {
    if ((e.key === ' ' || e.code === 'Space') && document.activeElement && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (audio.paused) {
        audio.play().catch(() => {});
        playBtn.textContent = '❚❚';
      } else {
        audio.pause();
        playBtn.textContent = '►';
      }
    }
    if (e.key === 'ArrowRight') nextBtn.click();
    if (e.key === 'ArrowLeft') prevBtn.click();
    if (e.key === 'm') muteBtn.click();
    if (e.key === 'l') loopBtn.click();
  });

  initFromStorage();
  saveState();

  // expose debug handle
  window.__OMNI_PLAYER = { reload: initFromStorage, getQueue: function () { return queue; } };
})(); // IIFE
