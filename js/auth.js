// js/auth.js
import { auth, provider } from "./firebase.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

const btnLogin = document.getElementById("btnLogin");
if (btnLogin) {
  btnLogin.addEventListener("click", async () => {
    try {
      setStatus("Abrindo login...");
      await signInWithPopup(auth, provider);
      setStatus("Logado. Redirecionando...");
      window.location.href = "./dashboard.html";
    } catch (e) {
      console.error("Erro no login:", e);
      setStatus(`Erro no login: ${e?.code || e?.message || e}`);
    }
  });
}

const btnSair = document.getElementById("btnSair");
if (btnSair) {
  btnSair.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "./index.html";
    } catch (e) {
      console.error("Erro ao sair:", e);
      setStatus(`Erro ao sair: ${e?.code || e?.message || e}`);
    }
  });
}

onAuthStateChanged(auth, (user) => {
  const elUser = document.getElementById("userInfo");
  if (elUser) {
    elUser.textContent = user
      ? `${user.displayName} (${user.email})`
      : "Deslogado";
  }
});
