// auth.js
import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const btnLogin = document.getElementById("btnLogin");
const statusEl = document.getElementById("status");

const provider = new GoogleAuthProvider();

// clique no botão
if (btnLogin) {
  btnLogin.addEventListener("click", async () => {
    try {
      statusEl.textContent = "Abrindo login do Google...";
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      statusEl.textContent = `Logado: ${user.displayName} (${user.email})`;

      // redireciona para dashboard (se existir)
      window.location.href = "./dashboard.html";
    } catch (err) {
      console.error(err);
      statusEl.textContent = `Erro no login: ${err.code || ""} ${err.message || err}`;
    }
  });
}

// se já está logado
onAuthStateChanged(auth, (user) => {
  if (user && statusEl) {
    statusEl.textContent = `Já logado: ${user.displayName} (${user.email})`;
  }
});

// opcional: sair (se existir botão com id btnSair em alguma página)
const btnSair = document.getElementById("btnSair");
if (btnSair) {
  btnSair.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "./index.html";
  });
}
