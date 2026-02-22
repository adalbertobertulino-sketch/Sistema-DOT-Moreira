// firebase.js (COMPLETO)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ✅ SUA CONFIG AQUI (NÃO TROCAR POR OUTRA)
const firebaseConfig = {
  apiKey: "AIzaSyBMr2MIbnPw7k3W6WVmWwY-Pa3VgG0z1qk",
  authDomain: "sistema-dot.firebaseapp.com",
  projectId: "sistema-dot",
  storageBucket: "sistema-dot.firebasestorage.app",
  messagingSenderId: "1003611331429",
  appId: "1:1003611331429:web:2b55b32379b447e3059f8c",
  measurementId: "G-FS1CBVNFEG"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

// opcional: força seletor sempre
provider.setCustomParameters({ prompt: "select_account" });

export const fb = {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc,
  serverTimestamp, query, where, orderBy, limit, getDocs, onSnapshot
};

export async function ensureUserProfile(user) {
  const ref = fb.doc(db, "users", user.uid);
  const snap = await fb.getDoc(ref);

  // Se não existir, cria com perfil básico (SEM roles/turmas)
  if (!snap.exists()) {
    await fb.setDoc(ref, {
      nome: user.displayName || "",
      email: user.email || "",
      roles: [],              // admin define depois
      turmasPermitidas: [],   // admin define depois
      criadoEm: fb.serverTimestamp(),
      atualizadoEm: fb.serverTimestamp()
    });
  } else {
    // mantém dados atualizados
    await fb.updateDoc(ref, {
      nome: user.displayName || snap.data().nome || "",
      email: user.email || snap.data().email || "",
      atualizadoEm: fb.serverTimestamp()
    });
  }
}

export async function getMyProfile() {
  const u = auth.currentUser;
  if (!u) return null;
  const ref = fb.doc(db, "users", u.uid);
  const snap = await fb.getDoc(ref);
  if (!snap.exists()) return null;
  return { uid: u.uid, ...snap.data() };
}

export function getTodayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function loginGoogleSmart() {
  // tenta popup, se bloqueado usa redirect
  try {
    const res = await signInWithPopup(auth, provider);
    return res.user;
  } catch (e) {
    const blocked = e?.code === "auth/popup-blocked" ||
                    e?.code === "auth/popup-closed-by-user" ||
                    e?.code === "auth/cancelled-popup-request";
    if (blocked) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw e;
  }
}

export async function handleRedirect() {
  try {
    const res = await getRedirectResult(auth);
    return res?.user || null;
  } catch (e) {
    // deixa a tela lidar
    return null;
  }
}

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function logout() {
  await signOut(auth);
}
