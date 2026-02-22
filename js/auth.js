// js/auth.js
import { auth, provider } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

function setStatus(msg, kind = "") {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = msg || "";
  el.className = "status " + (kind || "");
}

async function doLogin() {
  try {
    setStatus("Abrindo login do Google...", "warn");
    await signInWithPopup(auth, provider);
    // Se logou, o onAuthStateChanged vai redirecionar
  } catch (e) {
    console.error(e);
    setStatus("Erro no login: " + (e?.message || e), "bad");
  }
}

async function doLogout() {
  try {
    await signOut(auth);
    window.location.href = "./index.html";
  } catch (e) {
    console.error(e);
    alert("Falha ao sair: " + (e?.message || e));
  }
}

// --- LOGIN PAGE ---
const btnLogin = document.getElementById("btnLogin");
if (btnLogin) {
  btnLogin.addEventListener("click", doLogin);

  onAuthStateChanged(auth, (user) => {
    if (user) {
      setStatus("Login OK. Redirecionando...", "ok");
      window.location.href = "./dashboard.html";
    } else {
      setStatus("");
    }
  });
}

// --- OUTRAS PÁGINAS (logout) ---
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
  btnLogout.addEventListener("click", doLogout);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "./index.html";
    }
  });
}
