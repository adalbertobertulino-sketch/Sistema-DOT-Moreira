// dashboard.js (COMPLETO)
import { auth, watchAuth, getMyProfile, logout } from "./firebase.js";

const elNome = document.getElementById("nome");
const elEmail = document.getElementById("email");
const elUid = document.getElementById("uid");
const elRoles = document.getElementById("roles");
const elTurmas = document.getElementById("turmas");
const elStatus = document.getElementById("status");
const btnSair = document.getElementById("btnSair");

function setStatus(msg, kind="info") {
  elStatus.textContent = msg;
  elStatus.className = `status ${kind}`;
}

btnSair?.addEventListener("click", async () => {
  await logout();
  window.location.href = "./index.html";
});

watchAuth(async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  const profile = await getMyProfile();
  if (!profile) {
    setStatus("Perfil não encontrado. Tente sair e entrar novamente.", "err");
    return;
  }

  elNome.textContent = profile.nome || user.displayName || "";
  elEmail.textContent = profile.email || user.email || "";
  elUid.textContent = user.uid;

  const roles = Array.isArray(profile.roles) ? profile.roles : [];
  elRoles.textContent = roles.length ? roles.join(", ") : "(sem perfil)";

  const turmas = Array.isArray(profile.turmasPermitidas) ? profile.turmasPermitidas : [];
  elTurmas.textContent = turmas.length ? turmas.join(", ") : "(nenhuma)";

  setStatus("Perfil carregado com sucesso.", "ok");
});
