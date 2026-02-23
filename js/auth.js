// js/auth.js
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import { auth } from "./firebase.js";

export function bindGoogleLogin(buttonId = "btnLogin", statusId = "status", redirectTo = "dashboard.html") {
  const btn = document.getElementById(buttonId);
  const statusEl = document.getElementById(statusId);

  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      if (statusEl) statusEl.textContent = "Abrindo login Google...";
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      if (statusEl) statusEl.textContent = "Login OK. Redirecionando...";
      window.location.href = redirectTo;
    } catch (e) {
      console.error("Erro no login:", e);
      if (statusEl) statusEl.textContent = `Erro no login: ${e?.code || e?.message}`;
    }
  });
}

export function requireAuth(redirectTo = "index.html") {
  // Protege a página: se não estiver logado, manda pro index
  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = redirectTo;
  });
}

export function bindLogout(buttonId = "btnSair", redirectTo = "index.html") {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      window.location.href = redirectTo;
    } catch (err) {
      console.error("Erro ao sair:", err);
      alert("Não foi possível sair. Veja o console.");
    }
  });
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function onUser(callback) {
  return onAuthStateChanged(auth, callback);
}
