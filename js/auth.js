import {
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import { auth } from "./firebase.js";

export function bindGoogleLogin(buttonId, statusId, redirectTo) {
  const btn = document.getElementById(buttonId);
  const statusEl = document.getElementById(statusId);

  if (!btn) {
    console.error(`Botão #${buttonId} não encontrado no HTML.`);
    if (statusEl) statusEl.textContent = `Erro: botão #${buttonId} não existe.`;
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
      console.error("Erro no login:", e);
      if (statusEl) statusEl.textContent = `Erro: ${e.code || e.message}`;
      alert(`Erro no login: ${e.code || e.message}`);
    }
  });
}
