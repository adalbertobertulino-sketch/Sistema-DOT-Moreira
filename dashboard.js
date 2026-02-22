import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id) { return document.getElementById(id); }

function setStatus(msg, kind = "info") {
  const el = $("status");
  if (!el) return;
  el.textContent = msg;
  el.className = `msg ${kind}`;
  console.log(msg);
}

window.addEventListener("DOMContentLoaded", () => {
  $("btnSair")?.addEventListener("click", async () => {
    await signOut(auth);
    location.href = "./index.html";
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.href = "./index.html";
      return;
    }

    try {
      $("nome").textContent = user.displayName || "";
      $("email").textContent = user.email || "";
      $("uid").textContent = user.uid || "";

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setStatus("Perfil não encontrado em users/" + user.uid, "err");
        $("roles").textContent = "N/A";
        return;
      }

      const data = snap.data() || {};
      const roles = Array.isArray(data.roles) ? data.roles : [];
      $("roles").textContent = roles.join(", ") || "sem roles";

      setStatus("Perfil carregado com sucesso.", "ok");
    } catch (e) {
      console.error(e);
      setStatus("Erro carregando perfil: " + (e.code || e.message), "err");
    }
  });
});
