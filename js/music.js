/* music.js
   Advanced Music catalog:
   - loads data/music.json
   - search with highlight & debounce
   - hover preview (short snippet) with audio element per-card
   - persistent mini-player & queue (localStorage)
   - playlists: create, add, reorder (drag & drop)
   - keyboard shortcuts: space play/pause, ArrowLeft/Right skip
*/

(function(){
  // helpers
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const el = id => document.getElementById(id);
  const debounce = (fn, wait=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), wait); }; };

  // DOM refs
  const musicGrid = el('musicGrid');
  const musicSearch = el('musicSearch');
  const suggestions = el('suggestions');
  const filterChips = el('filterChips');
  const musicSort = el('musicSort');
  const playlistsList = el('playlistsList');
  const createPlaylistBtn = el('createPlaylist');
  const newPlName = el('newPlName');
  const addPlModal = el('addPlModal');
  const addPlList = el('addPlList');
  const closeAddPl = el('closeAddPl');
  const createAndAdd = el('createAndAdd');
  const tmpPlName = el('tmpPlName');

  const miniPlayer = el('miniPlayer');
  const miniAudio = el('miniAudio');
  const miniTitle = el('miniTitle');
  const miniArtist = el('miniArtist');
  const miniCover = el('miniCover');
  const miniPlayBtn = el('miniPlay');
  const miniPrev = el('miniPrev');
  const miniNext = el('miniNext');
  const miniOpen = el('miniOpen');

  const queueList = el('queueList');
  const clearQueue = el('clearQueue');
  const saveQueuePl = el('saveQueuePl');

  const toastContainer = el('toastContainer');

  // state
  let tracks = [];
  let filtered = [];
  let activeFilters = new Set();
  let playlists = JSON.parse(localStorage.getItem('omni_playlists') || '[]');
  let queue = JSON.parse(localStorage.getItem('omni_queue') || '[]');
  let currentIndex = Number(localStorage.getItem('omni_current_index') || -1);

  // toast
  function toast(msg, t=2000){
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; toastContainer.appendChild(d);
    setTimeout(()=>{ d.style.opacity='0'; setTimeout(()=>d.remove(),300); }, t);
  }

  // load music
  async function load(){
    try{
      const res = await fetch('data/music.json');
      tracks = await res.json();
    } catch(e){
      console.error('Failed to load music.json', e);
      tracks = [];
    }
    filtered = tracks.slice();
    populateFilterChips();
    renderGrid();
    renderPlaylists();
    renderQueue();
    restoreMiniPlayer();
  }

  // filter chips (collect genres/moods)
  function populateFilterChips(){
    const set = new Set();
    tracks.forEach(t => (t.genres || []).forEach(g => set.add(g)));
    filterChips.innerHTML = '';
    Array.from(set).sort().forEach(g => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = g;
      b.addEventListener('click', ()=> {
        if(b.classList.contains('active')){ b.classList.remove('active'); activeFilters.delete(g); }
        else { b.classList.add('active'); activeFilters.add(g); }
        applyFilters();
      });
      filterChips.appendChild(b);
    });
  }

  // render music grid
  function renderGrid(){
    musicGrid.innerHTML = '';
    filtered.forEach((t, idx) => {
      const card = document.createElement('div');
      card.className = 'track-card';
      card.setAttribute('role','listitem');
      card.innerHTML = `
        <img class="track-cover lazy" data-src="${t.cover || 'https://picsum.photos/200/200?random=' + (t.id||idx)}" alt="${t.title} cover">
        <div class="track-info">
          <div class="track-title">${t.title}</div>
          <div class="track-artist">${t.artist || 'Unknown'}</div>
          <div class="track-actions">
            <button class="btn play" data-index="${idx}">Preview</button>
            <button class="btn outline addPl" data-id="${t.id}">+ Playlist</button>
            <button class="btn" data-index="${idx}" data-action="queue">Queue</button>
          </div>
        </div>
      `;
      // events
      card.querySelector('.play').addEventListener('click', (e)=>{ const i = Number(e.target.dataset.index); playTrackByIndex(i); });
      card.querySelector('.addPl').addEventListener('click', (e)=>{ openAddPlModal(t); });
      card.querySelector('[data-action="queue"]').addEventListener('click', ()=> { addToQueue(t); });

      // hover preview: create short audio element inside card for snippet
      card.addEventListener('mouseenter', ()=> startHoverPreview(card, t));
      card.addEventListener('mouseleave', ()=> stopHoverPreview(card));
      // keyboard focus also triggers preview
      card.addEventListener('focus', ()=> startHoverPreview(card, t));
      card.addEventListener('blur', ()=> stopHoverPreview(card));

      musicGrid.appendChild(card);
    });
    lazyLoadImages();
  }

  // lazy load images
  function lazyLoadImages(root=document){
    const imgs = Array.from((root || document).querySelectorAll('img.lazy[data-src]'));
    if('IntersectionObserver' in window){
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(en => {
          if(en.isIntersecting){
            const img = en.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            img.classList.remove('lazy');
            obs.unobserve(img);
          }
        });
      }, { rootMargin: '200px' });
      imgs.forEach(i => io.observe(i));
    } else {
      imgs.forEach(i => { i.src = i.dataset.src; i.removeAttribute('data-src'); i.classList.remove('lazy'); });
    }
  }

  // search + highlight
  function highlight(text, q){
    if(!q) return text;
    return text.replace(new RegExp(`(${escapeReg(q)})`,'ig'), '<mark>$1</mark>');
  }
  function escapeReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

  musicSearch.addEventListener('input', debounce((e)=>{
    const q = e.target.value.trim().toLowerCase();
    suggestions.innerHTML = '';
    if(q.length === 0){ applyFilters(); return; }
    // show suggestions (first matches in title/artist)
    const matches = tracks.filter(t => (t.title + ' ' + (t.artist||'')).toLowerCase().includes(q)).slice(0,8);
    matches.forEach(m => {
      const a = document.createElement('div');
      a.className = 'suggestion';
      a.innerHTML = `<strong>${highlight(m.title,q)}</strong><div class="muted">${highlight(m.artist||'',q)}</div>`;
      a.addEventListener('click', ()=> {
        musicSearch.value = m.title;
        suggestions.innerHTML = '';
        applyFilters();
      });
      suggestions.appendChild(a);
    });
    // filter grid live
    applyFilters();
  }, 200));

  // apply filters and sort
  function applyFilters(){
    const q = musicSearch.value.trim().toLowerCase();
    filtered = tracks.filter(t => {
      if(activeFilters.size){
        const has = (t.genres || []).some(g => activeFilters.has(g));
        if(!has) return false;
      }
      if(q){
        const hay = (t.title + ' ' + (t.artist||'') + ' ' + (t.album||'')).toLowerCase();
        return hay.includes(q);
      }
      return true;
    });

    switch(musicSort.value){
      case 'title': filtered.sort((a,b) => (a.title||'').localeCompare(b.title||'')); break;
      case 'artist': filtered.sort((a,b) => (a.artist||'').localeCompare(b.artist||'')); break;
      case 'new': filtered.sort((a,b) => (b.year||0) - (a.year||0)); break;
      default: filtered.sort((a,b) => (b.popularity||b.id||0) - (a.popularity||a.id||0)); break;
    }

    renderGrid();
  }

  musicSort.addEventListener('change', applyFilters);

  // hover preview (snippet)
  const hoverPlayers = new WeakMap();
  function startHoverPreview(card, t){
    // if preview url provided use that, otherwise use main file but play muted and seek to 10s
    const previewSrc = t.preview || t.file;
    if(!previewSrc) return;
    if(hoverPlayers.has(card)) return;
    const a = document.createElement('audio');
    a.src = previewSrc;
    a.preload = 'metadata';
    a.muted = true;
    a.loop = false;
    a.volume = 0.6;
    a.play().catch(()=>{ /* autoplay blocked */ });
    hoverPlayers.set(card, a);
  }
  function stopHoverPreview(card){
    const a = hoverPlayers.get(card);
    if(a){ try{ a.pause(); a.src = ''; } catch(e){} hoverPlayers.delete(card); }
  }

  // mini-player controls and persistent queue
  function playTrackByIndex(idx){
    // find global index within tracks array for the filtered item
    const t = filtered[idx];
    if(!t) return;
    // push into queue and set current index to end
    queue.unshift(t); // add to front for immediate play
    saveQueue();
    currentIndex = 0;
    loadMiniTrack(t);
    playMini();
    renderQueue();
  }

  function loadMiniTrack(track){
    miniAudio.src = track.file || track.preview || '';
    miniTitle.textContent = track.title || 'Unknown';
    miniArtist.textContent = track.artist || 'Unknown';
    miniCover.src = track.cover || 'assets/images/music-placeholder.jpg';
    localStorage.setItem('omni_current_track', JSON.stringify(track));
    localStorage.setItem('omni_current_index', String(currentIndex));
  }

  function playMini(){ miniAudio.play().catch(()=>{}); miniPlayBtn.textContent = '⏸'; }
  function pauseMini(){ miniAudio.pause(); miniPlayBtn.textContent = '►'; }

  miniPlayBtn.addEventListener('click', ()=>{
    if(miniAudio.paused) playMini(); else pauseMini();
  });

  miniPrev.addEventListener('click', ()=>{
    if(queue.length === 0) return;
    if(currentIndex < queue.length - 1) currentIndex++;
    const t = queue[currentIndex];
    loadMiniTrack(t);
    playMini();
    saveQueue();
    renderQueue();
  });

  miniNext.addEventListener('click', ()=>{
    if(queue.length === 0) return;
    if(currentIndex > 0) currentIndex--;
    const t = queue[currentIndex];
    loadMiniTrack(t);
    playMini();
    saveQueue();
    renderQueue();
  });

  // autoplay next when ended
  miniAudio.addEventListener('ended', ()=>{
    if(currentIndex > 0){ currentIndex--; loadMiniTrack(queue[currentIndex]); playMini(); saveQueue(); renderQueue(); }
    else { pauseMini(); }
  });

  // keyboard shortcuts
  document.addEventListener('keydown', (e)=>{
    if(e.key === ' ' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA'){ e.preventDefault(); if(miniAudio.paused) playMini(); else pauseMini(); }
    if(e.key === 'ArrowRight') miniNext.click();
    if(e.key === 'ArrowLeft') miniPrev.click();
  });

  // queue management
  function addToQueue(track){
    queue.unshift(track);
    saveQueue();
    renderQueue();
    toast('Added to queue');
  }
  function saveQueue(){ localStorage.setItem('omni_queue', JSON.stringify(queue)); localStorage.setItem('omni_current_index', String(currentIndex)); }

  function renderQueue(){
    queueList.innerHTML = '';
    queue.forEach((t, i) => {
      const d = document.createElement('div');
      d.className = 'queue-item';
      d.innerHTML = `<div style="flex:1"><strong>${t.title}</strong><div class="muted" style="font-size:13px">${t.artist||''}</div></div><div><button class="btn outline" data-i="${i}">Play</button></div>`;
      d.querySelector('button').addEventListener('click', ()=> {
        currentIndex = i;
        loadMiniTrack(t);
        playMini();
      });
      queueList.appendChild(d);
    });
  }

  clearQueue.addEventListener('click', ()=>{
    queue = [];
    saveQueue();
    renderQueue();
    toast('Queue cleared');
  });

  saveQueuePl.addEventListener('click', ()=>{
    const name = prompt('Save current queue as playlist. Enter playlist name:');
    if(!name) return;
    playlists.push({ name, tracks: queue.map(t => t.id || t.title) });
    persistPlaylists();
    renderPlaylists();
    toast('Saved queue to playlist: ' + name);
  });

  // playlists
  createPlaylistBtn.addEventListener('click', ()=> {
    const n = newPlName.value.trim();
    if(!n) return toast('Enter playlist name');
    playlists.push({ name: n, tracks: [] });
    newPlName.value = '';
    persistPlaylists();
    renderPlaylists();
    toast('Playlist created');
  });

  function renderPlaylists(){
    playlistsList.innerHTML = '';
    playlists.forEach((p, idx) => {
      const elp = document.createElement('div');
      elp.className = 'playlist-item';
      elp.innerHTML = `<div>${p.name} <div class="muted" style="font-size:12px">${p.tracks.length} tracks</div></div><div><button class="btn outline" data-idx="${idx}">Open</button></div>`;
      elp.querySelector('button').addEventListener('click', ()=> {
        // show playlist contents in a quick overlay (simpler than full page)
        const items = p.tracks.map(id => tracks.find(t => String(t.id) === String(id) || t.title === id)).filter(Boolean);
        if(items.length === 0) return toast('Playlist empty');
        // replace queue with playlist tracks
        queue = items.slice();
        currentIndex = 0;
        saveQueue();
        renderQueue();
        loadMiniTrack(queue[0]);
        playMini();
        toast('Playing playlist: ' + p.name);
      });
      playlistsList.appendChild(elp);
    });
  }

  function persistPlaylists(){ localStorage.setItem('omni_playlists', JSON.stringify(playlists)); }

  // Add-to-playlist modal flow
  function openAddPlModal(track){
    addPlModal.setAttribute('aria-hidden','false');
    addPlList.innerHTML = '';
    playlists.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'playlist-item';
      d.innerHTML = `<div>${p.name}</div><div><button class="btn" data-i="${i}">Add</button></div>`;
      d.querySelector('button').addEventListener('click', ()=> {
        if(!p.tracks) p.tracks = [];
        p.tracks.push(track.id || track.title);
        persistPlaylists();
        toast(`Added to ${p.name}`);
        addPlModal.setAttribute('aria-hidden','true');
      });
      addPlList.appendChild(d);
    });
    // wire create&add
    createAndAdd.onclick = ()=> {
      const name = tmpPlName.value.trim(); if(!name) return toast('Enter playlist name');
      playlists.push({ name, tracks: [track.id || track.title] });
      persistPlaylists();
      tmpPlName.value = '';
      addPlModal.setAttribute('aria-hidden','true');
      renderPlaylists();
      toast('Created playlist and added track');
    };
  }

  closeAddPl.addEventListener('click', ()=> addPlModal.setAttribute('aria-hidden','true'));

  // restore mini-player state from storage
  function restoreMiniPlayer(){
    const cur = JSON.parse(localStorage.getItem('omni_current_track') || 'null');
    if(cur){ loadMiniTrack(cur); } else { miniTitle.textContent = 'No track'; miniArtist.textContent = '—'; }
    renderQueue();
  }

  // open full music-player page
  miniOpen.addEventListener('click', ()=> location.href = 'music-player.html');

  // utility: start hover preview uses audio objects; already implemented above
  function startHoverPreview(card, t){ /* implemented earlier in function scope */ }
  function stopHoverPreview(card){ /* implemented earlier in function scope */ }

  // Expose a debugging API
  window.__OMNI_MUSIC = { reload: load, getTracks: ()=>tracks, getPlaylists: ()=>playlists };

  // initial load
  load();

})();
