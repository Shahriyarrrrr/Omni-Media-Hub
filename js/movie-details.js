/* movie-details.js
   Advanced movie details page:
   - fetches data/movies.json and renders the selected movie by id
   - custom trailer player in modal with controls + fullscreen + PiP
   - ratings with localStorage persistence
   - comments stored in localStorage
   - related movies by genre
   - cast carousel with keyboard + button + drag support
   - share & download features
*/

(function(){
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const idFromQuery = () => new URLSearchParams(location.search).get('id');

  const posterImg = $('#posterImg');
  const posterDownload = $('#downloadPoster');
  const bcTitle = $('#bcTitle');
  const movieTitle = $('#movieTitle');
  const movieDesc = $('#movieDesc');
  const metaGenres = $('#metaGenres');
  const metaYear = $('#metaYear');
  const metaRuntime = $('#metaRuntime');
  const openTrailer = $('#openTrailer');
  const trailerModal = $('#trailerModal');
  const playerWrap = $('#playerWrap');
  const closeTrailer = $('#closeTrailer');
  const favBtn = $('#favBtn');
  const addWatchlist = $('#addWatchlist');
  const shareBtn = $('#shareBtn');

  const ratingUi = $('#ratingUi');
  const ratingStats = $('#ratingStats');

  const castCarousel = $('#castCarousel');
  const castPrev = $('#castPrev');
  const castNext = $('#castNext');

  const relatedGrid = $('#relatedGrid');

  const commentForm = $('#commentForm');
  const commentName = $('#commentName');
  const commentText = $('#commentText');
  const commentsList = $('#commentsList');
  const clearComments = $('#clearComments');

  const toastContainer = $('#toastContainer');
  const footYear = $('#footYear'); footYear.textContent = new Date().getFullYear();

  let movies = [];
  let movie = null;
  let movieId = idFromQuery();
  if(!movieId){ movieId = '1'; } // fallback id
  movieId = String(movieId);

  // storage keys helpers
  const key = k => `omni_${k}`;
  const getJSON = (k, fallback) => JSON.parse(localStorage.getItem(key(k)) || JSON.stringify(fallback));
  const setJSON = (k, v) => localStorage.setItem(key(k), JSON.stringify(v));

  // toast
  function toast(msg, t=2200){
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; toastContainer.appendChild(d);
    setTimeout(()=> { d.style.opacity='0'; d.style.transform='translateY(6px)'; setTimeout(()=>d.remove(), 260); }, t);
  }

  // Fetch data and find movie
  async function load(){
    try{
      const res = await fetch('data/movies.json');
      movies = await res.json();
    } catch(e){
      console.error('Could not load movies.json', e);
      movies = [];
    }
    movie = movies.find(m => String(m.id) === movieId) || movies[0] || null;
    render();
  }

  function safeText(s){ return s || '—'; }

  // render page
  function render(){
    if(!movie){
      movieTitle.textContent = 'Movie not found';
      movieDesc.textContent = 'No details available.';
      return;
    }

    // update meta tags for SEO (client-side fallback)
    document.title = `${movie.title} — Omni Media Hub`;
    const ogImg = movie.poster || 'assets/images/placeholder.jpg';
    document.querySelector('meta[property="og:title"]').setAttribute('content', `${movie.title} — Omni Media Hub`);
    document.querySelector('meta[property="og:description"]').setAttribute('content', movie.description || '');
    document.querySelector('meta[property="og:image"]').setAttribute('content', ogImg);

    // JSON-LD structured data
    injectJsonLd(movie);

    bcTitle.textContent = movie.title;
    movieTitle.textContent = movie.title;
    movieDesc.textContent = movie.description || 'No description available.';
    metaGenres.textContent = (movie.genres || []).join(' • ') || 'Genre info';
    metaYear.textContent = movie.year || '—';
    metaRuntime.textContent = (movie.runtime ? `${movie.runtime}m` : '—');

    // poster
    posterImg.src = movie.poster || 'assets/images/placeholder.jpg';
    posterImg.alt = `${movie.title} poster`;
    posterDownload.href = movie.poster || posterImg.src;
    posterDownload.setAttribute('download', `${(movie.title||'poster').replace(/\s+/g,'_')}.jpg`);
    $('#lightboxImg').src = posterImg.src;

    // favorite button state
    const favs = new Set(getJSON('favs', []));
    favBtn.textContent = favs.has(movie.id) ? '★ Favorited' : '☆ Favorite';

    // watchlist state
    const wl = new Set(getJSON('watchlist', []));
    addWatchlist.textContent = wl.has(movie.id) ? 'Remove from Watchlist' : 'Add to Watchlist';

    // rating
    renderRating();

    // cast
    renderCast();

    // related
    renderRelated();

    // comments
    renderComments();
  }

  function injectJsonLd(m){
    // remove existing ld+json
    const old = document.querySelector('script[type="application/ld+json"]');
    if(old) old.remove();
    const ld = {
      "@context": "https://schema.org",
      "@type": "Movie",
      "name": m.title,
      "image": m.poster || '',
      "description": m.description || '',
      "datePublished": m.year ? String(m.year) : undefined,
      "duration": m.runtime ? `PT${m.runtime}M` : undefined,
      "genre": m.genres || [],
      "actor": (m.cast || []).slice(0,6).map(c => ({ "@type":"Person", "name": c.name || c }))
    };
    const s = document.createElement('script'); s.type = 'application/ld+json'; s.textContent = JSON.stringify(ld, null, 2);
    document.head.appendChild(s);
  }

  // Rating system
  function getRatings(){
    return getJSON(`ratings_${movie.id}`, { count:0, sum:0, byUser:{} });
  }
  function saveRatings(r){ setJSON(`ratings_${movie.id}`, r); }
  function renderRating(){
    ratingUi.innerHTML = '';
    const r = getRatings();
    const avg = r.count ? (r.sum / r.count) : 0;
    ratingStats.textContent = r.count ? `Avg: ${avg.toFixed(1)} · ${r.count} vote(s)` : 'No ratings yet';

    // build 5-star interactive
    for(let i=1;i<=5;i++){
      const btn = document.createElement('button');
      btn.className = 'star';
      btn.setAttribute('aria-label', `Rate ${i} star${i>1?'s':''}`);
      btn.setAttribute('role','radio');
      btn.dataset.value = i;
      const svg = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .587l3.668 7.431L23.4 9.748l-5.668 5.523L18.336 24 12 19.897 5.664 24l.603-8.729L.6 9.748l7.732-1.73z"/></svg>`;
      btn.innerHTML = svg;
      if(i <= Math.round(avg)) btn.classList.add('filled');
      btn.addEventListener('click', ()=> { submitRating(i); });
      ratingUi.appendChild(btn);
    }
  }

  function submitRating(value){
    const r = getRatings();
    r.count = (r.count || 0) + 1;
    r.sum = (r.sum || 0) + value;
    // store a crude per-user marker by timestamp (client-side only)
    const uid = localStorage.getItem('omni_user') || `local_${Date.now()}`;
    r.byUser[uid] = value;
    saveRatings(r);
    renderRating();
    toast('Thanks for rating!');
  }

  // Cast carousel
  function renderCast(){
    castCarousel.innerHTML = '';
    const cast = movie.cast || [];
    if(!cast.length){ castCarousel.innerHTML = '<div class="muted">No cast information</div>'; return; }
    cast.forEach(c => {
      const div = document.createElement('div');
      div.className = 'cast-card';
      const imgSrc = c.photo || 'assets/images/artist-placeholder.jpg';
      div.innerHTML = `<img loading="lazy" src="${imgSrc}" alt="${c.name}"><div class="cast-name">${c.name}</div><div class="muted">${c.role || ''}</div>`;
      castCarousel.appendChild(div);
    });

    // add simple drag support
    let isDown = false, startX, scrollLeft;
    castCarousel.addEventListener('mousedown', (e)=>{ isDown = true; castCarousel.classList.add('dragging'); startX = e.pageX - castCarousel.offsetLeft; scrollLeft = castCarousel.scrollLeft; });
    window.addEventListener('mouseup', ()=>{ isDown = false; castCarousel.classList.remove('dragging'); });
    castCarousel.addEventListener('mousemove', (e)=>{ if(!isDown) return; e.preventDefault(); const x = e.pageX - castCarousel.offsetLeft; const walk = (x - startX) * 1.1; castCarousel.scrollLeft = scrollLeft - walk; });

    castPrev.addEventListener('click', ()=> { castCarousel.scrollBy({left:-240, behavior:'smooth'}); });
    castNext.addEventListener('click', ()=> { castCarousel.scrollBy({left:240, behavior:'smooth'}); });

    // keyboard navigation inside carousel
    castCarousel.addEventListener('keydown', (e)=> {
      if(e.key === 'ArrowRight') castCarousel.scrollBy({left:240, behavior:'smooth'});
      if(e.key === 'ArrowLeft') castCarousel.scrollBy({left:-240, behavior:'smooth'});
    });
  }

  // Related movies
  function renderRelated(){
    relatedGrid.innerHTML = '';
    const mainGenres = new Set((movie.genres || []).slice(0,3));
    const related = movies.filter(m => m.id !== movie.id && (m.genres || []).some(g => mainGenres.has(g))).slice(0,8);
    if(!related.length){ relatedGrid.innerHTML = '<div class="muted">No related movies found</div>'; return; }
    related.forEach(r => {
      const d = document.createElement('div');
      d.className = 'related-item';
      d.tabIndex = 0;
      d.setAttribute('role','listitem');
      d.innerHTML = `<img loading="lazy" src="${r.poster || 'https://picsum.photos/320/180?random=' + r.id}" alt="${r.title}"><div style="padding:8px"><strong>${r.title}</strong><div class="muted small">${r.year || ''}</div></div>`;
      d.addEventListener('click', ()=> location.href = `movie-details.html?id=${r.id}`);
      relatedGrid.appendChild(d);
    });
  }

  // Comments
  function commentsKey(){ return `comments_${movie.id}`; }
  function renderComments(){
    const list = getJSON(`${commentsKey()}`, []);
    commentsList.innerHTML = '';
    if(!list.length) { commentsList.innerHTML = '<div class="muted">No comments yet — be the first.</div>'; return; }
    list.slice().reverse().forEach(c => {
      const div = document.createElement('div'); div.className = 'comment-item';
      div.innerHTML = `<div class="comment-meta"><strong>${c.name}</strong><span class="muted">${new Date(c.ts).toLocaleString()}</span></div><div class="comment-body">${escapeHtml(c.text)}</div>`;
      commentsList.appendChild(div);
    });
  }

  commentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = commentName.value.trim();
    const text = commentText.value.trim();
    if(!name || !text) return toast('Name and comment required');
    const list = getJSON(`${commentsKey()}`, []);
    list.push({ name, text, ts: Date.now() });
    setJSON(`${commentsKey()}`, list);
    commentName.value = ''; commentText.value = '';
    renderComments();
    toast('Comment posted');
  });

  clearComments.addEventListener('click', ()=>{
    if(!confirm('Clear all comments for this movie?')) return;
    setJSON(`${commentsKey()}`, []);
    renderComments();
    toast('Comments cleared');
  });

  // Watchlist / favorites
  $('#addWatchlist').addEventListener('click', ()=>{
    const k = 'watchlist';
    const cur = new Set(getJSON(k, []));
    if(cur.has(movie.id)){ cur.delete(movie.id); toast('Removed from watchlist'); }
    else { cur.add(movie.id); toast('Added to watchlist'); }
    setJSON(k, Array.from(cur));
    render(); // update button
  });

  $('#favBtn').addEventListener('click', ()=>{
    const k = 'favs';
    const cur = new Set(getJSON(k, []));
    if(cur.has(movie.id)){ cur.delete(movie.id); toast('Removed favorite'); }
    else { cur.add(movie.id); toast('Added favorite'); }
    setJSON(k, Array.from(cur));
    render();
  });

  // Share
  $('#shareBtn').addEventListener('click', async ()=>{
    const shareData = { title: movie.title, text: movie.description || '', url: location.href };
    if(navigator.share){
      try { await navigator.share(shareData); toast('Shared'); }
      catch(e){ toast('Share cancelled'); }
    } else {
      // fallback: copy URL
      navigator.clipboard.writeText(location.href).then(()=> toast('Link copied to clipboard'));
    }
  });

  // Trailer player modal (custom)
  openTrailer.addEventListener('click', ()=> openTrailerModal());
  closeTrailer.addEventListener('click', ()=> closeTrailerModal());
  trailerModal.addEventListener('click', (ev)=> { if(ev.target === trailerModal) closeTrailerModal(); });

  function openTrailerModal(){
    trailerModal.setAttribute('aria-hidden','false');
    playerWrap.innerHTML = '';
    const videoSrc = movie.trailer || 'assets/videos/sample.mp4';
    const player = document.createElement('div'); player.className = 'player';
    player.innerHTML = `
      <video id="detailVideo" src="${videoSrc}" controls playsinline preload="metadata" crossorigin="anonymous"></video>
    `;
    playerWrap.appendChild(player);

    const vid = document.getElementById('detailVideo');
    vid.play().catch(()=>{}); // might be blocked; ignore
    // provide keyboard shortcuts for video
    document.addEventListener('keydown', videoKeyHandler);
  }

  function closeTrailerModal(){
    trailerModal.setAttribute('aria-hidden','true');
    const vid = document.getElementById('detailVideo');
    if(vid){
      try{ vid.pause(); vid.src = ''; } catch(e) {}
    }
    playerWrap.innerHTML = '';
    document.removeEventListener('keydown', videoKeyHandler);
  }

  function videoKeyHandler(e){
    const vid = document.getElementById('detailVideo');
    if(!vid) return;
    if(e.key === ' ') { e.preventDefault(); vid.paused ? vid.play() : vid.pause(); }
    if(e.key === 'f') { if(document.fullscreenElement) document.exitFullscreen(); else vid.requestFullscreen().catch(()=>{}); }
    if(e.key === 'm') { vid.muted = !vid.muted; }
  }

  // Poster lightbox
  $('#openPoster').addEventListener('click', ()=> {
    $('#posterLightbox').setAttribute('aria-hidden','false');
    document.getElementById('lightboxImg').src = posterImg.src;
  });
  $('#closePosterLightbox').addEventListener('click', ()=> $('#posterLightbox').setAttribute('aria-hidden','true'));
  $('#posterLightbox').addEventListener('click', (ev)=> { if(ev.target === $('#posterLightbox')) $('#posterLightbox').setAttribute('aria-hidden','true'); });

  // Utility: escape HTML
  function escapeHtml(unsafe){
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // init
  load();

  // Expose a tiny debugging API
  window.__OMNI_MOVIE_DETAIL = {
    getMovie: () => movie,
    reload: load
  };

})();
