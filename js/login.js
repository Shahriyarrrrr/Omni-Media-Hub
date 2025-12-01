// @ts-nocheck
(function () {
  "use strict";

  // utility
  function required(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error("Missing #" + id);
    return el;
  }

  /* DOM */
  const loginForm = required("loginForm");
  const emailEl = required("email");
  const pwdEl = required("password");
  const togglePw = required("togglePw");
  const rememberEl = required("remember");
  const openRegister = required("openRegister");
  const forgotBtn = required("forgotBtn");
  const toastContainer = required("toastContainer");

  // register modal
  const registerModal = required("registerModal");
  const closeRegister = required("closeRegister");
  const regName = required("regName");
  const regEmail = required("regEmail");
  const regPassword = required("regPassword");
  const regRole = required("regRole");
  const registerBtn = required("registerBtn");

  // forgot modal
  const forgotModal = required("forgotModal");
  const closeForgot = required("closeForgot");
  const fpEmail = required("fpEmail");
  const fpLookup = required("fpLookup");
  const fpNewPwd = required("fpNewPwd");
  const fpApply = required("fpApply");
  const fpStep2 = required("fpStep2");

  /* constants */
  const KEY_USERS = "omni_users";
  const KEY_SESSION = "omni_session";

  /* helpers */
  function toast(msg, ms = 1600) {
    const d = document.createElement("div");
    d.className = "toast";
    d.textContent = msg;
    toastContainer.appendChild(d);
    setTimeout(() => {
      d.style.opacity = "0";
      setTimeout(() => d.remove(), 250);
    }, ms);
  }

  function obf(p) { return "obf:" + btoa(String(p)); }
  function deobf(st) { return st && st.startsWith("obf:") ? atob(st.slice(4)) : ""; }

  function loadUsers() {
    try {
      const raw = localStorage.getItem(KEY_USERS);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function saveUsers(arr) {
    localStorage.setItem(KEY_USERS, JSON.stringify(arr));
  }

  /* Seed demo accounts (local only) */
  (function seed() {
    const u = loadUsers();
    if (u.length === 0) {
      saveUsers([
        { id: "u_admin", name: "Admin", email: "admin@omni", password: obf("Admin@123"), role: "admin" },
        { id: "u_dev", name: "Developer", email: "dev@omni", password: obf("Dev@123"), role: "developer" },
        { id: "u_user", name: "User", email: "user@omni", password: obf("User@123"), role: "user" }
      ]);
    }
  })();

  function createSession(user, remember) {
    const session = { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: Date.now() };
    if (remember) localStorage.setItem(KEY_SESSION, JSON.stringify(session));
    else sessionStorage.setItem(KEY_SESSION, JSON.stringify(session));
  }

  function checkSessionAndRedirect() {
    try {
      const raw = localStorage.getItem(KEY_SESSION) || sessionStorage.getItem(KEY_SESSION);
      if (raw) {
        const s = JSON.parse(raw);
        redirectByRole(s.role);
      }
    } catch {}
  }

  function redirectByRole(role) {
    if (role === "admin") window.location.href = "admin-dashboard.html";
    else if (role === "developer") window.location.href = "dev-dashboard.html";
    else window.location.href = "index.html";
  }

  /* LOGIN */
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const email = String(emailEl.value || "").trim().toLowerCase();
    const pwd = String(pwdEl.value || "");

    if (!email || !pwd) return toast("Enter email & password");

    const users = loadUsers();
    const user = users.find(u => String(u.email).toLowerCase() === email);
    if (!user) return toast("No such account");

    if (deobf(user.password) !== pwd) return toast("Incorrect password");

    createSession(user, rememberEl.checked);
    toast("Login successful");
    setTimeout(() => redirectByRole(user.role), 350);
  });

  /* PASSWORD TOGGLE */
  togglePw.onclick = function () {
    if (pwdEl.type === "password") {
      pwdEl.type = "text";
      togglePw.textContent = "🙈";
    } else {
      pwdEl.type = "password";
      togglePw.textContent = "👁";
    }
  };

  /* REGISTER */
  openRegister.onclick = () => registerModal.setAttribute("aria-hidden", "false");
  closeRegister.onclick = () => registerModal.setAttribute("aria-hidden", "true");

  registerBtn.onclick = function () {
    const name = regName.value.trim();
    const email = regEmail.value.trim().toLowerCase();
    const pwd = regPassword.value;
    const role = regRole.value;

    if (!name || !email || !pwd) return toast("All fields required");

    const u = loadUsers();
    if (u.find(x => x.email === email)) return toast("Email already registered");

    const id = "u_" + Math.random().toString(36).slice(2, 9);
    u.push({ id, name, email, password: obf(pwd), role });
    saveUsers(u);

    createSession({ id, name, email, role }, true);
    toast("Registered successfully");
    setTimeout(() => redirectByRole(role), 400);
  };

  /* FORGOT PASSWORD */
  forgotBtn.onclick = () => forgotModal.setAttribute("aria-hidden", "false");
  closeForgot.onclick = () => {
    forgotModal.setAttribute("aria-hidden", "true");
    fpStep2.style.display = "none";
  };

  fpLookup.onclick = function () {
    const email = fpEmail.value.trim().toLowerCase();
    const u = loadUsers();
    const found = u.find(x => x.email === email);

    if (!found) return toast("Email not found");

    fpStep2.style.display = "block";
    toast("Email verified — set new password");
  };

  fpApply.onclick = function () {
    const email = fpEmail.value.trim().toLowerCase();
    const pwd = fpNewPwd.value.trim();

    if (!email || !pwd) return toast("Missing fields");

    const u = loadUsers();
    const idx = u.findIndex(x => x.email === email);
    if (idx === -1) return toast("No account found");

    u[idx].password = obf(pwd);
    saveUsers(u);

    toast("Password updated");
    forgotModal.setAttribute("aria-hidden", "true");
    fpStep2.style.display = "none";
  };

  /* AUTO SESSION CHECK */
  checkSessionAndRedirect();

})();
