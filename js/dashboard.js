// js/dashboard.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import { auth, db } from "./firebase.js";
import { requireAuth, bindLogout } from "./auth.js";

requireAuth("index.html");
bindLogout("btnSair", "index.html");

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
}

function setStatus(msg, kind = "") {
  const el = document.getElementById("dashStatus");
  if (!el) return;
  el.textContent = msg || "";
  el.className = "status " + (kind || "");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  setText("uidUser", user.uid);
  setText("emailUser", user.email || "");
  setText("nomeUser", user.displayName || "");

  setStatus("Carregando perfil do Firestore...", "warn");

  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // Se não existir, mostra pelo menos o básico
      setText("rolesUser", "(sem documento em users)");
      setText("turmasUser", "(vazio)");
      localStorage.setItem("turmasPermitidas", JSON.stringify([]));
      setStatus("Usuário logado, mas sem perfil em /users/{uid}.", "warn");
      return;
    }

    const data = snap.data();

    const roles = Array.isArray(data.roles) ? data.roles
      : (data.role ? [data.role] : []);

    const turmas = Array.isArray(data.turmasPermitidas) ? data.turmasPermitidas
      : (Array.isArray(data.turmas) ? data.turmas : []);

    setText("nomeUser", data.nome || user.displayName || "");
    setText("rolesUser", roles.length ? roles.join(", ") : "(sem roles)");
    setText("turmasUser", turmas.length ? turmas.join(", ") : "(sem turmas)");

    // guarda turmas para usar na frequência
    localStorage.setItem("turmasPermitidas", JSON.stringify(turmas));

    setStatus("Perfil carregado com sucesso.", "ok");
  } catch (e) {
    console.error(e);
    setStatus("Erro ao carregar perfil: " + (e.code || e.message || e), "bad");
  }
});
