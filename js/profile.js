// @ts-nocheck
/**
 * profile.js
 * Fullscreen Profile page — Style C (no server). Works with omni_* localStorage keys.
 *
 * - Avatar upload (base64)
 * - Edit/save profile (name, bio)
 * - Preferences (theme, volume, explicit filter, mini-player, language)
 * - Change password (client-only)
 * - Delete account (removes user from omni_users + session)
 * - Activity list from omni_logs
 */

(function () {
  "use strict";

  /* helpers */
  function required(id) { const el = document.getElementById(id); if (!el) throw new Error("Missing #" + id); return el; }
  function q(sel, ctx=document) { return ctx.querySelector(sel); }
  function qa(sel, ctx=document) { return Array.from(ctx.querySelectorAll(sel)); }
  function load(key, def) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : def; } catch { return def; } }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  function uid(pref='id') { return pref + '_' + Math.random().toString(36).slice(2,9); }
  function nowISO() { return new Date().toISOString(); }

  /* SESSION CHECK (user role) */
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

  /* DOM refs */
  const avatarImg = required('avatarImg');
  const avatarInput = required('avatarInput');
  const changeAvatarBtn = required('changeAvatarBtn');

  const displayName = required('displayName');
  const displayEmail = required('displayEmail');
  const favCountEl = required('favCount');
  const plCountEl = required('plCount');
  const historyCountEl = required('historyCount');

  const inputName = required('inputName');
  const inputEmail = required('inputEmail');
  const inputBio = required('inputBio');
  const saveProfileBtn = required('saveProfileBtn');
  const editProfileBtn = required('editProfileBtn');

  const prefTheme = required('prefTheme');
  const prefVolume = required('prefVolume');
  const prefExplicit = required('prefExplicit');
  const prefMini = required('prefMini');
  const prefLang = required('prefLang');
  const savePrefsBtn = required('savePrefsBtn');

  const oldPassword = required('oldPassword');
  const newPassword = required('newPassword');
  const confirmPassword = required('confirmPassword');
  const changePwBtn = required('changePwBtn');

  const activityList = required('activityList');
  const clearHistoryBtn = required('clearHistoryBtn');

  const deleteAccountBtn = required('deleteAccountBtn');
  const exportDataBtn = required('exportDataBtn');

  const modalBackdrop = required('modalBackdrop');
  const modalPanel = required('modalPanel');

  /* Data stores */
  let users = load('omni_users', []);
  let music = load('omni_music', []);
  let movies = load('omni_movies', []);
  let playlists = load('omni_playlists', []);
  let favorites = load('omni_favorites', []);
  let logs = load('omni_logs', []);
  let settings = load('omni_settings', { defaultVolume: 0.8, miniPlayerEnabled: true });
  let profile = load('omni_profile_' + (session.email || session.id), null); // optional per-user profile

  /* Init UI */
  function applyProfileToUI() {
    // load avatar (profile first, else per-user stored base)
    if (profile && profile.avatar) avatarImg.src = profile.avatar;
    else {
      const stored = localStorage.getItem('omni_avatar_' + (session.email || session.id));
      avatarImg.src = stored || generateAvatarPlaceholder(session.name || session.email);
    }

    const userRec = users.find(u => (u.email||'').toLowerCase() === (session.email||'').toLowerCase());
    const display = userRec ? (userRec.name || userRec.email) : (session.name || session.email);
    displayName.textContent = display;
    displayEmail.textContent = session.email || '';

    // profile fields
    inputName.value = profile && profile.name ? profile.name : (userRec && userRec.name ? userRec.name : (session.name || ''));
    inputEmail.value = session.email || '';
    inputBio.value = profile && profile.bio ? profile.bio : (userRec && userRec.bio ? userRec.bio : '');

    // stats
    favCountEl.textContent = (favorites || []).length;
    plCountEl.textContent = (playlists || []).length;
    historyCountEl.textContent = (logs || []).length;

    // prefs
    prefTheme.value = settings.theme || 'dark';
    prefVolume.value = Number(settings.defaultVolume ?? 0.8);
    prefExplicit.checked = !!settings.explicitFilter;
    prefMini.checked = !!settings.miniPlayerEnabled;
    prefLang.value = settings.language || 'en';
  }

  function generateAvatarPlaceholder(name) {
    const c = document.createElement('canvas');
    c.width = 280; c.height = 280;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0b2130';
    ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle = '#8be7ff';
    ctx.font = 'bold 120px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((name||'U').slice(0,1).toUpperCase(), c.width/2, c.height/2);
    return c.toDataURL('image/png');
  }

  /* Avatar upload */
  changeAvatarBtn.addEventListener('click', () => avatarInput.click());
  avatarInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      const base64 = ev.target.result;
      avatarImg.src = base64;
      // persist per-user
      localStorage.setItem('omni_avatar_' + (session.email || session.id), base64);
      // optionally save into profile object
      profile = profile || {};
      profile.avatar = base64;
      save('omni_profile_' + (session.email || session.id), profile);
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  });

  /* Save profile */
  saveProfileBtn.addEventListener('click', () => {
    const name = inputName.value.trim();
    const bio = inputBio.value.trim();
    // update user record in omni_users
    const idx = users.findIndex(u => (u.email||'').toLowerCase() === (session.email||'').toLowerCase());
    if (idx !== -1) {
      users[idx].name = name || users[idx].name;
      users[idx].bio = bio;
      save('omni_users', users);
    }
    profile = profile || {};
    profile.name = name || session.name;
    profile.bio = bio;
    save('omni_profile_' + (session.email || session.id), profile);

    // reflect and notify
    displayName.textContent = name || displayName.textContent;
    toast('Profile saved');
  });

  editProfileBtn.addEventListener('click', () => {
    // scroll to account tab
    switchTab('account');
    window.scrollTo({ top: 400, behavior: 'smooth' });
  });

  /* Preferences save */
  savePrefsBtn.addEventListener('click', () => {
    settings.theme = prefTheme.value;
    settings.defaultVolume = Number(prefVolume.value);
    settings.explicitFilter = !!prefExplicit.checked;
    settings.miniPlayerEnabled = !!prefMini.checked;
    settings.language = prefLang.value;
    save('omni_settings', settings);
    applySettings();
    toast('Preferences saved');
  });

  function applySettings() {
    // simple theme
    if (settings.theme === 'light') {
      document.documentElement.style.background = '#f5f7fb';
    } else {
      document.documentElement.style.background = '';
    }
    // mini-player setting is handled by player page (this just persists)
  }

  /* Change password (client-side only) */
  changePwBtn.addEventListener('click', () => {
    const oldPw = oldPassword.value || '';
    const newPw = newPassword.value || '';
    const confirmPw = confirmPassword.value || '';
    if (!oldPw || !newPw || !confirmPw) return toast('Fill all password fields');
    if (newPw !== confirmPw) return toast('New passwords do not match');
    // find user in omni_users
    const idx = users.findIndex(u => (u.email||'').toLowerCase() === (session.email||'').toLowerCase());
    if (idx === -1) return toast('Account record not found');
    const stored = users[idx].password || '';
    const plainStored = stored.startsWith('obf:') ? atob(stored.slice(4)) : stored;
    if (plainStored !== oldPw) return toast('Current password incorrect');
    users[idx].password = 'obf:' + btoa(newPw);
    save('omni_users', users);
    oldPassword.value = newPassword.value = confirmPassword.value = '';
    toast('Password changed');
  });

  /* Activity render */
  function renderActivity() {
    activityList.innerHTML = '';
    if (!Array.isArray(logs) || logs.length === 0) {
      activityList.innerHTML = '<div class="activity-item muted">No recent activity.</div>';
      return;
    }
    logs.slice(0,200).forEach(l => {
      const d = document.createElement('div');
      d.className = 'activity-item';
      d.textContent = `[${new Date(l.time).toLocaleString()}] ${l.msg}`;
      activityList.appendChild(d);
    });
  }

  clearHistoryBtn.addEventListener('click', () => {
    if (!confirm('Clear listening history?')) return;
    logs = [];
    save('omni_logs', logs);
    renderActivity();
    toast('History cleared');
  });

  /* Delete account */
  deleteAccountBtn.addEventListener('click', () => {
    openModal(`
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:800">Delete account</div><button data-close class="btn">Close</button>
      </div>
      <div style="margin-top:12px">
        <p class="muted">Deleting your account will remove your user record and session from this local environment. This action is irreversible locally.</p>
        <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px;">
          <button id="confirmDelete" class="btn danger">Delete account</button>
          <button data-close class="btn">Cancel</button>
        </div>
      </div>
    `);
    modalPanel.querySelector('#confirmDelete').addEventListener('click', () => {
      // remove user from omni_users and session
      users = users.filter(u => (u.email||'').toLowerCase() !== (session.email||'').toLowerCase());
      save('omni_users', users);
      // remove profile, avatar, session
      localStorage.removeItem('omni_profile_' + (session.email || session.id));
      localStorage.removeItem('omni_avatar_' + (session.email || session.id));
      localStorage.removeItem('omni_session'); sessionStorage.removeItem('omni_session');
      closeModal();
      // redirect to login
      window.location.href = 'login.html';
    }, { once: true });
  });

  /* Export data (current user's data snapshot) */
  exportDataBtn.addEventListener('click', () => {
    const payload = {
      profile: profile || {},
      favorites: favorites || [],
      playlists: playlists || [],
      logs: logs || [],
      settings: settings || {}
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `omni_profile_${(session.email||'user')}.json`; a.click();
  });

  /* Small toasts */
  const toastContainer = document.createElement('div');
  toastContainer.style.position = 'fixed';
  toastContainer.style.right = '18px';
  toastContainer.style.bottom = '18px';
  toastContainer.style.zIndex = '999';
  document.body.appendChild(toastContainer);

  function toast(msg, ms = 1800) {
    const d = document.createElement('div');
    d.textContent = msg;
    d.style.background = 'rgba(0,0,0,0.7)';
    d.style.padding = '8px 12px';
    d.style.borderRadius = '8px';
    d.style.color = '#fff';
    d.style.marginTop = '8px';
    d.style.fontSize = '13px';
    toastContainer.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; setTimeout(()=>d.remove(),250); }, ms);
  }

  /* Modal helpers */
  function openModal(html) {
    modalPanel.innerHTML = html;
    modalBackdrop.setAttribute('aria-hidden', 'false');
    const close = modalPanel.querySelector('[data-close]');
    if (close) close.addEventListener('click', () => modalBackdrop.setAttribute('aria-hidden', 'true'));
  }
  function closeModal() { modalBackdrop.setAttribute('aria-hidden', 'true'); }

  /* Tab switching */
  qa('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
    qa('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    qa('.tab').forEach(t => t.classList.remove('active'));
    q(`.tab[data-tab="${tab}"]`).classList.add('active');
  }));

  /* initialize */
  function init() {
    // refresh data references (in case changed)
    users = load('omni_users', []);
    music = load('omni_music', []);
    movies = load('omni_movies', []);
    playlists = load('omni_playlists', []);
    favorites = load('omni_favorites', []);
    logs = load('omni_logs', []);
    settings = load('omni_settings', settings);
    profile = load('omni_profile_' + (session.email || session.id), profile);

    applyProfileToUI();
    renderActivity();
    applySettings();
  }

  modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

  init();

})();
