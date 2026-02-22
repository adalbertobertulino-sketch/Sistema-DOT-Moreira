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

function setStatus(msg, kind = "") {
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

setStatus("JS carregou. Inicializando Firebase…", "ok");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// (opcional) força seletor de conta sempre aparecer
provider.setCustomParameters({ prompt: "select_account" });

// ✅ Trata retorno do redirect (quando voltar do Google)
getRedirectResult(auth)
  .then((res) => {
    if (res?.user) {
      setStatus("Voltou do Google ✅ " + res.user.email, "ok");
    } else {
      setStatus("Pronto. Clique em 'Entrar com Google'.", "");
    }
  })
  .catch((e) => {
    console.error(e);
    alert("ERRO Firebase (redirect): " + (e?.code || e?.message || e));
    setStatus("ERRO no redirect: " + (e?.code || e?.message || e), "err");
  });

// ✅ Clique do botão
btn.addEventListener("click", async () => {
  alert("Clique detectado ✅ Vou abrir o login do Google.");

  setStatus("Tentando login com POPUP…", "ok");

  try {
    const result = await signInWithPopup(auth, provider);
    setStatus("Login OK ✅ " + result.user.email, "ok");
  } catch (e) {
    console.error(e);

    // Se popup foi bloqueado ou não permitido, cai no redirect
    const popupBlocked =
      e?.code === "auth/popup-blocked" ||
      e?.code === "auth/popup-closed-by-user" ||
      e?.code === "auth/cancelled-popup-request";

    if (popupBlocked) {
      alert("Popup bloqueado. Vou tentar login por REDIRECT agora.");
      setStatus("Popup bloqueado. Tentando REDIRECT…", "ok");
      try {
        await signInWithRedirect(auth, provider);
      } catch (e2) {
        console.error(e2);
        alert("Erro no redirect: " + (e2?.code || e2?.message || e2));
        setStatus("Erro no redirect: " + (e2?.code || e2?.message || e2), "err");
      }
      return;
    }

    // Qualquer outro erro (inclui unauthorized-domain)
    alert("Erro no login: " + (e?.code || e?.message || e));
    setStatus("Erro no login: " + (e?.code || e?.message || e), "err");
  }
});

// ✅ Detecta login e cria usuário se não existir
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

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
