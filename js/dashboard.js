// js/dashboard.js
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
}
function setStatus(msg, kind="") {
  const el = document.getElementById("statusDash");
  if (!el) return;
  el.textContent = msg || "";
  el.className = "status " + kind;
}

async function carregarPerfil(uid, email, displayName) {
  // Busca o doc do usuário em: users/{uid}
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  // Valores padrão (caso não exista doc)
  let roles = ["prof"];
  let turmasPermitidas = [];

  if (snap.exists()) {
    const data = snap.data();
    roles = Array.isArray(data.roles) ? data.roles : (data.role ? [data.role] : roles);
    turmasPermitidas = Array.isArray(data.turmasPermitidas) ? data.turmasPermitidas : [];
  }

  setText("nome", displayName || "Sem nome");
  setText("email", email || "Sem email");
  setText("uid", uid);
  setText("perfis", roles.join(", "));
  setText("turmas", turmasPermitidas.length ? turmasPermitidas.join(", ") : "(vazio)");

  // Guardar turmas permitidas para usar na página de frequência
  localStorage.setItem("turmasPermitidas", JSON.stringify(turmasPermitidas));

  setStatus("Perfil carregado.", "ok");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }
  try {
    setStatus("Carregando perfil...", "warn");
    await carregarPerfil(user.uid, user.email, user.displayName);
  } catch (e) {
    console.error(e);
    setStatus("Falha ao carregar perfil: " + (e?.message || e), "bad");
  }
});
