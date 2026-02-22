// firebase.js  (MÓDULO)
// ✅ Firebase v10 (ESM) compatível com GitHub Pages

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * ✅ COLOQUE AQUI O SEU firebaseConfig (o seu já existe, basta manter).
 * Se você já tem um firebaseConfig funcionando, cole exatamente o mesmo.
 */
const firebaseConfig = {
  apiKey: "COLE_AQUI_SUA_API_KEY",
  authDomain: "COLE_AQUI_SEU_AUTH_DOMAIN",
  projectId: "COLE_AQUI_SEU_PROJECT_ID",
  storageBucket: "COLE_AQUI_SEU_STORAGE_BUCKET",
  messagingSenderId: "COLE_AQUI_SEU_MESSAGING_SENDER_ID",
  appId: "COLE_AQUI_SEU_APP_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();
// Força seletor de conta (opcional, mas ajuda em escolas com várias contas)
provider.setCustomParameters({ prompt: "select_account" });

function emailToDocId(email) {
  // DocID seguro para Firestore
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_");
}

/**
 * ✅ Tenta popup. Se popup falhar/bloquear, cai no redirect.
 */
async function signInGoogleSmart() {
  try {
    const res = await signInWithPopup(auth, provider);
    return res.user;
  } catch (e) {
    // Se popup bloqueado ou fechado, tenta redirect
    const code = e?.code || "";
    const popupIssues = [
      "auth/popup-blocked",
      "auth/popup-closed-by-user",
      "auth/cancelled-popup-request",
    ];
    if (popupIssues.includes(code)) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    // Outros erros
    throw e;
  }
}

async function handleRedirectIfAny() {
  try {
    const res = await getRedirectResult(auth);
    return res?.user || null;
  } catch (e) {
    // se der erro de redirect, deixa subir
    throw e;
  }
}

/**
 * ✅ Garante que o usuário exista em /users/{uid} e aplica roles automáticas.
 * Regras:
 * - Primeiro login: cria roles padrão { dot: true }
 * - Se email estiver em /adminsByEmail/{emailDocId} => garante admin:true
 */
async function ensureUserProfile(user) {
  if (!user) return null;

  const uid = user.uid;
  const email = user.email || "";
  const displayName = user.displayName || "";

  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  // roles padrão
  const defaultRoles = { admin: false, dot: true, monitor: false, pais: false };

  if (!snap.exists()) {
    await setDoc(
      userRef,
      {
        uid,
        email,
        name: displayName,
        roles: defaultRoles,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    // garante campos mínimos
    await setDoc(
      userRef,
      {
        uid,
        email,
        name: displayName || snap.data()?.name || "",
        roles: snap.data()?.roles || defaultRoles,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // ✅ Se o e-mail está autorizado como admin, aplica no perfil
  const adminKey = emailToDocId(email);
  if (adminKey) {
    const adminRef = doc(db, "adminsByEmail", adminKey);
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) {
      // marca admin true
      const newData = (await getDoc(userRef)).data() || {};
      const roles = newData.roles || defaultRoles;

      if (!roles.admin) {
        await updateDoc(userRef, {
          "roles.admin": true,
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  // retorna perfil atualizado
  const finalSnap = await getDoc(userRef);
  return finalSnap.data();
}

/**
 * ✅ Helpers de permissão
 */
function hasRole(profile, roleName) {
  return !!profile?.roles?.[roleName];
}

export {
  auth,
  db,
  provider,
  signInGoogleSmart,
  handleRedirectIfAny,
  ensureUserProfile,
  signOut,
  onAuthStateChanged,
  // firestore utils exportados para páginas internas
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  emailToDocId,
  hasRole,
};
