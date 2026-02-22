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

const statusEl = document.getElementById("status");
const btn = document.getElementById("btnLogin");

function setStatus(msg, kind="") {
  statusEl.className = "msg " + (kind || "");
  statusEl.innerText = msg;
  console.log(msg);
}

// 🔥 CONFIG FIREBASE (a sua)
const firebaseConfig = {
  apiKey: "AIzaSyBMr2MIbnPw7k3W6WVmWwY-Pa3VgG0z1qk",
  authDomain: "sistema-dot.firebaseapp.com",
  projectId: "sistema-dot",
  storageBucket: "sistema-dot.appspot.com",
  messagingSenderId: "1003611331429",
  appId: "1:1003611331429:web:2b55b32379b447e3059f8c"
};

setStatus("JS carregou. Inicializando Firebase…");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ✅ Clique do botão (debug forte)
btn.addEventListener("click", async () => {
  alert("Clique detectado ✅ Vou tentar abrir o login do Google agora.");
  setStatus("Clique detectado ✅ Abrindo login do Google…", "ok");

  try {
    await signInWithRedirect(auth, provider);
  } catch (e) {
    console.error(e);
    alert("Erro no login: " + (e?.code || e?.message || e));
    setStatus("Erro ao iniciar login: " + (e?.code || e?.message || e), "err");
  }
});

// ✅ Trata retorno do redirect (quando voltar do Google)
getRedirectResult(auth)
  .then((res) => {
    if (res?.user) {
      setStatus("Voltou do Google ✅ Usuário: " + res.user.email, "ok");
    } else {
      setStatus("Aguardando: se você acabou de voltar do Google, o onAuthStateChanged vai detectar.", "");
    }
  })
  .catch((e) => {
    // Aqui costuma cair o "auth/unauthorized-domain"
    console.error(e);
    setStatus("ERRO no retorno do Google: " + (e?.code || e?.message || e), "err");
    alert("ERRO Firebase (redirect): " + (e?.code || e?.message || e));
  });

// ✅ Detecta login e cria usuário se não existir
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("Sem usuário logado ainda.");
    return;
  }

  setStatus("Logado ✅ " + user.email + " — checando Firestore…", "ok");

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    setStatus("Primeiro acesso: criando usuário no Firestore…", "ok");
    await setDoc(ref, {
      nome: user.displayName || "",
      email: user.email || "",
      role: "dot",
      criadoEm: new Date().toISOString()
    });
  }

  setStatus("OK ✅ Indo para dashboard.html…", "ok");
  window.location.href = "dashboard.html";
});
