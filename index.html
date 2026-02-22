<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
  import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
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

  window.loginGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      await criarUsuarioSeNaoExistir(result.user);
      window.location.href = "dashboard.html";
    } catch (err) {
      alert("Erro no login (popup): " + err.message);
    }
  };

  onAuthStateChanged(auth, async (user) => {
    if (user && window.location.pathname.includes("index")) {
      await criarUsuarioSeNaoExistir(user);
      window.location.href = "dashboard.html";
    }
  });
</script>
