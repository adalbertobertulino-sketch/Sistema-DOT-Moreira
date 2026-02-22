<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
  import {
    getAuth,
    GoogleAuthProvider,
    signInWithRedirect,
    getRedirectResult,
    onAuthStateChanged
  } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
  import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

  window.loginGoogle = () => {
    signInWithRedirect(auth, provider);
  };

  async function criarUsuarioSeNaoExistir(user) {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: user.email,
        name: user.displayName || "",
        roles: ["dot"],
        createdAt: new Date()
      });
    }
  }

  // Volta do Google
  getRedirectResult(auth).then(async (result) => {
    if (result?.user) {
      await criarUsuarioSeNaoExistir(result.user);
      window.location.href = "dashboard.html";
    }
  }).catch(err => {
    alert("Erro no login (redirect): " + err.message);
  });

  // Se já estiver logado
  onAuthStateChanged(auth, async (user) => {
    if (user && window.location.pathname.includes("index")) {
      await criarUsuarioSeNaoExistir(user);
      window.location.href = "dashboard.html";
    }
  });
</script>
