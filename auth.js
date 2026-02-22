// auth.js
import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const btn = document.getElementById("btnLogin");
const statusEl = document.getElementById("status");

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

const provider = new GoogleAuthProvider();

async function doPopup() {
  setStatus("Abrindo pop-up...");
  await signInWithPopup(auth, provider);
}

async function doRedirect() {
  setStatus("Redirecionando...");
  await signInWithRedirect(auth, provider);
}

async function handleRedirect() {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      // chegou do redirect e já logou
      window.location.href = "./dashboard.html";
    }
  } catch (e) {
    console.error(e);
    setStatus("Erro no login: " + (e?.message || e));
  }
}

if (btn) {
  btn.addEventListener("click", async () => {
    setStatus("Aguardando login...");
    try {
      // tenta pop-up
      await doPopup();
      window.location.href = "./dashboard.html";
    } catch (e) {
      console.warn("Popup falhou, tentando redirect", e);
      try {
        await doRedirect();
      } catch (e2) {
        console.error(e2);
        setStatus("Erro no login: " + (e2?.message || e2));
      }
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    setStatus("Logado. Indo para o painel...");
    window.location.href = "./dashboard.html";
  }
});

handleRedirect();
