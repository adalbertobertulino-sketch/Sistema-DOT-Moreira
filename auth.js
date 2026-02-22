// auth.js
import { auth, db, provider } from "./firebase.js";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ✅ Coloque aqui os UIDs que serão ADMIN (você + mais 3 depois)
// O seu UID (pela sua foto): RYyuu... (cole ele completo aqui)
const ADMIN_UIDS = new Set([
  "RYyuuue4t76fkDIwCJ5JgILfPoIW2", // <-- confirme se é exatamente esse (copie do dashboard)
  // "UID_DO_ADMIN_2",
  // "UID_DO_ADMIN_3",
  // "UID_DO_ADMIN_4",
]);

function $(id) {
  return document.getElementById(id);
}

function setStatus(msg, kind = "") {
  const el = $("status");
  if (!el) return;
  el.textContent = msg;
  el.className = kind ? `msg ${kind}` : "msg";
  console.log(msg);
}

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  // roles sempre como ARRAY
  let roles = ["dot"];
  if (ADMIN_UIDS.has(user.uid)) roles = ["admin", "dot"];

  if (!snap.exists()) {
    await setDoc(ref, {
      nome: user.displayName || "",
      email: user.email || "",
      roles,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    return roles;
  }

  // Se existe, garante que roles é array e contém dot
  const data = snap.data() || {};
  let currentRoles = Array.isArray(data.roles) ? data.roles : [];

  if (!currentRoles.includes("dot")) currentRoles.push("dot");
  if (ADMIN_UIDS.has(user.uid) && !currentRoles.includes("admin")) currentRoles.push("admin");

  // Atualiza doc (merge)
  await setDoc(
    ref,
    {
      nome: user.displayName || data.nome || "",
      email: user.email || data.email || "",
      roles: currentRoles,
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  return currentRoles;
}

async function doLogin() {
  setStatus("Tentando login (popup)...", "info");
  try {
    const res = await signInWithPopup(auth, provider);
    setStatus("Login OK ✅ " + (res.user?.email || ""), "ok");
    return;
  } catch (e) {
    console.warn("Popup falhou:", e);

    // Se popup falhar, tenta redirect
    setStatus("Popup bloqueado. Tentando redirect...", "info");
    try {
      await signInWithRedirect(auth, provider);
    } catch (e2) {
      console.error("Redirect falhou:", e2);
      setStatus("Erro no login: " + (e2.code || e2.message), "err");
      alert("Erro no login: " + (e2.code || e2.message));
    }
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const btn = $("btnLogin");
  if (btn) btn.addEventListener("click", doLogin);

  // Processa retorno do redirect (se tiver)
  try {
    const rr = await getRedirectResult(auth);
    if (rr?.user) {
      setStatus("Voltou do Google ✅ " + (rr.user.email || ""), "ok");
    }
  } catch (e) {
    console.error("getRedirectResult erro:", e);
    setStatus("Erro no redirect: " + (e.code || e.message), "err");
  }

  // Estado de autenticação
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setStatus("Aguardando login...", "info");
      return;
    }

    try {
      const roles = await ensureUserDoc(user);
      setStatus("Logado ✅ " + (user.email || "") + " | roles: " + roles.join(", "), "ok");

      // Vai para o dashboard
      if (location.pathname.endsWith("index.html") || location.pathname.endsWith("/")) {
        location.href = "./dashboard.html";
      }
    } catch (e) {
      console.error("Erro criando user doc:", e);
      setStatus("Erro criando perfil no Firestore: " + (e.code || e.message), "err");
      alert("Erro criando perfil: " + (e.code || e.message));
    }
  });
});
