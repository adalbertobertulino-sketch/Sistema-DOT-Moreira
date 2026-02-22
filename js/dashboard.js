// dashboard.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const elNome = document.getElementById("nome");
const elEmail = document.getElementById("email");
const elUid = document.getElementById("uid");
const elRoles = document.getElementById("roles");
const elTurmas = document.getElementById("turmasPermitidas");
const elStatus = document.getElementById("status");
const btnSair = document.getElementById("btnSair");

function setStatus(msg, ok = true) {
  if (!elStatus) return;
  elStatus.textContent = msg;
  elStatus.classList.toggle("error", !ok);
}

btnSair?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  // Dados básicos do Google
  elNome.textContent = user.displayName || "(sem nome)";
  elEmail.textContent = user.email || "(sem email)";
  elUid.textContent = user.uid;

  setStatus("Carregando perfil do Firestore...");

  try {
    // Lê o perfil em users/{uid}
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // Se não existir, ainda mostra algo
      elRoles.textContent = "(sem perfil no Firestore)";
      elTurmas.textContent = "(nenhuma)";
      setStatus("Perfil não encontrado no Firestore (coleção users).", false);
      return;
    }

    const data = snap.data();

    // roles pode ser array ou string
    const roles = Array.isArray(data.roles)
      ? data.roles
      : (typeof data.role === "string" ? [data.role] : (typeof data.roles === "string" ? [data.roles] : []));

    elRoles.textContent = roles.length ? roles.join(", ") : "(nenhum)";

    // turmasPermitidas deve ser array (ex: ["2A"])
    const turmas = Array.isArray(data.turmasPermitidas) ? data.turmasPermitidas : [];
    elTurmas.textContent = turmas.length ? turmas.join(", ") : "(nenhuma)";

    setStatus("Perfil carregado com sucesso.");
  } catch (e) {
    console.error(e);
    setStatus("Erro ao carregar perfil: " + (e?.message || e), false);
  }
});
