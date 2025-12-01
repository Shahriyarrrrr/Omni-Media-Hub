// checkout.js — Omni Pro Payment System
// @ts-nocheck

(function () {
  "use strict";

  function toast(msg, ms = 2200) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), ms);
  }

  function load(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) || def; }
    catch { return def; }
  }

  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // Session Required
  const sessionRaw = localStorage.getItem("omni_session");
  if (!sessionRaw) window.location.href = "login.html";
  const session = JSON.parse(sessionRaw);

  const paymentForm = document.getElementById("paymentForm");

  paymentForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const plan = document.querySelector("input[name='plan']:checked").value;
    const name = document.getElementById("cardName").value.trim();
    const card = document.getElementById("cardNumber").value.replace(/\s+/g, "");
    const expiry = document.getElementById("expiry").value;
    const cvv = document.getElementById("cvv").value;

    if (!name || !card || !expiry || !cvv) return toast("Fill all fields");
    if (card.length < 16) return toast("Invalid card number");
    if (!expiry.match(/^[0-1][0-9]\/[0-9]{2}$/)) return toast("Invalid expiry (MM/YY)");
    if (cvv.length !== 3) return toast("Invalid CVV");

    // Pricing
    let amount = 9.99;
    if (plan === "yearly") amount = 99.99;
    if (plan === "premium") amount = 149.99;

    const txn = {
      id: "txn_" + Math.random().toString(36).slice(2, 10),
      user: session.email,
      plan,
      amount,
      date: new Date().toISOString()
    };

    let payments = load("omni_payments", []);
    payments.push(txn);
    save("omni_payments", payments);

    localStorage.setItem("omni_last_payment", JSON.stringify(txn));

    toast("Processing payment...");

    setTimeout(() => {
      window.location.href = "payment-success.html";
    }, 1200);
  });

  // Auto-format card number
  const cardInput = document.getElementById("cardNumber");
  cardInput.addEventListener("input", () => {
    let v = cardInput.value.replace(/\D/g, "");
    v = v.match(/.{1,4}/g)?.join(" ") || v;
    cardInput.value = v;
  });

})();
