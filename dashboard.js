// dashboard.js — PERFIL + ROLES (VERSÃO SEGURA)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔐 Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBMr2MIbnPw7k3W6WVmWwY-Pa3VgG0z1qk",
  authDomain: "sistema-dot.firebaseapp.com",
  projectId: "sistema-dot",
  storageBucket: "sistema-dot.appspot.com",
  messagingSenderId: "1003611331429",
  appId: "1:1003611331429:web:2b55b32379b447e3059f8c"
};

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Elementos da tela
const elNome = document.getElementById("nome");
const elEmail = document.getElementById("email");
const elUid = document.getElementById("uid");
const elRoles = document.getElementById("roles");
const btnSair = document.getElementById("btnSair");

// Segurança
console.log("dashboard.js carregado");

// Controle de sessão
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  // 🔹 Se NÃO existir, cria usuário automaticamente
  if (!snap.exists()) {
    await setDoc(ref, {
      nome: user.displayName || "",
      email: user.email,
      roles: ["dot"], // padrão
      criadoEm: new Date().toISOString()
    });
  }

  const dados = (await getDoc(ref)).data();

  // Preenche tela
  elNome.innerText = dados.nome;
  elEmail.innerText = dados.email;
  elUid.innerText = user.uid;
  elRoles.innerText = dados.roles.join(", ");
});

// Logout
btnSair.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
