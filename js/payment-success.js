// payment-success.js — Omni Pro Payment Success
// @ts-nocheck

(function () {
  "use strict";

  const last = localStorage.getItem("omni_last_payment");
  const sessionRaw = localStorage.getItem("omni_session");

  if (!last || !sessionRaw) {
    // no transaction, redirect
    window.location.href = "checkout.html";
  }

  const txn = JSON.parse(last);
  const session = JSON.parse(sessionRaw);

  const box = document.getElementById("txnDetails");
  box.innerHTML = `
      <div><strong>User:</strong> ${session.email}</div>
      <div><strong>Plan:</strong> ${txn.plan}</div>
      <div><strong>Amount Paid:</strong> $${txn.amount}</div>
      <div><strong>Transaction ID:</strong> ${txn.id}</div>
      <div><strong>Date:</strong> ${new Date(txn.date).toLocaleString()}</div>
  `;

  document.getElementById("goDashboard").onclick = () => {
    window.location.href = "user-dashboard.html";
  };

})();
