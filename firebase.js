// firebase.js (usa redirect para funcionar bem no Brave/tablet)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/** ✅ SUA CONFIG (a que você mandou) */
const firebaseConfig = {
  apiKey: "AIzaSyBMr2MIbnPw7k3W6WVmWwY-Pa3VgG0z1qk",
  authDomain: "sistema-dot.firebaseapp.com",
  projectId: "sistema-dot",
  storageBucket: "sistema-dot.firebasestorage.app",
  messagingSenderId: "1003611331429",
  appId: "1:1003611331429:web:2b55b32379b447e3059f8c",
  measurementId: "G-FS1CBVNFEG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

function $(id){ return document.getElementById(id); }
function setStatus(msg, isErr=false){
  const el = $("status");
  if(!el) return;
  el.textContent = msg || "";
  el.className = "status" + (isErr ? " err" : "");
}

async function ensureUserDoc(user){
  // cria/atualiza users/{uid}
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  const payloadBase = {
    uid: user.uid,
    email: user.email || "",
    name: user.displayName || "",
    updatedAt: serverTimestamp()
  };

  if(!snap.exists()){
    // primeira vez: cria como "dot" por padrão
    await setDoc(ref, {
      ...payloadBase,
      role: "dot",
      createdAt: serverTimestamp()
    }, { merge: true });
  } else {
    // atualiza nome/email sem mexer em role
    await setDoc(ref, payloadBase, { merge: true });
  }
}

async function handleAfterRedirect(){
  // Se voltou do Google, pega o resultado (ou null se não veio de redirect)
  try {
    const res = await getRedirectResult(auth);
    if(res && res.user){
      setStatus("Login concluído. Preparando acesso...");
      await ensureUserDoc(res.user);
      // manda para o dashboard
      window.location.href = "./dashboard.html?v=" + Date.now();
      return;
    }
  } catch (e) {
    setStatus("Erro no retorno do login: " + (e?.code || e?.message), true);
  }

  // Se já estiver logado (sessão salva), vai direto
  onAuthStateChanged(auth, async (user) => {
    if(user){
      setStatus("Sessão encontrada. Preparando acesso...");
      try{
        await ensureUserDoc(user);
        window.location.href = "./dashboard.html?v=" + Date.now();
      }catch(e){
        setStatus("Erro ao preparar usuário: " + (e?.code || e?.message), true);
      }
    } else {
      setStatus("");
    }
  });
}

function bindLoginButton(){
  const btn = $("btnGoogle");
  if(!btn) return;

  btn.addEventListener("click", () => {
    setStatus("Abrindo login do Google...");
    signInWithRedirect(auth, provider);
  });
}

// roda tudo
bindLoginButton();
handleAfterRedirect();
