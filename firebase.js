import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
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

/* 🔥 CONFIG FIREBASE */
const firebaseConfig = {
  apiKey: "AIzaSyBMr2MIbnPw7k3W6WVmWwY-Pa3VgG0z1qk",
  authDomain: "sistema-dot.firebaseapp.com",
  projectId: "sistema-dot",
  storageBucket: "sistema-dot.appspot.com",
  messagingSenderId: "1003611331429",
  appId: "1:1003611331429:web:2b55b32379b447e3059f8c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

/* 👆 FUNÇÃO DO BOTÃO */
window.loginGoogle = () => {
  document.getElementById("status").innerText = "Redirecionando para o Google…";
  signInWithRedirect(auth, provider);
};

/* 🔁 TRATA O RETORNO DO REDIRECT */
getRedirectResult(auth).catch(() => {});

/* 👤 MONITORA LOGIN */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const status = document.getElementById("status");
  status.innerText = "Login confirmado. Verificando perfil…";

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Primeiro acesso → cria como DOT
    await setDoc(ref, {
      nome: user.displayName,
      email: user.email,
      role: "dot",
      criadoEm: new Date()
    });
  }

  // REDIRECIONA
  window.location.href = "dashboard.html";
});
