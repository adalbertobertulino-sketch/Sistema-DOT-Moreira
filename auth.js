<script type="module">
  import { auth, db } from "./firebase.js";
  import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
  } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

  import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
  } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

  const provider = new GoogleAuthProvider();

  // Login Google
  window.loginGoogle = async function () {
    try {
      const btn = document.getElementById("btnGoogle");
      const status = document.getElementById("status");
      if (btn) btn.disabled = true;
      if (status) status.innerText = "Aguardando...";

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Cria doc no Firestore se não existir (role padrão: dot)
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await setDoc(ref, {
          nome: user.displayName || "",
          email: user.email || "",
          role: "dot",
          schoolId: "moreira",
          createdAt: serverTimestamp()
        });
      }

      window.location.href = "dashboard.html";
    } catch (e) {
      alert("Erro no login: " + (e?.message || e));
      const status = document.getElementById("status");
      if (status) status.innerText = "Erro no login";
    } finally {
      const btn = document.getElementById("btnGoogle");
      if (btn) btn.disabled = false;
    }
  };

  // Sair
  window.logout = async function () {
    await signOut(auth);
    window.location.href = "index.html";
  };

  // Guard (bloqueia páginas sem login)
  window.guardAuth = function (onLogged) {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }
      if (onLogged) onLogged(user);
    });
  };
</script>
