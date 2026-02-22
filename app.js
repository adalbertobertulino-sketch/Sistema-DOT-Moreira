// app.js (MÓDULO)
// ✅ Controla login + redireciona e registra usuário/roles

import {
  auth,
  signInGoogleSmart,
  handleRedirectIfAny,
  ensureUserProfile,
  onAuthStateChanged,
} from "./firebase.js";

function $(id) {
  return document.getElementById(id);
}

function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg;
}

async function main() {
  setStatus("Carregando...");

  // tenta pegar retorno de redirect (se aconteceu)
  try {
    await handleRedirectIfAny();
  } catch (e) {
    console.error(e);
    setStatus("Erro no redirect: " + (e?.code || e?.message || e));
  }

  const btn = $("btnLogin");
  if (btn) {
    btn.addEventListener("click", async () => {
      setStatus("Tentando login...");
      try {
        await signInGoogleSmart();
        // se foi popup, o onAuthStateChanged vai detectar e redirecionar
        // se foi redirect, a página vai recarregar e cair no handleRedirectIfAny
      } catch (e) {
        console.error(e);
        setStatus("Erro no login: " + (e?.code || e?.message || e));
        alert("Erro no login: " + (e?.code || e?.message || e));
      }
    });
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setStatus("Aguardando login...");
      return;
    }

    setStatus("Logado ✅ " + (user.email || "") + " | preparando perfil...");

    try {
      await ensureUserProfile(user);
      setStatus("OK ✅ indo para dashboard...");
      window.location.href = "dashboard.html";
    } catch (e) {
      console.error(e);
      setStatus("Erro ao preparar perfil: " + (e?.code || e?.message || e));
      alert("Erro ao preparar perfil: " + (e?.code || e?.message || e));
    }
  });
}

main();
