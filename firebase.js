import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const statusEl = document.getElementById("status");
const btn = document.getElementById("btnLogin");

function setStatus(msg, type = "") {
  statusEl.className = "msg " + type;
  statusEl.innerText = msg;
  console.log(msg);
}

// 🔥 Firebase config (sua)
const firebaseConfig = {
  apiKey: "AIzaSyBMr2MIbnPw7k3W6WVmWwY-Pa3VgG0z1qk",
  authDomain: "sistema-dot.firebaseapp.com",
  projectId: "sistema-dot",
  storageBucket: "sistema-dot.appspot.com",
  messagingSenderId: "1003611331429",
  appId: "1:1003611331429:web:2b55b32379b447e3059f8c"
};

setStatus("JS carregado. Inicializando Firebase…", "ok");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

provider.setCustomParameters({ prompt: "select_account" });

// 👉 Trata retorno do redirect
getRedirectResult(auth).catch(e => {
  console.error(e);
  setStatus("Erro no redirect: " + e.code, "err");
});

// 👉 Clique no botão
btn.addEventListener("click", async () => {
  alert("Clique detectado ✅ Abrindo login do Google");

  try {
    setStatus("Tentando login (popup)…", "ok");
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.warn("Popup falhou, tentando redirect", e.code);
    setStatus("Popup bloqueado. Usando redirect…", "ok");
    await signInWithRedirect(auth, provider);
  }
});

// 👉 Detecta login
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  setStatus("Logado: " + user.email, "ok");

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      nome: user.displayName || "",
      email: user.email,
      role: "dot",
      criadoEm: new Date().toISOString()
    });
  }

  setStatus("Acesso liberado. Redirecionando…", "ok");
  window.location.href = "dashboard.html";
});
