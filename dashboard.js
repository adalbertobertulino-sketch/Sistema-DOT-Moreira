// dashboard.js — PROTEGE A PÁGINA

import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const nomeEl = document.getElementById("nome");
const emailEl = document.getElementById("email");
const perfilEl = document.getElementById("perfil");
const btnSair = document.getElementById("btnSair");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert("Usuário não cadastrado.");
    await signOut(auth);
    return;
  }

  const data = snap.data();

  nomeEl.innerText = data.nome;
  emailEl.innerText = data.email;
  perfilEl.innerText = data.role;
});

btnSair?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
