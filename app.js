// firebase.js (Firebase compat para GitHub Pages)
const firebaseConfig = {
  apiKey: "AIzaSyBMr2MIbnPw7k3W6WVmWwY-Pa3VgG0z1qk",
  authDomain: "sistema-dot.firebaseapp.com",
  projectId: "sistema-dot",
  storageBucket: "sistema-dot.firebasestorage.app",
  messagingSenderId: "1003611331429",
  appId: "1:1003611331429:web:2b55b32379b447e3059f8c",
  measurementId: "G-FS1CBVNFEG"
};

firebase.initializeApp(firebaseConfig);

window.auth = firebase.auth();
window.db = firebase.firestore();
window.storage = firebase.storage();

// Util: timestamp server
window.serverTs = () => firebase.firestore.FieldValue.serverTimestamp();

// Roles: guardamos array roles: ["dot"], ["admin","dot"], ["monitor"], ["parent"]
window.hasRole = (rolesArr, role) => Array.isArray(rolesArr) && rolesArr.includes(role);

// Cria/atualiza doc do usuário
window.ensureUserDoc = async function ensureUserDoc(user) {
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();

  const base = {
    uid: user.uid,
    email: user.email || "",
    name: user.displayName || "",
    updatedAt: serverTs()
  };

  if (!snap.exists) {
    // Primeiro acesso: vira DOT por padrão
    await ref.set({
      ...base,
      roles: ["dot"],
      createdAt: serverTs()
    });
  } else {
    await ref.set(base, { merge: true });
  }

  const fresh = await ref.get();
  return fresh.data();
};

// Login Google à prova de Brave/Tablet
window.loginGoogle = async function loginGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();

  try {
    // Tenta popup primeiro
    const result = await auth.signInWithPopup(provider);
    await ensureUserDoc(result.user);
    return true;
  } catch (popupErr) {
    console.warn("Popup falhou, tentando redirect:", popupErr);
    try {
      await auth.signInWithRedirect(provider);
      return true;
    } catch (redirErr) {
      alert("Erro no login: " + redirErr.message);
      return false;
    }
  }
};

// Tratamento do retorno do redirect
window.handleRedirect = async function handleRedirect() {
  try {
    const result = await auth.getRedirectResult();
    if (result && result.user) {
      await ensureUserDoc(result.user);
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

window.logout = async function logout() {
  await auth.signOut();
  window.location.href = "index.html";
};

// Protege página: exige login
window.requireAuth = function requireAuth() {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }
      const me = await ensureUserDoc(user);
      resolve({ user, me });
    });
  });
};
