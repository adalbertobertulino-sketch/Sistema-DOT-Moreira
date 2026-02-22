<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Sistema DOT Moreira — Dashboard</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#f2f4f7}
    .top{background:#0b1b3a;color:#fff;padding:14px 18px;font-weight:700}
    .wrap{padding:18px}
    .card{background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.12);padding:18px}
    .row{margin:8px 0}
    .muted{color:#666}
    .btn{padding:10px 12px;border-radius:10px;border:0;cursor:pointer;font-weight:700}
    .btn-out{background:#c0392b;color:#fff}
    .tag{display:inline-block;padding:4px 10px;border-radius:999px;background:#eee;margin-left:8px;font-size:12px}
    .ok{color:#0b6}
    .err{color:#c00}
  </style>
</head>
<body>
  <div class="top">Sistema DOT Moreira — Dashboard</div>

  <div class="wrap">
    <div class="card">
      <div id="status" class="row muted">Carregando...</div>

      <div class="row"><b>Nome:</b> <span id="name">—</span></div>
      <div class="row"><b>Email:</b> <span id="email">—</span></div>
      <div class="row"><b>UID:</b> <span id="uid">—</span></div>
      <div class="row"><b>Role:</b> <span id="role">—</span> <span id="badge" class="tag">—</span></div>

      <hr/>

      <div class="row muted">
        Regras:
        <ul>
          <li><b>admin</b>: vê tudo + cadastra novos admins</li>
          <li><b>dot</b>: cadastra estudantes / turmas / frequência</li>
          <li><b>monitor</b>: lança frequência</li>
          <li><b>pai</b>: vê boletim (futuro)</li>
        </ul>
      </div>

      <button id="btnSair" class="btn btn-out">Sair</button>
    </div>
  </div>

  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
    import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
    import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

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

    const $ = (id) => document.getElementById(id);
    function setStatus(msg, isErr=false){
      const el = $("status");
      el.textContent = msg;
      el.className = "row " + (isErr ? "err" : "muted");
    }

    async function ensureUserDoc(user){
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      const base = {
        uid: user.uid,
        email: user.email || "",
        name: user.displayName || "",
        updatedAt: serverTimestamp()
      };

      if(!snap.exists()){
        await setDoc(ref, { ...base, role: "dot", createdAt: serverTimestamp() }, { merge:true });
        return { role: "dot", ...base };
      } else {
        await setDoc(ref, base, { merge:true });
        const data = snap.data();
        return { ...data, ...base };
      }
    }

    onAuthStateChanged(auth, async (user) => {
      if(!user){
        // não logado -> volta pro login
        window.location.href = "./index.html?v=" + Date.now();
        return;
      }

      try{
        setStatus("Buscando perfil no Firestore...");
        const profile = await ensureUserDoc(user);

        $("name").textContent = profile.name || "(sem nome)";
        $("email").textContent = profile.email || "(sem email)";
        $("uid").textContent = profile.uid || user.uid;
        $("role").textContent = profile.role || "(sem role)";
        $("badge").textContent = (profile.role || "sem role").toUpperCase();

        setStatus("OK: leitura do Firestore concluída com sucesso.", false);
      }catch(e){
        setStatus("Erro: " + (e?.code || e?.message), true);
      }
    });

    $("btnSair").addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "./index.html?v=" + Date.now();
    });
  </script>
</body>
</html>
