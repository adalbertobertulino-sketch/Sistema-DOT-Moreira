// dashboard.js (APAGUE TUDO e COLE)

import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const msgEl = $("msg");
function showMsg(text, type = "ok") {
  msgEl.style.display = "block";
  msgEl.className = "msg " + (type === "ok" ? "ok" : "err");
  msgEl.textContent = text;
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

async function loadUserRoles(uid) {
  // users/{uid} -> { roles: ["admin","dot"] } ou { role: "dot" }
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return ["dot"]; // fallback
  const data = snap.data() || {};

  if (Array.isArray(data.roles) && data.roles.length) return data.roles;
  if (data.role) return [data.role];

  return ["dot"];
}

async function sair() {
  try {
    await signOut(auth);
    window.location.href = "./index.html";
  } catch (e) {
    console.error(e);
    showMsg("Erro ao sair: " + (e?.message || e), "err");
  }
}

$("btnSair").addEventListener("click", sair);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // sem login -> volta pro index
    window.location.href = "./index.html";
    return;
  }

  try {
    setText("status", "Logado ✅ carregando perfil...");

    setText("nome", user.displayName || "(sem nome)");
    setText("email", user.email || "(sem email)");
    setText("uid", user.uid);

    const roles = await loadUserRoles(user.uid);
    setText("roles", roles.join(", "));
    $("perfilPill").textContent = "Perfil: " + roles.join(", ");

    setText("status", "Perfil carregado com sucesso ✅");

    // (deixa os contadores como "—" por enquanto)
    setText("countAlunos", "—");
    setText("countTurmas", "—");
    setText("countFreqHoje", "—");

  } catch (e) {
    console.error(e);
    $("perfilPill").textContent = "Perfil: erro";
    setText("status", "Erro ao carregar perfil.");
    showMsg("Erro: " + (e?.message || e), "err");
  }
});
