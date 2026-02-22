// auth.js (COMPLETO)
import { auth, watchAuth, handleRedirect, loginGoogleSmart, ensureUserProfile } from "./firebase.js";

const btn = document.getElementById("btnLogin");
const statusEl = document.getElementById("status");

function setStatus(msg, kind = "") {
  statusEl.textContent = msg;
  statusEl.className = `status ${kind}`.trim();
}

async function goDashboard() {
  window.location.href = "./dashboard.html";
}

btn?.addEventListener("click", async () => {
  setStatus("Tentando login…", "info");
  try {
    await loginGoogleSmart();
    // se for popup, onAuthStateChanged vai detectar
    // se for redirect, a página vai recarregar e handleRedirect cuidará
  } catch (e) {
    console.error(e);
    setStatus(`Erro no login: ${e?.code || e?.message || e}`, "err");
    alert(`Erro no login: ${e?.code || e?.message || e}`);
  }
});

(async () => {
  setStatus("Verificando retorno do Google…", "info");
  await handleRedirect();

  watchAuth(async (user) => {
    if (!user) {
      setStatus("Aguardando login…", "info");
      return;
    }
    setStatus("Logado. Preparando perfil…", "ok");
    await ensureUserProfile(user);
    await goDashboard();
  });
})();
