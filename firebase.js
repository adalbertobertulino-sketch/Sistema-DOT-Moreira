// firebase.js (CDN - Firebase v10+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️ Use exatamente a config do seu projeto (a sua está aqui embaixo)
const firebaseConfig = {
  apiKey: "AIzaSyBMr2MIbnPw7k3W6WVmWwY-Pa3VgG0z1qk",
  authDomain: "sistema-dot.firebaseapp.com",
  projectId: "sistema-dot",
  storageBucket: "sistema-dot.appspot.com", // ✅ este é o padrão correto do Storage
  messagingSenderId: "1003611331429",
  appId: "1:1003611331429:web:2b55b32379b447e3059f8c",
  measurementId: "G-FS1CBVNFEG",
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// força seletor de conta sempre (evita login preso em uma conta antiga)
provider.setCustomParameters({ prompt: "select_account" });

export const db = getFirestore(app);
export { serverTimestamp };
