// /js/firebase.js  (PADRÃO ÚNICO DO PROJETO)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// ✅ SUA CONFIG (a que você pegou do SDK)
const firebaseConfig = {
  apiKey: "AIzaSyBMr2MIbnPw7k3W6WVmWwY-Pa3VgG0z1qk",
  authDomain: "sistema-dot.firebaseapp.com",
  projectId: "sistema-dot",
  // ✅ hosting usa appspot.com normalmente
  storageBucket: "sistema-dot.appspot.com",
  messagingSenderId: "1003611331429",
  appId: "1:1003611331429:web:b0a6cbf2d3578035059f8c",
  measurementId: "G-F7Y437WQDH"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ "fb" para seu código usar fb.doc(), fb.getDoc(), etc.
export const fb = {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
};

// ✅ Observa login
export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// ✅ Logout
export async function logout() {
  await signOut(auth);
}

// ✅ Perfil do usuário em /users/{uid}
export async function getMyProfile() {
  const u = auth.currentUser;
  if (!u) return null;

  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  return { id: snap.id, ...snap.data() };
}
