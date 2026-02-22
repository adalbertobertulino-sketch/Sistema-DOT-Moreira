// js/dashboard.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const elNome = document.getElementById("nome");
const elEmail = document.getElementById("email");
const elUid = document.getElementById("uid");
const elRoles = document.getElementById("roles");
const elTurmas = document.getElementById("turmas");
const elMsg = document.getElementById("msg");
const btnLogout = document.getElementById("btnLogout");

btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

function setMsg(msg, erro=false) {
  if (!elMsg) return;
  elMsg.textContent = msg;
  elMsg.style.color = erro ? "#fecaca" : "#9ca3af";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  elNome.textContent = user.displayName || "—";
  elEmail.textContent = user.email || "—";
  elUid.textContent = user.uid;

  setMsg("Carregando perfil do Firestore...");

  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      elRoles.textContent = "—";
      elTurmas.textContent = "—";
      setMsg(`Não existe users/${user.uid}. Crie esse documento no Firestore (coleção users).`, true);
      return;
    }

    const perfil = snap.data();

    const roles = Array.isArray(perfil.roles)
      ? perfil.roles
      : (perfil.role ? [perfil.role] : []);

    const turmas = Array.isArray(perfil.turmasPermitidas) ? perfil.turmasPermitidas : [];

    elRoles.textContent = roles.length ? roles.join(", ") : "—";
    elTurmas.textContent = turmas.length ? turmas.join(", ") : "—";

    setMsg("Perfil carregado com sucesso ✅");
  } catch (e) {
    console.error(e);
    setMsg("Erro ao carregar perfil: " + (e?.message || e), true);
  }
});
