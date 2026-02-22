import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const elNome = document.getElementById("nome");
const elEmail = document.getElementById("email");
const elUid = document.getElementById("uid");
const elRoles = document.getElementById("roles");
const elTurmas = document.getElementById("turmas");
const btnSair = document.getElementById("btnSair");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    elEmail.textContent = user.email;
    elUid.textContent = user.uid;

    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      elNome.textContent = "Usuário sem perfil cadastrado";
      elRoles.textContent = "-";
      elTurmas.textContent = "-";
      return;
    }

    const data = snap.data();

    elNome.textContent = data.nome || "-";
    elRoles.textContent = Array.isArray(data.roles)
      ? data.roles.join(", ")
      : data.role || "-";

    elTurmas.textContent = Array.isArray(data.turmasPermitidas)
      ? data.turmasPermitidas.join(", ")
      : "-";

  } catch (e) {
    console.error("Erro ao carregar perfil:", e);
    elNome.textContent = "Erro ao carregar perfil";
  }
});

btnSair.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
