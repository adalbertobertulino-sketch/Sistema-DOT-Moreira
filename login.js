// login.js — LOGIN GOOGLE MINIMAL FUNCIONAL

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 🔐 CONFIGURAÇÃO FIREBASE (CORRETA)
const firebaseConfig = {
  apiKey: "AIzaSyBMr2MIbnPw7k3W6WVmWwY-Pa3VgG0z1qk",
  authDomain: "sistema-dot.firebaseapp.com",
  projectId: "sistema-dot",
  storageBucket: "sistema-dot.appspot.com",
  messagingSenderId: "1003611331429",
  appId: "1:1003611331429:web:2b55b32379b447e3059f8c"
};

// Inicializa
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Elementos
const btn = document.getElementById("btnLogin");
const status = document.getElementById("status");

// Segurança: confirma que o JS carregou
console.log("login.js carregado");

// Clique no botão
btn.addEventListener("click", async () => {
  status.innerText = "Abrindo login do Google…";
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error(e);
    status.innerText = "Erro no login: " + e.code;
  }
});

// Quando logar
onAuthStateChanged(auth, (user) => {
  if (user) {
    status.innerText = "Logado! Redirecionando…";
    window.location.href = "dashboard.html";
  }
});
