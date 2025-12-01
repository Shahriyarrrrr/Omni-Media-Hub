// @ts-nocheck
/**
 * dev-portal.js
 * Pure front-end developer console (XAMPP-safe).
 */

(function () {
  "use strict";

  /* Utility */
  const q = (s, c=document) => c.querySelector(s);
  const qa = (s, c=document) => [...c.querySelectorAll(s)];
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const uid = (p="id") => p + "_" + Math.random().toString(36).slice(2,9);
  const log = (msg) => pushLog(msg);

  function pushLog(msg){
    const logs = load('omni_logs',[]);
    logs.unshift({ id:uid("lg"), time:new Date().toISOString(), msg });
    save('omni_logs', logs);
    renderLogs();
  }

  function required(id) {
    const el = document.getElementById(id);
    if (!el) throw `Missing element #${id}`;
    return el;
  }

  /* SESSION CHECK */
  function requireDev(){
    let raw = localStorage.getItem("omni_session") || sessionStorage.getItem("omni_session");
    if(!raw){ window.location='login.html'; return false; }
    const s = JSON.parse(raw);
    if(!s || s.role!=='developer'){ window.location='login.html'; return false; }
    q('#devName').textContent = s.name || s.email;
    return true;
  }

  /* Switch panels */
  function switchPanel(name){
    qa('.nav-btn').forEach(btn=>btn.classList.remove('active'));
    qa('.panel').forEach(p=>p.classList.remove('active'));
    q(`.nav-btn[data-panel="${name}"]`).classList.add('active');
    q(`.panel[data-panel="${name}"]`).classList.add('active');
  }

  /* Render overview stats */
  function renderStats(){
    const users = load('omni_users',[]);
    const movies = load('omni_movies',[]);
    const music = load('omni_music',[]);
    const payments = load('omni_payments',[]);
    required('devStatUsers').textContent = users.length;
    required('devStatMedia').textContent = movies.length + music.length;
    required('devStatPayments').textContent = payments.length;
  }

  /* Storage inspector */
  function renderStorage(){
    const container = required('storageList');
    container.innerHTML = '';
    for (let i=0;i<localStorage.length;i++){
      const key = localStorage.key(i);
      const item = document.createElement("div");
      item.className = "storage-item";
      item.textContent = key;
      item.addEventListener('click', ()=>{
        openModal(`
          <h2>Storage Key: ${key}</h2>
          <pre style="white-space:pre-wrap;">${localStorage.getItem(key)}</pre>
          <button data-close class="btn">Close</button>
        `);
      });
      container.appendChild(item);
    }
  }

  /* JSON editor */
  function loadJsonEditor(){
    required('jsonArea').value = JSON.stringify({
      users:load('omni_users',[]),
      movies:load('omni_movies',[]),
      music:load('omni_music',[]),
      payments:load('omni_payments',[])
    },null,2);
  }
  function applyJsonEditor(){
    try{
      const obj = JSON.parse(required('jsonArea').value);
      if(obj.users) save('omni_users',obj.users);
      if(obj.movies) save('omni_movies',obj.movies);
      if(obj.music) save('omni_music',obj.music);
      if(obj.payments) save('omni_payments',obj.payments);
      log("Applied JSON editor changes");
      refreshAll();
    }catch(e){ alert("Invalid JSON"); }
  }

  /* Sandbox */
  function runSandbox(){
    const input = required('sandboxInput').value;
    required('sandboxOutput').innerHTML = input;
  }

  /* Logs */
  function renderLogs(){
    const logs = load('omni_logs',[]);
    const container = required('devLogs');
    container.innerHTML = logs.slice(0,200).map(l=>{
      return `<div class="log-item">[${new Date(l.time).toLocaleString()}] ${l.msg}</div>`;
    }).join('');
  }

  /* Modal system */
  const modalBackdrop = required('modalBackdrop');
  const modalPanel = required('modalPanel');

  function openModal(html){
    modalPanel.innerHTML = html;
    modalBackdrop.setAttribute("aria-hidden","false");
    const close = modalPanel.querySelector('[data-close]');
    if(close) close.addEventListener('click',()=> modalBackdrop.setAttribute("aria-hidden","true"));
  }

  /* Fake data generators */
  function fakeUser(){
    const users = load('omni_users',[]);
    const id=uid('u');
    const email=`fake_${id}@mail.com`;
    users.push({id,email,name:"Fake User",role:"user",password:"obf:"+btoa("123456")});
    save('omni_users',users);
    log("Added fake user "+email);
    refreshAll();
  }

  function fakeMedia(){
    const movies = load('omni_movies',[]);
    movies.push({id:uid('mov'),title:"Fake Movie "+Math.floor(Math.random()*1000),type:"movie"});
    save('omni_movies',movies);
    log("Added fake media");
    refreshAll();
  }

  function fakePayment(){
    const payments = load('omni_payments',[]);
    payments.push({
      id:uid('tx'),
      user:"demo@user",
      amount:(Math.random()*10+2).toFixed(2),
      date: new Date().toISOString(),
      status:"paid"
    });
    save('omni_payments',payments);
    log("Added fake payment");
    refreshAll();
  }

  /* Import / Export */
  function exportData(){
    const obj = {
      users:load('omni_users',[]),
      movies:load('omni_movies',[]),
      music:load('omni_music',[]),
      payments:load('omni_payments',[])
    };
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download="omni_dev_export.json";
    a.click();
    log("Exported app data");
  }

  function importData(file){
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const obj=JSON.parse(ev.target.result);
        if(obj.users) save('omni_users',obj.users);
        if(obj.movies) save('omni_movies',obj.movies);
        if(obj.music) save('omni_music',obj.music);
        if(obj.payments) save('omni_payments',obj.payments);
        log("Imported JSON data");
        refreshAll();
      }catch(e){ alert("Invalid JSON"); }
    };
    reader.readAsText(file);
  }

  /* Dev Settings */
  function applyDevSettings(){
    const neon = required('devTheme').checked;
    const autoLogs = required('devAutoLogs').checked;

    if(neon){
      document.body.style.boxShadow="inset 0 0 60px rgba(0,255,150,0.2)";
    }else{
      document.body.style.boxShadow="";
    }

    save('omni_devSettings',{neon,autoLogs});

    if(autoLogs){
      log("Auto logs enabled");
    }
  }

  /* Clear all data */
  function clearAll(){
    if(!confirm("Clear ALL app data?"))return;
    ["omni_users","omni_movies","omni_music","omni_payments",
     "omni_logs","omni_notifications","omni_subscriptions",
     "omni_settings_admin"].forEach(k=> localStorage.removeItem(k));
    log("Cleared all storage");
    refreshAll();
  }

  /* Initial load */
  function refreshAll(){
    renderStats();
    renderStorage();
    loadJsonEditor();
    renderLogs();
  }

  /* EVENT WIRING */
  function wireEvents(){

    // sidebar navigation
    qa('.nav-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        switchPanel(btn.dataset.panel);
      });
    });

    // logout
    required('logoutBtn').addEventListener('click',()=>{
      localStorage.removeItem("omni_session");
      sessionStorage.removeItem("omni_session");
      window.location='login.html';
    });

    // tools
    required('simNotif').addEventListener('click',()=>{
      const n = load('omni_notifications',[]);
      n.unshift({id:uid('n'),time:new Date().toISOString(),title:"Dev Test",body:"This is a developer test notification."});
      save('omni_notifications',n);
      log("Simulated notification push");
      alert("Notification pushed!");
    });

    required('simError').addEventListener('click',()=>{
      try{
        throw new Error("Developer simulated error");
      }catch(err){
        log("Simulated error triggered: "+err.message);
        alert("Error triggered. Check Dev Logs.");
      }
    });

    required('addFakeUser').addEventListener('click',fakeUser);
    required('addFakeMedia').addEventListener('click',fakeMedia);
    required('addFakePayment').addEventListener('click',fakePayment);
    required('clearAll').addEventListener('click',clearAll);

    // storage inspector refresh
    // JSON Editor
    required('saveJson').addEventListener('click',applyJsonEditor);
    required('prettyJson').addEventListener('click',()=> {
      try{
        const v=JSON.parse(required('jsonArea').value);
        required('jsonArea').value=JSON.stringify(v,null,2);
      }catch{}
    });

    // sandbox
    required('sandboxInput').addEventListener('input',runSandbox);

    // import/export
    required('exportBtn').addEventListener('click',exportData);
    required('importBtn').addEventListener('click',()=> required('importInput').click());
    required('importInput').addEventListener('change',(e)=>{
      const f=e.target.files[0];
      if(f) importData(f);
    });

    // dev settings
    const settings = load('omni_devSettings',{neon:false,autoLogs:false});
    required('devTheme').checked = settings.neon;
    required('devAutoLogs').checked = settings.autoLogs;
    required('devTheme').addEventListener('change',applyDevSettings);
    required('devAutoLogs').addEventListener('change',applyDevSettings);

    // Initial sandbox run
    runSandbox();
  }

  /* INIT */
  function init(){
    if(!requireDev()) return;
    refreshAll();
    wireEvents();
  }

  init();

})();
