/* movies.js
   Advanced Movies page script:
   - loads data/movies.json
   - supports search, multi-genre chips, range filter, sorting
   - infinite scroll / load more
   - hover preview (video)
   - watchlist (localStorage)
   - modal quick preview
*/

(function(){
  // helpers
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const el = id => document.getElementById(id);
  const debounce = (fn, wait=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), wait); }; };

  // elements
  const moviesGrid = el('moviesGrid');
  const movieSearch = el('movieSearch');
  const genreChips = el('genreChips');
  const sortBy = el('sortBy');
  const yearRange = el('yearRange');
  const yearVal = el('yearVal');
  const loadMoreBtn = el('loadMore');
  const infiniteMsg = el('infiniteMessage');
  const movieModal = el('movieModal');
  const modalContent = el('modalContent');
  const closeModal = el('closeModal');
  const toastContainer = el('toastContainer');
  const currYear = el('currYear');
  currYear.textContent = new Date().getFullYear();

  // state
  let movies = [];
  let filtered = [];
  let page = 0;
  const PAGE_SIZE = 10;
  let activeGenres = new Set();
  let minYear = 1950, maxYear = 2025;
  let watchlist = new Set(JSON.parse(localStorage.getItem('omni_watchlist') || '[]'));
  let hoveringPreview = null;

  // toasts
  function toast(msg, t=2400){
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; toastContainer.appendChild(d);
    setTimeout(()=>{ d.style.opacity='0'; d.style.transform='translateY(6px)'; setTimeout(()=>d.remove(),300); }, t);
  }

  // load data
  async function loadData(){
    try{
      const res = await fetch('data/movies.json');
      movies = await res.json();
    } catch(e){
      console.error('Failed load movies.json', e);
      movies = [];
    }
    // set year range defaults from data
    const years = movies.map(m => m.year || 2000).filter(Boolean);
    if(years.length){
      const min = Math.min(...years), max = Math.max(...years);
      minYear = Math.max(1950, min); maxYear = Math.min(2025, max);
      yearRange.min = minYear; yearRange.max = maxYear;
      yearRange.value = maxYear;
      yearVal.textContent = `${minYear} — ${maxYear}`;
    } else {
      yearRange.min = 1950; yearRange.max = 2025; yearRange.value = 2025;
      yearVal.textContent = `1950 — 2025`;
    }

    // populate genre chips
    populateGenres();
    applyFilters(); // initial render
  }

  function populateGenres(){
    const set = new Set();
    movies.forEach(m => (m.genres || []).forEach(g => set.add(g)));
    genreChips.innerHTML = '';
    Array.from(set).sort().forEach(g => {
      const btn = document.createElement('button'); btn.className = 'chip'; btn.type='button';
      btn.textContent = g;
      btn.addEventListener('click', ()=> {
        if(btn.classList.contains('active')){ btn.classList.remove('active'); activeGenres.delete(g); }
        else { btn.classList.add('active'); activeGenres.add(g); }
        resetPaginationAndRender();
      });
      genreChips.appendChild(btn);
    });
  }

  // build card
  function makeCard(m){
    const li = document.createElement('div');
    li.className = 'movie-card';
    li.tabIndex = 0;
    li.setAttribute('role','listitem');
    // poster may be missing; fallback to placeholder
    const poster = m.poster || (`https://picsum.photos/400/240?random=${m.id}`);
    li.innerHTML = `
      <img class="poster lazy" data-src="${poster}" alt="${m.title} poster">
      <div class="card-body">
        <div class="card-title">${m.title}</div>
        <div class="card-meta">${m.year} · ${m.runtime || '--'}m</div>
        <div class="card-actions">
          <button class="btn play-btn" data-id="${m.id}">Preview</button>
          <button class="btn outline watch-btn" data-id="${m.id}">${watchlist.has(m.id) ? 'Remove' : 'Watchlist'}</button>
          <div style="margin-left:auto;color:var(--muted);font-size:13px;">${(m.genres||[]).slice(0,2).join(', ')}</div>
        </div>
      </div>
      <div class="preview-overlay" aria-hidden="true"></div>
    `;
    // event: click preview -> open modal
    li.querySelector('.play-btn').addEventListener('click', ()=> openModal(m));
    // event: watchlist toggle
    li.querySelector('.watch-btn').addEventListener('click', (ev)=>{
      ev.stopPropagation();
      toggleWatchlist(m.id, ev.target);
    });

    // hover preview behavior (desktop)
    li.addEventListener('mouseenter', ()=> startPreview(li, m));
    li.addEventListener('mouseleave', ()=> stopPreview(li));
    li.addEventListener('focus', ()=> startPreview(li, m));
    li.addEventListener('blur', ()=> stopPreview(li));

    return li;
  }

  function renderPage(){
    const start = page * PAGE_SIZE;
    const chunk = filtered.slice(start, start + PAGE_SIZE);
    if(page === 0) moviesGrid.innerHTML = '';
    chunk.forEach(m => moviesGrid.appendChild(makeCard(m)));
    lazyLoadImages();
    // update load more visibility
    if((page+1) * PAGE_SIZE >= filtered.length){
      loadMoreBtn.style.display = 'none';
      infiniteMsg.textContent = filtered.length === 0 ? 'No results' : 'End of results';
    } else {
      loadMoreBtn.style.display = 'inline-block';
      infiniteMsg.textContent = `${filtered.length} results`;
    }
  }

  function resetPaginationAndRender(){
    page = 0; renderPage();
  }

  function applyFilters(){
    const q = movieSearch.value.trim().toLowerCase();
    const yearLimit = parseInt(yearRange.value,10) || maxYear;
    // filter by genres and year and search query
    filtered = movies.filter(m => {
      const yr = m.year || 0;
      if(yr > yearLimit) return false;
      if(activeGenres.size){
        const has = (m.genres || []).some(g => activeGenres.has(g));
        if(!has) return false;
      }
      if(q){
        const text = (m.title + ' ' + (m.description||'') + ' ' + (m.cast||'')).toLowerCase();
        return text.includes(q);
      }
      return true;
    });
    // sort
    const sort = sortBy.value;
    switch(sort){
      case 'year_desc': filtered.sort((a,b)=> (b.year||0) - (a.year||0)); break;
      case 'year_asc': filtered.sort((a,b)=> (a.year||0) - (b.year||0)); break;
      case 'runtime_asc': filtered.sort((a,b)=> (a.runtime||0) - (b.runtime||0)); break;
      case 'runtime_desc': filtered.sort((a,b)=> (b.runtime||0) - (a.runtime||0)); break;
      case 'title_az': filtered.sort((a,b)=> (a.title||'').localeCompare(b.title||'')); break;
      default: /* recommended: sort by popularity or id */ filtered.sort((a,b)=> (b.popularity||b.id||0) - (a.popularity||a.id||0)); break;
    }
    page = 0;
    renderPage();
  }

  // search debounce
  movieSearch.addEventListener('input', debounce(()=>{ applyFilters(); }, 300));

  sortBy.addEventListener('change', ()=> applyFilters());

  yearRange.addEventListener('input', ()=>{
    yearVal.textContent = `${yearRange.min} — ${yearRange.value}`;
    applyFilters();
  });

  // Load more
  loadMoreBtn.addEventListener('click', ()=>{
    page++;
    renderPage();
    // smooth scroll to new content
    window.scrollBy({ top: 360, behavior: 'smooth' });
  });

  // infinite scroll: load next page when near bottom
  window.addEventListener('scroll', ()=>{
    if(window.innerHeight + window.scrollY >= document.body.offsetHeight - 500){
      if((page+1) * PAGE_SIZE < filtered.length){
        page++;
        renderPage();
      }
    }
  }, { passive:true });

  // modal functions
  function openModal(m){
    movieModal.setAttribute('aria-hidden','false');
    modalContent.innerHTML = `
      <div class="modal-content">
        <img class="modal-poster" src="${m.poster || ('https://picsum.photos/640/360?random=' + m.id)}" alt="${m.title}">
        <div class="modal-info">
          <h3 id="modalTitle">${m.title} <small class="muted">(${m.year})</small></h3>
          <p class="muted">${(m.genres||[]).join(' • ')}</p>
          <p>${m.description || 'No description available.'}</p>
          <div class="actions-row">
            <button class="btn primary" id="modalPlay">Play Trailer</button>
            <button class="btn outline" id="modalWL">${watchlist.has(m.id) ? 'Remove from Watchlist' : 'Add to Watchlist'}</button>
          </div>
          <div style="margin-top:10px;"><small class="muted">Runtime: ${m.runtime || '--'} minutes</small></div>
        </div>
      </div>
      <div style="margin-top:12px;" id="modalPlayerArea"></div>
    `;
    // wire actions
    document.getElementById('modalPlay').addEventListener('click', ()=>{
      const playerArea = document.getElementById('modalPlayerArea');
      playerArea.innerHTML = `<video controls autoplay muted playsinline style="width:100%;max-height:420px"><source src="${m.trailer || 'assets/videos/sample.mp4'}" type="video/mp4">Your browser does not support video.</video>`;
    });
    document.getElementById('modalWL').addEventListener('click', (ev)=>{
      toggleWatchlist(m.id, ev.target);
      // update button text
      ev.target.textContent = watchlist.has(m.id) ? 'Remove from Watchlist' : 'Add to Watchlist';
    });

    movieModal.querySelector('.modal-close').focus();
  }

  closeModal.addEventListener('click', ()=> { movieModal.setAttribute('aria-hidden','true'); modalContent.innerHTML = ''; });

  movieModal.addEventListener('click', (ev)=>{ if(ev.target === movieModal) { movieModal.setAttribute('aria-hidden','true'); modalContent.innerHTML = ''; } });

  // watchlist
  function toggleWatchlist(id, btn){
    if(watchlist.has(id)){
      watchlist.delete(id);
      btn && (btn.textContent = 'Watchlist');
      toast('Removed from watchlist');
    } else {
      watchlist.add(id);
      btn && (btn.textContent = 'Remove');
      toast('Added to watchlist');
    }
    localStorage.setItem('omni_watchlist', JSON.stringify(Array.from(watchlist)));
    // update any watch buttons on page
    $$('.watch-btn').forEach(b => { if(b.dataset.id && Number(b.dataset.id) === id) b.textContent = watchlist.has(id) ? 'Remove' : 'Watchlist'; });
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

  // hover preview: show trailer (muted autoplay) in overlay
  function startPreview(cardEl, movie){
    const overlay = cardEl.querySelector('.preview-overlay');
    if(!overlay) return;
    // if trailer present, attach video; else show poster zoom
    if(movie.trailer){
      overlay.innerHTML = `<video class="preview-video" muted playsinline preload="metadata"><source src="${movie.trailer}" type="video/mp4"></video>`;
      const vid = overlay.querySelector('video');
      vid.currentTime = 0;
      vid.play().catch(()=>{ /* autoplay may be blocked; ignore */ });
    } else {
      overlay.innerHTML = `<div style="padding:10px;color:var(--text)"><strong>${movie.title}</strong></div>`;
    }
    overlay.style.display = 'flex';
    hoveringPreview = overlay;
  }

  function stopPreview(cardEl){
    const overlay = cardEl.querySelector('.preview-overlay');
    if(!overlay) return;
    const vid = overlay.querySelector('video');
    if(vid){ try{ vid.pause(); vid.src = ''; } catch(e){} }
    overlay.style.display = 'none';
    overlay.innerHTML = '';
    hoveringPreview = null;
  }

  // keyboard navigation: arrow keys between cards
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
      const focusable = Array.from(document.querySelectorAll('.movie-card'));
      const idx = focusable.indexOf(document.activeElement);
      if(idx >= 0){
        const next = e.key === 'ArrowRight' ? focusable[idx+1] : focusable[idx-1];
        if(next) { next.focus(); next.scrollIntoView({block:'nearest', behavior:'smooth'}); }
      }
    }
    if(e.key === 'Escape' && movieModal.getAttribute('aria-hidden') === 'false'){
      movieModal.setAttribute('aria-hidden','true');
      modalContent.innerHTML = '';
    }
  });

  // initial wiring
  loadData();

  // expose for debug (optional)
  window.__OMNI_MOVIES = { reload: loadData, getMovies: ()=>movies };

})();
