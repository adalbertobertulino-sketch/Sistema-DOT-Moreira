// js/auth.js
import { auth, provider } from "./firebase.js";
import { signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const btnLogin = document.getElementById("btnLogin");
const status = document.getElementById("status");

function setStatus(msg) {
  if (status) status.textContent = msg;
}

btnLogin?.addEventListener("click", async () => {
  setStatus("Abrindo login...");
  try {
    await signInWithPopup(auth, provider);
    setStatus("Logado! Indo para o painel...");
    window.location.href = "./dashboard.html";
  } catch (e) {
    console.error(e);
    setStatus("Erro no login: " + (e?.message || e));
  }
});

onAuthStateChanged(auth, (user) => {
  if (user && (location.pathname.endsWith("/") || location.pathname.endsWith("/index.html"))) {
    window.location.href = "./dashboard.html";
  }
});
