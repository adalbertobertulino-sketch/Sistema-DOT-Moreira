// auth.js
import { auth, provider } from "./firebase.js";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
  console.log("[STATUS]", msg);
}

// 1) Se voltou de redirect, tenta concluir aqui
getRedirectResult(auth)
  .then((result) => {
    if (result && result.user) {
      setStatus("Login concluído (redirect). Indo para o painel...");
      window.location.href = "dashboard.html";
    }
  })
  .catch((err) => {
    console.error("Redirect error:", err);
    setStatus("Erro no redirect: " + (err?.code || err?.message || err));
  });

// 2) Se já está logado, manda para o dashboard
onAuthStateChanged(auth, (user) => {
  if (user) {
    setStatus("Logado como " + (user.email || user.uid) + ". Indo para o painel...");
    window.location.href = "dashboard.html";
  } else {
    setStatus("Aguardando login...");
  }
});

// 3) Clique do botão
const btn = document.getElementById("btnLogin");
if (!btn) {
  console.warn("Não achei #btnLogin no HTML.");
} else {
  btn.addEventListener("click", async () => {
    setStatus("Abrindo login do Google (popup)...");
    try {
      await signInWithPopup(auth, provider);
      // se deu certo, o onAuthStateChanged vai redirecionar
    } catch (e) {
      console.error("Popup error:", e);

      // popup bloqueado? cai no redirect
      const code = e?.code || "";
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        setStatus("Popup bloqueado/fechado. Tentando redirect...");
        try {
          await signInWithRedirect(auth, provider);
        } catch (e2) {
          console.error("Redirect start error:", e2);
          setStatus("Erro ao iniciar redirect: " + (e2?.code || e2?.message || e2));
        }
      } else {
        setStatus("Erro no login: " + (e?.code || e?.message || e));
      }
    }
  });
}
