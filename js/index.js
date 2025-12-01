// js/index.js — OMNI PRO enhanced landing behavior
// @ts-nocheck
(function () {
  // Defensive helpers (use global utils if available)
  const _load = window.load ?? function (k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const _save = window.save ?? function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const _toast = window.toast ?? function (m, t=1700) {
    const c = document.getElementById('toastContainer'); if (!c) return;
    const el = document.createElement('div'); el.textContent = m; el.style.background='rgba(0,0,0,0.7)'; el.style.color='#fff'; el.style.padding='8px 12px'; el.style.borderRadius='8px'; el.style.marginTop='8px';
    c.appendChild(el); setTimeout(()=> el.remove(), t);
  };

  // DOM refs
  const navToggle = document.getElementById('navToggle');
  const navList = document.getElementById('navList');
  const loginModal = document.getElementById('loginModal');
  const openLogin = document.getElementById('openLogin');
  const closeLogin = document.getElementById('closeLogin');
  const loginForm = document.getElementById('loginForm');
  const inlineSearch = document.getElementById('inlineSearch');
  const inlineResults = document.getElementById('inlineResults');
  const quickSearchBtn = document.getElementById('quickSearchBtn');
  const featureImage = document.querySelector('.feature-image');
  const featureTitle = document.getElementById('featureTitle');
  const featureMeta = document.getElementById('featureMeta');
  const featurePlay = document.getElementById('featurePlay');
  const featureAddFav = document.getElementById('featureAddFav');
  const featureDetails = document.getElementById('featureDetails');
  const trendingEl = document.getElementById('trending');
  const trPrev = document.getElementById('trPrev');
  const trNext = document.getElementById('trNext');
  const genreGrid = document.getElementById('genreGrid');
  const yearEl = document.getElementById('year');
  const themeToggle = document.getElementById('themeToggle');

  // data
  const movies = _load('omni_movies', []);
  const music = _load('omni_music', []);
  const favorites = _load('omni_favorites', []);
  const logs = _load('omni_logs', []);
  const session = (function(){ try { const s = localStorage.getItem('omni_session') || sessionStorage.getItem('omni_session'); return s ? JSON.parse(s) : null; } catch { return null; } })();

  // set year
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // navigation toggle (mobile)
  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', (!expanded).toString());
    if (navList) {
      if (navList.hidden) { navList.hidden = false; } else { navList.hidden = true; }
    }
  });

  // theme toggle (persisted)
  (function initTheme(){
    const settings = _load('omni_settings', {});
    if (settings.theme === 'light') document.documentElement.classList.add('omni-light');
    themeToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('omni-light');
      const nowLight = document.documentElement.classList.contains('omni-light');
      settings.theme = nowLight ? 'light' : 'dark';
      _save('omni_settings', settings);
    });
  })();

  // login modal open/close
  openLogin.addEventListener('click', () => {
    loginModal.setAttribute('aria-hidden', 'false');
  });
  closeLogin.addEventListener('click', () => {
    loginModal.setAttribute('aria-hidden', 'true');
  });
  loginModal.addEventListener('click', (ev) => { if (ev.target === loginModal) loginModal.setAttribute('aria-hidden','true'); });

  // login form handler (local, matches register logic)
  loginForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const pw = document.getElementById('loginPassword').value;
    const role = document.getElementById('loginRole').value;
    if (!email || !pw) { _toast('Fill email & password'); return; }
    const users = _load('omni_users', []);
    const u = users.find(x => (x.email||'').toLowerCase() === email && (x.role||'user') === role);
    if (!u) { _toast('User not found'); return; }
    const stored = (u.password||'').startsWith('obf:') ? atob(u.password.slice(4)) : u.password;
    if (stored !== pw) { _toast('Incorrect password'); return; }
    const sessionObj = { id: u.id, name: u.name, email: u.email, role: u.role, loginTime: Date.now() };
    localStorage.setItem('omni_session', JSON.stringify(sessionObj));
    _toast('Signed in');
    loginModal.setAttribute('aria-hidden', 'true');
    // update login button to show user
    updateAuthUI(sessionObj);
  });

  function updateAuthUI(s) {
    if (!s) { openLogin.textContent = 'Login'; return; }
    openLogin.textContent = s.name ? `Hi, ${s.name.split(' ')[0]}` : s.email;
    openLogin.classList.add('btn');
  }

  // inline search (debounced)
  function debounce(fn, wait=220){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }
  const doSearch = debounce((q) => {
    q = (q||'').trim().toLowerCase();
    inlineResults.innerHTML = '';
    if (!q) return;
    const pool = [...(movies||[]), ...(music||[])];
    const results = pool.filter(it => {
      const title = (it.title || it.name || '').toString().toLowerCase();
      const meta = ((it.artist||'') + ' ' + (it.year||'') + ' ' + (it.genre||'')).toLowerCase();
      return title.includes(q) || meta.includes(q);
    }).slice(0,8);
    if (results.length === 0) { inlineResults.innerHTML = '<li class="muted small">No results</li>'; return; }
    inlineResults.innerHTML = results.map(r => {
      const t = escapeHtml(r.title || r.name || 'Untitled');
      const meta = escapeHtml(r.artist || r.year || r.genre || '');
      return `<li role="option" data-id="${r.id}" class="inline-hit"><strong>${t}</strong><div class="small muted">${meta}</div></li>`;
    }).join('');
  }, 180);

  inlineSearch.addEventListener('input', (e) => doSearch(e.target.value));
  inlineResults.addEventListener('click', (e) => {
    const li = e.target.closest('li.inline-hit');
    if (!li) return;
    const id = li.dataset.id;
    // try to play
    if (window.omniUserPlayer && typeof window.omniUserPlayer.playItemById === 'function') {
      window.omniUserPlayer.playItemById(id);
    } else {
      _toast('Player not initialized. Open Dev Portal to seed playable tracks.');
    }
    // clear input
    inlineSearch.value = '';
    inlineResults.innerHTML = '';
  });

  quickSearchBtn.addEventListener('click', () => {
    document.location.href = 'search.html';
  });

  // Lazy load images
  function lazyLoadImage(img) {
    const src = img.dataset.src;
    if (!src) {
      // fallback placeholder gradient generation via canvas data URL to avoid network for empty
      img.src = '';
      img.classList.add('loaded');
      return;
    }
    const tmp = new Image();
    tmp.onload = () => { img.src = src; img.classList.add('loaded'); };
    tmp.onerror = () => { img.classList.add('loaded'); };
    tmp.src = src;
  }

  // FEATURE card
  const featuredPool = (movies || []).concat(music || []);
  let featuredIndex = 0;
  function setFeature(index) {
    if (!featuredPool.length) {
      featureTitle.textContent = 'No featured content';
      featureMeta.textContent = 'Use Dev Portal to seed media';
      featureImage.dataset.src = '';
      lazyLoadImage(featureImage);
      return;
    }
    featuredIndex = ((index % featuredPool.length) + featuredPool.length) % featuredPool.length;
    const it = featuredPool[featuredIndex];
    featureTitle.textContent = it.title || it.name || 'Untitled';
    featureMeta.textContent = (it.artist || it.year || it.genre || 'Media').toString();
    // use poster or image url if exists
    featureImage.dataset.src = it.cover || it.image || (it.poster || '');
    lazyLoadImage(featureImage);
    // update fav icon state
    featureAddFav.textContent = (favorites || []).includes(it.id) ? '★' : '☆';
    // store id for actions
    featureCardState.currentId = it.id;
  }
  const featureCardState = { currentId: null };

  featurePlay.addEventListener('click', () => {
    const id = featureCardState.currentId;
    if (!id) return _toast('Nothing to play');
    if (window.omniUserPlayer && typeof window.omniUserPlayer.playItemById === 'function') {
      window.omniUserPlayer.playItemById(id);
    } else {
      _toast('Player not ready. Seed playable track in Dev Portal.');
    }
  });

  featureAddFav.addEventListener('click', () => {
    const id = featureCardState.currentId;
    if (!id) return;
    const favs = _load('omni_favorites', []);
    const i = favs.indexOf(id);
    if (i === -1) { favs.push(id); featureAddFav.textContent = '★'; _toast('Added to favorites'); }
    else { favs.splice(i,1); featureAddFav.textContent = '☆'; _toast('Removed from favorites'); }
    _save('omni_favorites', favs);
  });

  featureDetails.addEventListener('click', () => {
    const id = featureCardState.currentId;
    if (!id) return;
    // try open movie details page if exists, else open search
    const m = (movies||[]).find(x => x.id === id) || (music||[]).find(x => x.id === id);
    if (m && m.type === 'movie') window.location.href = `movie-details.html?id=${encodeURIComponent(id)}`;
    else if (m && m.type === 'music') window.location.href = `music.html#${encodeURIComponent(id)}`;
    else window.location.href = 'search.html';
  });

  // TRENDING carousel
  function renderTrending() {
    const pool = (movies || []).slice(0,12).concat((music || []).slice(0,12));
    if (!pool.length) {
      trendingEl.innerHTML = '<div class="trending-item muted">No trending items — use Dev Portal to seed content.</div>';
      return;
    }
    trendingEl.innerHTML = pool.slice(0, 12).map(it => {
      const title = escapeHtml(it.title || it.name || 'Untitled');
      const meta = escapeHtml(it.artist || it.year || it.genre || '');
      const thumb = escapeHtml(it.cover || it.image || '');
      return `<article class="trending-item" data-id="${it.id}" tabindex="0">
        <div class="thumb"><img data-src="${thumb}" alt="${title}" class="lazy thumb-img" /></div>
        <h4>${title}</h4>
        <div class="meta small muted">${meta}</div>
        <div style="margin-top:8px"><button class="btn small play-btn" data-id="${it.id}">Play</button> <button class="btn small fav-btn" data-id="${it.id}">${(favorites||[]).includes(it.id) ? '★' : '☆'}</button></div>
      </article>`;
    }).join('');
    // attach lazy loader for thumbnails after DOM insertion
    qaAll('.lazy.thumb-img').forEach(img => lazyLoadImage(img));
  }

  // small querySelectorAll helper
  function qaAll(sel, ctx=document) { return Array.from((ctx||document).querySelectorAll(sel)); }

  // trending nav
  trPrev.addEventListener('click', () => { trendingEl.scrollBy({ left: -420, behavior: 'smooth' }); });
  trNext.addEventListener('click', () => { trendingEl.scrollBy({ left: 420, behavior: 'smooth' }); });

  // delegated play/fav handlers for trending
  trendingEl.addEventListener('click', (e) => {
    const pb = e.target.closest('button.play-btn');
    const fb = e.target.closest('button.fav-btn');
    if (pb) {
      const id = pb.dataset.id;
      if (window.omniUserPlayer && typeof window.omniUserPlayer.playItemById === 'function') {
        window.omniUserPlayer.playItemById(id);
      } else {
        _toast('Player not ready. Seed playable track in Dev Portal.');
      }
    } else if (fb) {
      const id = fb.dataset.id;
      const favs = _load('omni_favorites', []);
      const idx = favs.indexOf(id);
      if (idx === -1) { favs.push(id); fb.textContent = '★'; _toast('Added to favorites'); }
      else { favs.splice(idx,1); fb.textContent = '☆'; _toast('Removed from favorites'); }
      _save('omni_favorites', favs);
    }
  });

  // Genre grid (basic)
  function renderGenres() {
    // derive genres from movies/music
    const pool = [...(movies||[]), ...(music||[])];
    const genreMap = {};
    pool.forEach(i => {
      const g = (i.genre || 'Misc').toString();
      genreMap[g] = (genreMap[g] || 0) + 1;
    });
    const genres = Object.keys(genreMap).slice(0, 12);
    if (!genres.length) {
      genreGrid.innerHTML = '<div class="muted">No genres yet. Use Dev Portal to add content.</div>';
      return;
    }
    genreGrid.innerHTML = genres.map(g => `<div class="genre-card" role="button" data-genre="${escapeHtml(g)}"><div class="genre-bubble">${escapeHtml(g[0]||'G')}</div><div><div style="font-weight:700">${escapeHtml(g)}</div><div class="small muted">${genreMap[g]} items</div></div></div>`).join('');
    // click to open search filter
    genreGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.genre-card');
      if (!card) return;
      const g = card.dataset.genre;
      // navigate to search with genre filter param
      window.location.href = `search.html?genre=${encodeURIComponent(g)}`;
    });
  }

  // utility: escapeHtml if not provided by utils
  function escapeHtml(s) { try { return (window.escapeHtml ? window.escapeHtml(s) : (String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])))); } catch { return String(s||''); } }

  // small query helper (used for lazy images)
  function qa(sel, ctx=document) { return ctx.querySelector(sel); }
  function qaAllLazy() { return Array.from(document.querySelectorAll('img.lazy')); }

  // initialize UI state
  function init() {
    updateAuthUI(session);
    setFeature(0);
    renderTrending();
    renderGenres();
    // lazy load feature image & trending images
    if (featureImage) lazyLoadImage(featureImage);
    qaAllLazy().forEach(img => {
      // intersection observer for efficiency when available
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries, obs)=>{
          entries.forEach(en => { if (en.isIntersecting) { lazyLoadImage(en.target); obs.unobserve(en.target); } });
        }, { rootMargin: '200px' });
        io.observe(img);
      } else {
        // immediate fallback
        lazyLoadImage(img);
      }
    });

    // keyboard accessibility: arrow keys to scroll trending
    trendingEl.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight') trendingEl.scrollBy({ left: 240, behavior: 'smooth' });
      if (ev.key === 'ArrowLeft') trendingEl.scrollBy({ left: -240, behavior: 'smooth' });
    });

    // inline results keyboard navigation
    inlineSearch.addEventListener('keydown', (ev) => {
      if (!inlineResults) return;
      const items = inlineResults.querySelectorAll('li');
      if (items.length === 0) return;
      let idx = Array.prototype.findIndex.call(items, it => it.classList.contains('active'));
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (idx < items.length - 1) idx++; else idx = 0; items.forEach(i => i.classList.remove('active')); items[idx].classList.add('active'); }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); if (idx > 0) idx--; else idx = items.length - 1; items.forEach(i => i.classList.remove('active')); items[idx].classList.add('active'); }
      if (ev.key === 'Enter') { ev.preventDefault(); const act = inlineResults.querySelector('li.active') || items[0]; if (act) act.click(); }
    });

    // image error fallback
    document.addEventListener('error', (ev) => {
      const t = ev.target;
      if (t && t.tagName === 'IMG' && t.classList.contains('lazy')) {
        t.onerror = null;
        t.src = '';
      }
    }, true);
  }

  // small helper to select all once
  function qaAll(sel, ctx=document) { return Array.from((ctx||document).querySelectorAll(sel)); }

  init();

})();
