// @ts-nocheck
/**
 * admin-dashboard.js
 * Enterprise admin panel (frontend-only). Uses localStorage for persistence.
 *
 * Local keys used:
 *  - omni_users
 *  - omni_movies
 *  - omni_music
 *  - omni_payments
 *  - omni_subscriptions
 *  - omni_logs
 *  - omni_notifications
 *  - omni_settings_admin
 *
 * Protects page by checking local session (omni_session) and role === 'admin'.
 */

(function () {
  "use strict";

  /* ---------- Helpers ---------- */
  function required(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error("Missing element #" + id);
    return el;
  }

  function q(sel, ctx=document) { return ctx.querySelector(sel); }
  function qa(sel, ctx=document) { return Array.from(ctx.querySelectorAll(sel)); }

  // safe parse
  function loadJSON(key, def) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; } catch { return def; }
  }
  function saveJSON(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

  function uid(prefix='id') { return prefix + '_' + Math.random().toString(36).slice(2,9); }

  function nowISO(){ return new Date().toISOString(); }

  // logging
  function pushLog(msg) {
    const logs = loadJSON('omni_logs', []);
    logs.unshift({ id: uid('log'), time: nowISO(), msg });
    saveJSON('omni_logs', logs.slice(0,500));
    renderLogs();
  }

  function pushNotif(title, body) {
    const n = loadJSON('omni_notifications', []);
    n.unshift({ id: uid('n'), time: nowISO(), title, body, read: false });
    saveJSON('omni_notifications', n);
    renderNotifCount();
  }

  /* ---------- Data initialization / seeding ---------- */
  function ensureSeed() {
    if (!loadJSON('omni_users', null)) {
      const users = [
        { id: 'u_admin', name: 'Admin', email: 'admin@omni', role: 'admin', password: 'obf:QWRtaW5AMTIz' },
        { id: 'u_dev', name: 'Developer', email: 'dev@omni', role: 'developer', password: 'obf:RGV2QDEyMw==' },
        { id: 'u_user', name: 'User', email: 'user@omni', role: 'user', password: 'obf:VXNlcjAxMjM=' }
      ];
      saveJSON('omni_users', users);
      saveJSON('omni_movies', [
        { id: uid('mov'), title: 'Interstellar', type: 'movie', poster: '', year: 2014 },
        { id: uid('mov'), title: 'Inception', type: 'movie', poster: '', year: 2010 }
      ]);
      saveJSON('omni_music', [
        { id: uid('song'), title: 'Time', artist: 'Hans Zimmer', cover: '' },
        { id: uid('song'), title: 'Dream On', artist: 'Aerosmith', cover: '' }
      ]);
      saveJSON('omni_payments', [
        { id: uid('tx'), user: 'user@omni', amount: 9.99, date: nowISO(), status: 'paid' }
      ]);
      saveJSON('omni_subscriptions', [
        { id: uid('plan'), name: 'Basic', price: 4.99, desc: 'Basic plan' },
        { id: uid('plan'), name: 'Premium', price: 12.99, desc: 'Premium plan' }
      ]);
      saveJSON('omni_logs', []);
      saveJSON('omni_notifications', []);
      saveJSON('omni_settings_admin', { theme: 'dark', showNotifs: true });
    }
  }

  /* ---------- Session check (admin only) ---------- */
  function requireAdminSession() {
    try {
      const raw = localStorage.getItem('omni_session') || sessionStorage.getItem('omni_session');
      if (!raw) { window.location.href = 'login.html'; return false; }
      const s = JSON.parse(raw);
      if (!s || s.role !== 'admin') { window.location.href = 'login.html'; return false; }
      // set admin name
      q('#adminName').textContent = s.name || s.email || 'Admin';
      return true;
    } catch (e) {
      window.location.href = 'login.html';
      return false;
    }
  }

  /* ---------- Rendering ---------- */
  function renderStats() {
    const users = loadJSON('omni_users', []);
    const movies = loadJSON('omni_movies', []);
    const music = loadJSON('omni_music', []);
    const payments = loadJSON('omni_payments', []);
    const revenue = payments.reduce((s,p)=>s + (Number(p.amount)||0),0);

    q('#statUsers').textContent = users.length;
    q('#statMedia').textContent = (movies.length + music.length);
    q('#statRevenue').textContent = '$' + revenue.toFixed(2);

    drawRevenueChart(payments);
    drawUsersChart();
  }

  function renderUsers(filter='') {
    const list = q('#usersList');
    list.innerHTML = '';
    const users = loadJSON('omni_users', []);
    const filtered = users.filter(u => !filter || (u.name && u.name.toLowerCase().includes(filter)) || (u.email && u.email.toLowerCase().includes(filter)));
    filtered.forEach(u => {
      const item = document.createElement('div');
      item.className = 'item';
      item.dataset.id = u.id;
      item.innerHTML = `
        <div class="meta">
          <div class="avatar">${(u.name||u.email||'U').slice(0,1).toUpperCase()}</div>
          <div>
            <div style="font-weight:700">${u.name || '(no name)'}</div>
            <div class="small muted">${u.email} • ${u.role}</div>
          </div>
        </div>
        <div class="actions">
          <button class="btn" data-action="edit">Edit</button>
          <button class="btn" data-action="pw">Reset PW</button>
          <button class="btn danger" data-action="delete">Delete</button>
        </div>`;
      list.appendChild(item);
    });
  }

  function renderMedia(filterType='all', search='') {
    const container = q('#mediaList');
    container.innerHTML = '';
    const movies = loadJSON('omni_movies', []);
    const music = loadJSON('omni_music', []);
    const artists = loadJSON('omni_artists', []);
    let items = [...(movies||[]), ...(music||[]), ...(artists||[])];
    if (filterType !== 'all') items = items.filter(i => i.type === filterType || (filterType === 'song' && i.artist));
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(i => (i.title && i.title.toLowerCase().includes(s)) || (i.artist && i.artist.toLowerCase().includes(s)));
    }
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'media-card';
      card.draggable = true;
      card.dataset.id = item.id || '';
      card.innerHTML = `
        <div><img class="media-cover" src="${item.cover||item.poster||''}" alt=""></div>
        <div class="media-title">${item.title || '(no title)'}</div>
        <div class="small muted">${item.type || (item.artist ? 'song' : 'movie')}</div>
        <div style="margin-top:8px;display:flex;gap:8px">
          <button class="btn" data-action="edit">Edit</button>
          <button class="btn danger" data-action="delete">Delete</button>
        </div>
      `;
      container.appendChild(card);
    });

    enableDragAndDrop(container);
  }

  function renderPayments(filter='') {
    const table = q('#paymentsTable tbody');
    table.innerHTML = '';
    const payments = loadJSON('omni_payments', []);
    const rows = payments.filter(p => !filter || (p.id && p.id.includes(filter)) || (p.user && p.user.toLowerCase().includes(filter)) || (String(p.amount).includes(filter)));
    rows.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.id}</td>
        <td>${p.user}</td>
        <td>$${Number(p.amount).toFixed(2)}</td>
        <td>${new Date(p.date).toLocaleString()}</td>
        <td>${p.status}</td>
        <td>
          <button class="btn" data-action="view" data-id="${p.id}">View</button>
          <button class="btn danger" data-action="del" data-id="${p.id}">Delete</button>
        </td>
      `;
      table.appendChild(tr);
    });
  }

  function renderPlans() {
    const grid = q('#plansGrid');
    grid.innerHTML = '';
    const plans = loadJSON('omni_subscriptions', []);
    plans.forEach(p => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div style="font-weight:800">${p.name}</div>
        <div class="small muted">$${Number(p.price).toFixed(2)}</div>
        <div style="margin-top:8px">${p.desc || ''}</div>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="btn" data-action="edit" data-id="${p.id}">Edit</button>
          <button class="btn danger" data-action="del" data-id="${p.id}">Delete</button>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderLogs() {
    const container = q('#logsList');
    container.innerHTML = '';
    const logs = loadJSON('omni_logs', []);
    logs.slice(0,200).forEach(l => {
      const d = document.createElement('div');
      d.className = 'log-item';
      d.textContent = `[${new Date(l.time).toLocaleString()}] ${l.msg}`;
      container.appendChild(d);
    });
  }

  function renderNotifCount() {
    const n = loadJSON('omni_notifications', []);
    const unread = n.filter(x => !x.read).length;
    q('#notifCount').textContent = unread > 0 ? String(unread) : '0';
  }

  /* ---------- Drag & Drop for media ---------- */
  function enableDragAndDrop(container) {
    let dragEl = null;
    container.querySelectorAll('.media-card').forEach(card => {
      card.addEventListener('dragstart', function (e) {
        dragEl = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', function () { this.classList.remove('dragging'); dragEl = null; saveMediaOrder(container); });

      card.addEventListener('dragover', function (e) {
        e.preventDefault();
        const after = getDragAfterElement(container, e.clientY);
        if (after == null) container.appendChild(dragEl);
        else container.insertBefore(dragEl, after);
      });
    });
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.media-card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height/2;
      if (offset < 0 && offset > (closest.offset || -Infinity)) { return { offset, element: child }; }
      return closest;
    }, { offset: -Infinity }).element;
  }

  function saveMediaOrder(container) {
    const items = [...container.querySelectorAll('.media-card')].map(c => c.dataset.id);
    // reorder movies and music arrays by id order (merge)
    // We'll simply create new arrays preserving order where items exist
    const movies = loadJSON('omni_movies', []);
    const music = loadJSON('omni_music', []);
    const artists = loadJSON('omni_artists', []);
    const all = [...movies, ...music, ...artists];
    const map = new Map(all.map(i => [i.id, i]));
    const newMovies = [], newMusic = [], newArtists = [];
    items.forEach(id => {
      const it = map.get(id);
      if (!it) return;
      if (it.type === 'movie') newMovies.push(it);
      else if (it.artist) newMusic.push(it);
      else if (it.type === 'artist') newArtists.push(it);
      else {
        if (it.year) newMovies.push(it);
        else newMusic.push(it);
      }
    });
    if (newMovies.length) saveJSON('omni_movies', newMovies); // only if reordering produced something
    if (newMusic.length) saveJSON('omni_music', newMusic);
    if (newArtists.length) saveJSON('omni_artists', newArtists);
    pushLog('Media reordered');
    renderStats();
  }

  /* ---------- CRUD Modals ---------- */
  const modalBackdrop = required('modalBackdrop');
  const modalPanel = required('modalPanel');

  function openModal(html) {
    modalPanel.innerHTML = html;
    modalBackdrop.setAttribute('aria-hidden', 'false');
    // wire close
    const close = modalPanel.querySelector('[data-close]');
    if (close) close.addEventListener('click', () => modalBackdrop.setAttribute('aria-hidden', 'true'));
  }
  function closeModal() { modalBackdrop.setAttribute('aria-hidden', 'true'); }

  /* ---------- Actions ---------- */
  function handleUsersActions(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.closest('.item').dataset.id;
    if (action === 'edit') openEditUserModal(id);
    if (action === 'pw') openResetPasswordModal(id);
    if (action === 'delete') removeUser(id);
  }

  function openEditUserModal(id) {
    const users = loadJSON('omni_users', []);
    const u = users.find(x => x.id === id);
    if (!u) return;
    openModal(`
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:800">Edit User</div>
        <button data-close class="btn">Close</button>
      </div>
      <div style="margin-top:12px">
        <label class="small">Name</label>
        <input id="m_name" value="${(u.name||'').replace(/"/g,'&quot;')}" />
        <label class="small" style="margin-top:8px">Email</label>
        <input id="m_email" value="${(u.email||'').replace(/"/g,'&quot;')}" />
        <label class="small" style="margin-top:8px">Role</label>
        <select id="m_role">
          <option ${u.role==='admin'?'selected':''} value="admin">Admin</option>
          <option ${u.role==='developer'?'selected':''} value="developer">Developer</option>
          <option ${u.role==='user'?'selected':''} value="user">User</option>
        </select>
        <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
          <button id="saveUserBtn" class="btn primary">Save</button>
        </div>
      </div>
    `);
    modalPanel.querySelector('#saveUserBtn').addEventListener('click', () => {
      const name = modalPanel.querySelector('#m_name').value.trim();
      const email = modalPanel.querySelector('#m_email').value.trim().toLowerCase();
      const role = modalPanel.querySelector('#m_role').value;
      const users = loadJSON('omni_users', []);
      const idx = users.findIndex(x => x.id === id);
      if (idx === -1) return;
      users[idx].name = name; users[idx].email = email; users[idx].role = role;
      saveJSON('omni_users', users);
      pushLog(`Updated user ${email}`);
      renderUsers();
      renderStats();
      closeModal();
    });
  }

  function openResetPasswordModal(id) {
    const users = loadJSON('omni_users', []);
    const u = users.find(x => x.id === id);
    if (!u) return;
    openModal(`
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:800">Reset Password</div>
        <button data-close class="btn">Close</button>
      </div>
      <div style="margin-top:12px">
        <div class="small muted">Set a new password for ${u.email}</div>
        <label class="small" style="margin-top:8px">New Password</label>
        <input id="np_pwd" type="password" />
        <div style="margin-top:12px;text-align:right">
          <button id="applyPw" class="btn primary">Apply</button>
        </div>
      </div>
    `);
    modalPanel.querySelector('#applyPw').addEventListener('click', () => {
      const pwd = modalPanel.querySelector('#np_pwd').value;
      if (!pwd) return alert('Enter password');
      const users = loadJSON('omni_users', []);
      const idx = users.findIndex(x => x.id === id);
      users[idx].password = 'obf:' + btoa(pwd); // simple obf
      saveJSON('omni_users', users);
      pushLog(`Password reset for ${users[idx].email}`);
      closeModal();
    });
  }

  function removeUser(id) {
    const users = loadJSON('omni_users', []);
    const idx = users.findIndex(x => x.id === id);
    if (idx === -1) return;
    const removed = users.splice(idx,1)[0];
    saveJSON('omni_users', users);
    pushLog(`Deleted user ${removed.email}`);
    showUndo(`Removed user ${removed.email}`, () => {
      users.splice(idx,0,removed);
      saveJSON('omni_users', users);
      renderUsers();
      pushLog(`Restored user ${removed.email}`);
    });
    renderUsers();
    renderStats();
  }

  /* Media actions */
  function openAddMediaModal() {
    openModal(`
      <div style="display:flex;justify-content:space-between">
        <div style="font-weight:800">Add Media</div><button data-close class="btn">Close</button>
      </div>
      <div style="margin-top:12px">
        <label class="small">Type</label>
        <select id="mm_type">
          <option value="movie">Movie</option>
          <option value="song">Song</option>
          <option value="artist">Artist</option>
        </select>
        <label class="small" style="margin-top:8px">Title</label>
        <input id="mm_title" />
        <label class="small" style="margin-top:8px">Extra (Year / Artist)</label>
        <input id="mm_extra" />
        <div style="text-align:right;margin-top:12px">
          <button id="mm_save" class="btn primary">Save</button>
        </div>
      </div>
    `);
    modalPanel.querySelector('#mm_save').addEventListener('click', () => {
      const type = modalPanel.querySelector('#mm_type').value;
      const title = modalPanel.querySelector('#mm_title').value.trim();
      const extra = modalPanel.querySelector('#mm_extra').value.trim();
      if (!title) return alert('title required');
      if (type === 'movie') {
        const arr = loadJSON('omni_movies', []);
        arr.push({ id: uid('mov'), title, type: 'movie', poster: '', year: Number(extra) || 0 });
        saveJSON('omni_movies', arr);
      } else if (type === 'song') {
        const arr = loadJSON('omni_music', []);
        arr.push({ id: uid('song'), title, artist: extra || 'Unknown', cover: '' });
        saveJSON('omni_music', arr);
      } else {
        const arr = loadJSON('omni_artists', []);
        arr.push({ id: uid('artist'), title, type: 'artist', image: '' });
        saveJSON('omni_artists', arr);
      }
      pushLog(`Added media ${title}`);
      closeModal();
      renderMedia(q('#mediaTypeFilter').value, q('#globalSearch').value.trim());
      renderStats();
    });
  }

  function handleMediaClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const card = btn.closest('.media-card');
    if (!card) return;
    const id = card.dataset.id;
    if (action === 'edit') openEditMediaModal(id);
    if (action === 'delete') removeMedia(id);
  }

  function openEditMediaModal(id) {
    const movies = loadJSON('omni_movies', []);
    const music = loadJSON('omni_music', []);
    const artists = loadJSON('omni_artists', []);
    const all = [...movies, ...music, ...artists];
    const it = all.find(x => x.id === id);
    if (!it) return;
    openModal(`
      <div style="display:flex;justify-content:space-between">
        <div style="font-weight:800">Edit Media</div><button data-close class="btn">Close</button>
      </div>
      <div style="margin-top:12px">
        <label class="small">Title</label>
        <input id="e_title" value="${(it.title||'').replace(/"/g,'&quot;')}" />
        <label class="small" style="margin-top:8px">Extra</label>
        <input id="e_extra" value="${(it.year||it.artist||'').toString().replace(/"/g,'&quot;')}" />
        <div style="text-align:right;margin-top:12px">
          <button id="e_save" class="btn primary">Save</button>
        </div>
      </div>
    `);
    modalPanel.querySelector('#e_save').addEventListener('click', () => {
      const title = modalPanel.querySelector('#e_title').value.trim();
      const extra = modalPanel.querySelector('#e_extra').value.trim();
      // find and update
      let arr = loadJSON('omni_movies', []);
      let idx = arr.findIndex(x => x.id === id);
      if (idx !== -1) { arr[idx].title = title; arr[idx].year = Number(extra)||arr[idx].year; saveJSON('omni_movies', arr); pushLog(`Updated movie ${title}`); closeModal(); renderMedia(); renderStats(); return; }
      arr = loadJSON('omni_music', []); idx = arr.findIndex(x => x.id === id);
      if (idx !== -1) { arr[idx].title = title; arr[idx].artist = extra || arr[idx].artist; saveJSON('omni_music', arr); pushLog(`Updated song ${title}`); closeModal(); renderMedia(); renderStats(); return; }
      arr = loadJSON('omni_artists', []); idx = arr.findIndex(x => x.id === id);
      if (idx !== -1) { arr[idx].title = title; saveJSON('omni_artists', arr); pushLog(`Updated artist ${title}`); closeModal(); renderMedia(); renderStats(); return; }
    });
  }

  function removeMedia(id) {
    let arr = loadJSON('omni_movies', []); let idx = arr.findIndex(x => x.id === id);
    if (idx !== -1) {
      const rem = arr.splice(idx,1)[0]; saveJSON('omni_movies', arr); pushLog(`Deleted movie ${rem.title}`); renderMedia(); showUndo(`Removed ${rem.title}`, () => { arr.splice(idx,0,rem); saveJSON('omni_movies', arr); renderMedia(); pushLog(`Restored movie ${rem.title}`); }); renderStats(); return;
    }
    arr = loadJSON('omni_music', []); idx = arr.findIndex(x => x.id === id);
    if (idx !== -1) {
      const rem = arr.splice(idx,1)[0]; saveJSON('omni_music', arr); pushLog(`Deleted song ${rem.title}`); renderMedia(); showUndo(`Removed ${rem.title}`, () => { arr.splice(idx,0,rem); saveJSON('omni_music', arr); renderMedia(); pushLog(`Restored song ${rem.title}`); }); renderStats(); return;
    }
    arr = loadJSON('omni_artists', []); idx = arr.findIndex(x => x.id === id);
    if (idx !== -1) {
      const rem = arr.splice(idx,1)[0]; saveJSON('omni_artists', arr); pushLog(`Deleted artist ${rem.title}`); renderMedia(); showUndo(`Removed ${rem.title}`, () => { arr.splice(idx,0,rem); saveJSON('omni_artists', arr); renderMedia(); pushLog(`Restored artist ${rem.title}`); }); renderStats(); return;
    }
  }

  /* Payments */
  function addPayment(user, amount, status='paid') {
    const arr = loadJSON('omni_payments', []);
    const tx = { id: uid('tx'), user, amount: Number(amount), date: nowISO(), status };
    arr.unshift(tx);
    saveJSON('omni_payments', arr);
    pushLog(`Recorded payment ${tx.id} for ${user} $${amount}`);
    renderPayments();
    renderStats();
  }

  function removePayment(id) {
    const arr = loadJSON('omni_payments', []);
    const idx = arr.findIndex(x => x.id === id);
    if (idx === -1) return;
    const rem = arr.splice(idx,1)[0];
    saveJSON('omni_payments', arr);
    pushLog(`Deleted payment ${rem.id}`);
    renderPayments();
    renderStats();
  }

  /* Plans */
  function openAddPlanModal() {
    openModal(`
      <div style="display:flex;justify-content:space-between">
        <div style="font-weight:800">New Plan</div><button data-close class="btn">Close</button>
      </div>
      <div style="margin-top:12px">
        <label class="small">Name</label><input id="p_name" />
        <label class="small" style="margin-top:8px">Price</label><input id="p_price" type="number" />
        <label class="small" style="margin-top:8px">Description</label><input id="p_desc" />
        <div style="text-align:right;margin-top:12px"><button id="p_save" class="btn primary">Save</button></div>
      </div>
    `);
    modalPanel.querySelector('#p_save').addEventListener('click', () => {
      const name = modalPanel.querySelector('#p_name').value.trim();
      const price = Number(modalPanel.querySelector('#p_price').value || 0);
      const desc = modalPanel.querySelector('#p_desc').value.trim();
      if (!name) return alert('Name required');
      const arr = loadJSON('omni_subscriptions', []);
      arr.unshift({ id: uid('plan'), name, price, desc });
      saveJSON('omni_subscriptions', arr);
      pushLog(`Added plan ${name}`);
      renderPlans();
      closeModal();
    });
  }

  /* --------- Undo system --------- */
  let lastUndo = null;
  function showUndo(message, restoreFn) {
    lastUndo = restoreFn;
    const toast = required('undoToast');
    q('#undoMsg', toast).textContent = message;
    toast.style.display = 'flex';
    // auto hide 7s
    clearTimeout(toast._hideTO);
    toast._hideTO = setTimeout(() => { toast.style.display = 'none'; lastUndo = null; }, 7000);
  }
  required('undoBtn').addEventListener('click', () => {
    if (lastUndo) lastUndo(); lastUndo = null;
    required('undoToast').style.display = 'none';
  });

  /* ---------- Charts (vanilla canvas) ---------- */
  function drawRevenueChart(payments) {
    const canvas = required('chartRevenue');
    const ctx = canvas.getContext('2d');
    // simple monthly totals for last 6 months
    const months = Array.from({length:6}, (_,i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      return d.toLocaleString('default',{month:'short'});
    });
    const totals = months.map((m,i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      const mnum = d.getMonth(); const y = d.getFullYear();
      const tot = (payments || []).reduce((s,p)=> {
        const pd = new Date(p.date); return s + ((pd.getMonth()===mnum && pd.getFullYear()===y)? Number(p.amount) : 0);
      },0);
      return tot;
    });

    // clear and draw basic line
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const padding = 30;
    const w = canvas.width, h = canvas.height;
    const max = Math.max(1, ...totals);
    // axes
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padding, h - padding); ctx.lineTo(w - padding, h - padding); ctx.stroke();
    // plot
    ctx.strokeStyle = 'rgba(139,231,255,0.95)'; ctx.lineWidth = 2;
    ctx.beginPath();
    totals.forEach((val,i) => {
      const x = padding + i * ((w - padding*2) / (totals.length-1));
      const y = (h - padding) - ( (h - padding*2) * (val / max) );
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      // point
      ctx.fillStyle = 'rgba(139,231,255,1)'; ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
    });
    ctx.stroke();

    // labels
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '12px Inter';
    months.forEach((m,i)=> {
      const x = padding + i * ((w - padding*2) / (months.length-1));
      ctx.fillText(m, x-10, h - padding + 18);
    });
  }

  function drawUsersChart() {
    const canvas = required('chartUsers');
    const ctx = canvas.getContext('2d');
    // simulate active users last 7 days using logs count
    const labels = Array.from({length:7}, (_,i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString(undefined, {month:'short', day:'numeric'});
    });
    // compute a number using logs
    const logs = loadJSON('omni_logs', []);
    const counts = labels.map((lab, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      return logs.filter(l => { const t = new Date(l.time).getTime(); return t >= dayStart && t < dayEnd; }).length + Math.round(Math.random()*5);
    });

    // draw simple bar chart
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const padding = 20, w = canvas.width, h = canvas.height;
    const max = Math.max(1,...counts);
    const bw = (w - padding*2)/counts.length - 8;
    counts.forEach((c,i) => {
      const x = padding + i * (bw + 8);
      const barH = (h - padding*2) * (c / max);
      ctx.fillStyle = 'rgba(139,231,255,0.9)';
      ctx.fillRect(x, h - padding - barH, bw, barH);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '11px Inter';
      ctx.fillText(String(c), x, h - padding - barH - 6);
    });
  }

  /* ---------- Import / Export ---------- */
  function exportAllData() {
    const store = {
      users: loadJSON('omni_users',[]),
      movies: loadJSON('omni_movies',[]),
      music: loadJSON('omni_music',[]),
      payments: loadJSON('omni_payments',[]),
      subscriptions: loadJSON('omni_subscriptions',[]),
      logs: loadJSON('omni_logs',[]),
      notifications: loadJSON('omni_notifications',[]),
      adminSettings: loadJSON('omni_settings_admin',{})
    };
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'omni_export_'+Date.now()+'.json'; a.click();
    pushLog('Exported all data');
  }

  function importAllDataFromFile(file) {
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const obj = JSON.parse(ev.target.result);
        if (obj.users) saveJSON('omni_users', obj.users);
        if (obj.movies) saveJSON('omni_movies', obj.movies);
        if (obj.music) saveJSON('omni_music', obj.music);
        if (obj.payments) saveJSON('omni_payments', obj.payments);
        if (obj.subscriptions) saveJSON('omni_subscriptions', obj.subscriptions);
        if (obj.logs) saveJSON('omni_logs', obj.logs);
        if (obj.notifications) saveJSON('omni_notifications', obj.notifications);
        if (obj.adminSettings) saveJSON('omni_settings_admin', obj.adminSettings);
        pushLog('Imported data from file');
        refreshAll();
      } catch (e) { alert('Invalid JSON file'); }
    };
    reader.readAsText(file);
  }

  /* ---------- Dev utilities ---------- */
  function clearAllData() {
    if (!confirm('Clear all app data? This cannot be undone.')) return;
    ['omni_users','omni_movies','omni_music','omni_payments','omni_subscriptions','omni_logs','omni_notifications','omni_settings_admin'].forEach(k => localStorage.removeItem(k));
    pushLog('Cleared all data');
    ensureSeed();
    refreshAll();
  }

  function seedDemoData() {
    localStorage.removeItem('omni_users');
    ensureSeed();
    refreshAll();
    pushLog('Seeded demo data');
    alert('Demo data seeded');
  }

  /* ---------- UI wiring ---------- */
  function wireUI() {
    // navigation
    qa('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
      qa('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      qa('.view').forEach(v => v.classList.remove('active'));
      const target = document.querySelector(`.view[data-view="${view}"]`);
      if (target) target.classList.add('active');
      refreshAll(); // refresh view
    }));

    // logout
    required('logoutBtn').addEventListener('click', () => {
      localStorage.removeItem('omni_session'); sessionStorage.removeItem('omni_session');
      window.location.href = 'login.html';
    });

    // search global
    required('globalSearch').addEventListener('input', (e) => {
      const val = e.target.value.trim().toLowerCase();
      // quick search across users/media/payments
      renderUsers(val);
      renderMedia(q('#mediaTypeFilter').value, val);
      renderPayments(val);
    });

    // Users actions
    required('usersList').addEventListener('click', handleUsersActions);
    required('userFilter').addEventListener('input', e => renderUsers(e.target.value.trim().toLowerCase()));
    required('addUserBtn').addEventListener('click', () => {
      openModal(`
        <div style="display:flex;justify-content:space-between">
          <div style="font-weight:800">Add User</div><button data-close class="btn">Close</button>
        </div>
        <div style="margin-top:12px">
          <label class="small">Name</label><input id="a_name" />
          <label class="small" style="margin-top:8px">Email</label><input id="a_email" />
          <label class="small" style="margin-top:8px">Role</label>
          <select id="a_role"><option value="user">User</option><option value="developer">Developer</option><option value="admin">Admin</option></select>
          <div style="text-align:right;margin-top:12px"><button id="a_save" class="btn primary">Create</button></div>
        </div>
      `);
      modalPanel.querySelector('#a_save').addEventListener('click', () => {
        const name = modalPanel.querySelector('#a_name').value.trim();
        const email = modalPanel.querySelector('#a_email').value.trim().toLowerCase();
        const role = modalPanel.querySelector('#a_role').value;
        if (!email || !name) return alert('Name & email required');
        const users = loadJSON('omni_users', []);
        if (users.find(x=>x.email===email)) return alert('Email exists');
        users.unshift({ id: uid('u'), name, email, role, password: 'obf:' + btoa('ChangeMe123') });
        saveJSON('omni_users', users);
        pushLog(`Created user ${email}`);
        renderUsers();
        closeModal();
      });
    });

    // Media
    required('addMediaBtn').addEventListener('click', openAddMediaModal);
    required('mediaList').addEventListener('click', handleMediaClick);
    required('mediaTypeFilter').addEventListener('change', e => renderMedia(e.target.value, q('#globalSearch').value.trim()));

    // Payments
    required('addPaymentBtn').addEventListener('click', () => {
      openModal(`
        <div style="display:flex;justify-content:space-between">
          <div style="font-weight:800">Add Payment</div><button data-close class="btn">Close</button>
        </div>
        <div style="margin-top:12px">
          <label class="small">User Email</label><input id="p_user" />
          <label class="small" style="margin-top:8px">Amount</label><input id="p_amount" type="number" />
          <div style="text-align:right;margin-top:12px"><button id="p_save" class="btn primary">Save</button></div>
        </div>
      `);
      modalPanel.querySelector('#p_save').addEventListener('click', () => {
        const user = modalPanel.querySelector('#p_user').value.trim();
        const amount = Number(modalPanel.querySelector('#p_amount').value || 0);
        if (!user || !amount) return alert('Missing fields');
        addPayment(user, amount, 'paid'); closeModal();
      });
    });
    required('paymentFilter').addEventListener('input', e => renderPayments(e.target.value.trim()));
    required('paymentsTable').addEventListener('click', function(e) {
      const btn = e.target.closest('button'); if (!btn) return;
      const action = btn.dataset.action; const id = btn.dataset.id;
      if (action === 'del') removePayment(id);
      if (action === 'view') openPaymentView(id);
    });

    // Plans
    required('addPlanBtn').addEventListener('click', openAddPlanModal);
    required('plansGrid').addEventListener('click', function(e) {
      const btn = e.target.closest('button'); if (!btn) return;
      const action = btn.dataset.action; const id = btn.dataset.id;
      if (action === 'del') {
        const arr = loadJSON('omni_subscriptions', []); const idx = arr.findIndex(x=>x.id===id); if (idx!==-1){ const rem = arr.splice(idx,1)[0]; saveJSON('omni_subscriptions',arr); pushLog(`Deleted plan ${rem.name}`); renderPlans(); }
      }
      if (action === 'edit') openEditPlan(id);
    });

    // Logs / Dev tools
    required('devImportBtn').addEventListener('click', () => {
      const txt = required('devJsonArea').value.trim();
      if (!txt) return alert('Paste JSON first');
      try {
        const obj = JSON.parse(txt);
        if (obj.users) saveJSON('omni_users', obj.users);
        if (obj.movies) saveJSON('omni_movies', obj.movies);
        if (obj.music) saveJSON('omni_music', obj.music);
        pushLog('Imported JSON from dev area');
        refreshAll();
        alert('Imported');
      } catch { alert('Invalid JSON'); }
    });
    required('devExportBtn').addEventListener('click', () => {
      const store = { users: loadJSON('omni_users',[]), movies: loadJSON('omni_movies',[]), music: loadJSON('omni_music',[]) };
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(store,null,2)])); a.download = 'mini_export.json'; a.click();
    });
    required('clearDataBtn').addEventListener('click', clearAllData);
    required('seedDemoBtn').addEventListener('click', seedDemoData);

    // import/export UI
    required('exportAll').addEventListener('click', exportAllData);
    required('importBtn').addEventListener('click', () => required('importInput').click());
    required('importInput').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0]; if (!file) return; importAllDataFromFile(file);
      e.target.value = '';
    });

    // Notifications
    required('notificationsBtn').addEventListener('click', () => {
      const n = loadJSON('omni_notifications', []);
      openModal(`<div style="display:flex;justify-content:space-between"><div style="font-weight:800">Notifications</div><button data-close class="btn">Close</button></div>
        <div style="margin-top:12px;max-height:420px;overflow:auto">${n.map(x=>`<div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.02);margin-bottom:8px"><div style="font-weight:700">${x.title}</div><div class="small muted">${x.body}</div><div class="small muted">${new Date(x.time).toLocaleString()}</div></div>`).join('')}</div>`);
      const all = n.map(x=> ({...x,read:true})); saveJSON('omni_notifications', all); renderNotifCount();
    });

    // admin settings
    required('adminTheme').addEventListener('change', (e) => { saveJSON('omni_settings_admin', { theme: e.target.value, showNotifs: required('showNotifs').checked }); applyAdminSettings(); });
    required('showNotifs').addEventListener('change', (e) => { const s = loadJSON('omni_settings_admin', {}); s.showNotifs = e.target.checked; saveJSON('omni_settings_admin', s); applyAdminSettings(); });
    required('exportBtn2').addEventListener('click', exportAllData);
  }

  function openPaymentView(id) {
    const arr = loadJSON('omni_payments', []);
    const p = arr.find(x=>x.id===id); if (!p) return;
    openModal(`<div style="display:flex;justify-content:space-between"><div style="font-weight:800">Payment ${p.id}</div><button data-close class="btn">Close</button></div>
      <div style="margin-top:12px"><div><strong>User:</strong> ${p.user}</div><div><strong>Amount:</strong> $${Number(p.amount).toFixed(2)}</div><div><strong>Date:</strong> ${new Date(p.date).toLocaleString()}</div></div>`);
  }

  function openEditPlan(id) {
    const arr = loadJSON('omni_subscriptions', []);
    const p = arr.find(x=>x.id===id); if (!p) return;
    openModal(`<div style="display:flex;justify-content:space-between"><div style="font-weight:800">Edit Plan</div><button data-close class="btn">Close</button></div>
      <div style="margin-top:12px">
        <label class="small">Name</label><input id="pl_name" value="${p.name}" />
        <label class="small" style="margin-top:8px">Price</label><input id="pl_price" value="${p.price}" type="number" />
        <label class="small" style="margin-top:8px">Desc</label><input id="pl_desc" value="${p.desc || ''}" />
        <div style="text-align:right;margin-top:12px"><button id="pl_save" class="btn primary">Save</button></div>
      </div>`);
    modalPanel.querySelector('#pl_save').addEventListener('click', () => {
      const arr = loadJSON('omni_subscriptions', []); const pidx = arr.findIndex(x=>x.id===id);
      arr[pidx].name = modalPanel.querySelector('#pl_name').value.trim();
      arr[pidx].price = Number(modalPanel.querySelector('#pl_price').value||0);
      arr[pidx].desc = modalPanel.querySelector('#pl_desc').value.trim();
      saveJSON('omni_subscriptions', arr); pushLog(`Updated plan ${arr[pidx].name}`); renderPlans(); closeModal();
    });
  }

  /* ---------- Refresh everything ---------- */
  function refreshAll() {
    renderStats();
    renderUsers();
    renderMedia(q('#mediaTypeFilter') ? q('#mediaTypeFilter').value : 'all', q('#globalSearch') ? q('#globalSearch').value.trim() : '');
    renderPayments();
    renderPlans();
    renderLogs();
    renderNotifCount();
    applyAdminSettings();
  }

  function applyAdminSettings() {
    const s = loadJSON('omni_settings_admin', { theme: 'dark', showNotifs: true });
    if (s.theme === 'light') document.body.style.background = '#f5f7fb'; else document.body.style.background = '';
    try { required('showNotifs').checked = !!s.showNotifs; required('adminTheme').value = s.theme; } catch {}
  }

  /* ---------- Initialization ---------- */
  function init() {
    ensureSeed();
    if (!requireAdminSession()) return;
    wireUI();
    refreshAll();

    // event delegation for media list actions (buttons)
    required('mediaList').addEventListener('click', (e) => {
      if (e.target.matches('button')) {
        handleMediaClick(e);
      }
    });

    // payments initial render
    renderPayments();

    // listen for modal backdrop clicks to close
    modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });
  }

  // run
  init();

})();
