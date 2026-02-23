// /js/auth.js

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import { auth, logout } from "./firebase.js";

// ✅ Botão "Entrar com Google"
export function bindGoogleLogin(buttonId, statusId, redirectTo) {
  const btn = document.getElementById(buttonId);
  const statusEl = document.getElementById(statusId);

  if (!btn) {
    console.error(`Botão #${buttonId} não encontrado.`);
    if (statusEl) statusEl.textContent = `Erro: botão #${buttonId} não existe no HTML.`;
    return;
  }

  btn.addEventListener("click", async () => {
    try {
      if (statusEl) statusEl.textContent = "Abrindo login Google...";
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      if (statusEl) statusEl.textContent = "Login OK! Redirecionando...";
      window.location.href = redirectTo;
    } catch (e) {
      console.error("Erro login:", e);
      if (statusEl) statusEl.textContent = `Erro: ${e.code || e.message}`;
      alert(`Erro no login: ${e.code || e.message}`);
    }
  });
}

// ✅ Protege página (se não tiver logado -> manda para index)
export function requireAuth(redirectTo = "index.html") {
  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = redirectTo;
  });
}

// ✅ Botão "Sair"
export function bindLogout(buttonId, redirectTo = "index.html") {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  btn.addEventListener("click", async () => {
    await logout();
    window.location.href = redirectTo;
  });
}
