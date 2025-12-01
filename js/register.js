// register.js — OMNI Pro Auth
// @ts-nocheck

(function () {
  "use strict";

  function toast(msg, ms = 2000) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), ms);
  }

  function load(key, def) {
    try {
      const r = localStorage.getItem(key);
      return r ? JSON.parse(r) : def;
    } catch {
      return def;
    }
  }

  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  const form = document.getElementById("registerForm");
  const regName = document.getElementById("regName");
  const regEmail = document.getElementById("regEmail");
  const regPw = document.getElementById("regPassword");
  const regConfirm = document.getElementById("regConfirm");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const name = regName.value.trim();
    const email = regEmail.value.trim().toLowerCase();
    const pw = regPw.value;
    const cPw = regConfirm.value;

    if (!name || !email || !pw || !cPw) {
      return toast("Fill all fields");
    }
    if (!email.includes("@")) return toast("Invalid email");
    if (pw.length < 4) return toast("Password too short");
    if (pw !== cPw) return toast("Passwords do not match");

    let users = load("omni_users", []);

    if (users.some(u => (u.email || "").toLowerCase() === email)) {
      return toast("Email already registered");
    }

    const newUser = {
      id: "user_" + Math.random().toString(36).slice(2, 10),
      name,
      email,
      role: "user",
      bio: "",
      password: "obf:" + btoa(pw),
      created: new Date().toISOString()
    };

    users.push(newUser);
    save("omni_users", users);

    // Set session
    const session = {
      id: newUser.id,
      name,
      email,
      role: "user",
      loginTime: Date.now()
    };

    localStorage.setItem("omni_session", JSON.stringify(session));

    toast("Account created!");
    setTimeout(() => {
      window.location.href = "user-dashboard.html";
    }, 600);
  });

})();
