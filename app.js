// app.js (Firebase v12+ via CDN, modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/** 🔧 SUA CONFIG (a sua mesma) */
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

/** Util */
function $(id){ return document.getElementById(id); }
function show(el, on=true){ if(!el) return; el.style.display = on ? "" : "none"; }
function safeTxt(v){ return (v ?? "").toString(); }

function showNotice(text, isErr=false){
  const n = $("notice");
  if(!n) return;
  n.textContent = text;
  n.className = isErr ? "notice err" : "notice";
  show(n, true);
}

function clearNotice(){
  const n = $("notice");
  if(!n) return;
  n.textContent = "";
  show(n, false);
}

/** Cria doc do usuário se não existir (sem sobrescrever role se já existe) */
async function ensureUserDoc(user){
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if(!snap.exists()){
    await setDoc(ref, {
      email: user.email || "",
      nome: user.displayName || "",
      role: "dot",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { email: user.email || "", nome: user.displayName || "", role: "dot" };
  }

  const data = snap.data() || {};
  // Atualiza apenas campos "seguros" sem mexer em role
  await setDoc(ref, {
    email: user.email || data.email || "",
    nome: user.displayName || data.nome || "",
    updatedAt: serverTimestamp()
  }, { merge: true });

  return {
    email: data.email || user.email || "",
    nome: data.nome || user.displayName || "",
    role: data.role || "dot"
  };
}

/** LOGIN PAGE */
export function startLoginPage(){
  const btn = $("btnGoogle");
  const status = $("status");
  const msg = $("msg");

  function setMsg(t, err=false){
    if(!msg) return;
    msg.textContent = t;
    msg.className = err ? "notice err" : "notice";
    show(msg, true);
  }

  onAuthStateChanged(auth, async (user) => {
    if(user){
      if(status) status.textContent = "Você já está logado. Indo para o dashboard…";
      window.location.href = "dashboard.html";
    } else {
      if(status) status.textContent = "Aguardando login…";
    }
  });

  if(btn){
    btn.addEventListener("click", async () => {
      try{
        if(status) status.textContent = "Abrindo login do Google…";
        show(msg, false);

        await signInWithPopup(auth, provider);

        if(status) status.textContent = "Login feito! Redirecionando…";
        window.location.href = "dashboard.html";
      }catch(e){
        console.error(e);
        setMsg("Erro no login: " + (e?.code || e?.message || e), true);
        if(status) status.textContent = "";
      }
    });
  }
}

/** DASHBOARD */
export function startDashboardPage(){
  // Nav tabs
  document.querySelectorAll(".nav a").forEach(a => {
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      const tab = a.getAttribute("data-tab");
      document.querySelectorAll(".nav a").forEach(x => x.classList.remove("active"));
      a.classList.add("active");

      ["inicio","turmas","alunos","avisos"].forEach(t => {
        const sec = document.getElementById("tab-" + t);
        if(sec) sec.style.display = (t === tab) ? "" : "none";
      });
    });
  });

  // Sair
  const btnSair = $("btnSair");
  if(btnSair){
    btnSair.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "index.html";
    });
  }

  // Estado principal
  let currentRole = "dot";
  let turmasCache = []; // para preencher select do aluno
  let unsubscribers = [];

  function cleanup(){
    unsubscribers.forEach(fn => { try{ fn(); }catch{} });
    unsubscribers = [];
  }

  onAuthStateChanged(auth, async (user) => {
    clearNotice();

    if(!user){
      window.location.href = "index.html";
      return;
    }

    try{
      $("welcome").textContent = "Carregando…";
      $("who").textContent = "";
      $("perfilBox").textContent = "Carregando…";
      $("badgeRole").textContent = "Carregando…";

      const userDoc = await ensureUserDoc(user);
      currentRole = userDoc.role || "dot";

      // UI topo
      $("welcome").textContent = `Bem-vindo(a), ${userDoc.nome || "usuário"}`;
      $("who").textContent = `Email: ${userDoc.email || user.email || ""}`;
      $("badgeRole").textContent = `Role: ${currentRole}`;
      $("perfilBox").innerHTML =
        `<b>Nome:</b> ${safeTxt(userDoc.nome)}<br/>
         <b>Email:</b> ${safeTxt(userDoc.email)}<br/>
         <b>Role:</b> ${safeTxt(currentRole)}<br/>
         <b>UID:</b> ${safeTxt(user.uid)}`;

      // Mostrar formulários apenas para admin
      const isAdmin = currentRole === "admin";
      show($("formTurma"), isAdmin);
      show($("formAluno"), isAdmin);
      show($("formAviso"), isAdmin);

      // Inicia listeners em tempo real
      cleanup();
      startRealtime(isAdmin);

      // Botões de salvar (admin)
      wireAdminActions(isAdmin, user);

    }catch(e){
      console.error(e);
      showNotice("Erro carregando dashboard: " + (e?.message || e), true);
    }
  });

  function wireAdminActions(isAdmin, user){
    // TURMA
    const btnSalvarTurma = $("btnSalvarTurma");
    if(btnSalvarTurma){
      btnSalvarTurma.onclick = async () => {
        if(!isAdmin){
          showNotice("Você não é admin para cadastrar turmas.", true);
          return;
        }
        const nome = ($("turmaNome")?.value || "").trim();
        const ano = ($("turmaAno")?.value || "").trim();
        if(!nome || !ano){
          $("turmaMsg").textContent = "Preencha nome e ano.";
          return;
        }
        $("turmaMsg").textContent = "Salvando…";
        try{
          await addDoc(collection(db, "turmas"), {
            nome,
            ano,
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });
          $("turmaNome").value = "";
          $("turmaAno").value = "";
          $("turmaMsg").textContent = "Turma salva ✅";
        }catch(e){
          console.error(e);
          $("turmaMsg").textContent = "Erro: " + (e?.message || e);
        }
      };
    }

    // ALUNO
    const btnSalvarAluno = $("btnSalvarAluno");
    if(btnSalvarAluno){
      btnSalvarAluno.onclick = async () => {
        if(!isAdmin){
          showNotice("Você não é admin para cadastrar alunos.", true);
          return;
        }
        const nome = ($("alunoNome")?.value || "").trim();
        const turmaId = ($("alunoTurma")?.value || "").trim();
        if(!nome || !turmaId){
          $("alunoMsg").textContent = "Preencha nome e selecione a turma.";
          return;
        }
        $("alunoMsg").textContent = "Salvando…";
        try{
          await addDoc(collection(db, "alunos"), {
            nome,
            turmaId,
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });
          $("alunoNome").value = "";
          $("alunoMsg").textContent = "Aluno salvo ✅";
        }catch(e){
          console.error(e);
          $("alunoMsg").textContent = "Erro: " + (e?.message || e);
        }
      };
    }

    // AVISO
    const btnSalvarAviso = $("btnSalvarAviso");
    if(btnSalvarAviso){
      btnSalvarAviso.onclick = async () => {
        if(!isAdmin){
          showNotice("Você não é admin para publicar avisos.", true);
          return;
        }
        const titulo = ($("avisoTitulo")?.value || "").trim();
        const data = ($("avisoData")?.value || "").trim();
        const texto = ($("avisoTexto")?.value || "").trim();

        if(!titulo || !data || !texto){
          $("avisoMsg").textContent = "Preencha título, data e texto.";
          return;
        }

        $("avisoMsg").textContent = "Publicando…";
        try{
          await addDoc(collection(db, "avisos"), {
            titulo,
            data,
            texto,
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });
          $("avisoTitulo").value = "";
          $("avisoData").value = "";
          $("avisoTexto").value = "";
          $("avisoMsg").textContent = "Aviso publicado ✅";
        }catch(e){
          console.error(e);
          $("avisoMsg").textContent = "Erro: " + (e?.message || e);
        }
      };
    }
  }

  function startRealtime(isAdmin){
    // TURMAS (tempo real)
    const qTurmas = query(collection(db, "turmas"), orderBy("createdAt", "desc"));
    const unsubTurmas = onSnapshot(qTurmas, (snap) => {
      turmasCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTurmas(turmasCache);
      $("kpiTurmas").textContent = String(turmasCache.length);

      // Alimenta select de turma do aluno
      const sel = $("alunoTurma");
      if(sel){
        sel.innerHTML = `<option value="">Selecione…</option>` +
          turmasCache.map(t => `<option value="${t.id}">${escapeHtml(t.nome)} (${escapeHtml(t.ano)})</option>`).join("");
      }
    }, (err) => {
      console.error(err);
      showNotice("Erro lendo turmas (Firestore): " + (err?.message || err), true);
    });
    unsubscribers.push(unsubTurmas);

    // ALUNOS (tempo real)
    const qAlunos = query(collection(db, "alunos"), orderBy("createdAt", "desc"));
    const unsubAlunos = onSnapshot(qAlunos, (snap) => {
      const alunos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAlunos(alunos);
      $("kpiAlunos").textContent = String(alunos.length);
    }, (err) => {
      console.error(err);
      showNotice("Erro lendo alunos (Firestore): " + (err?.message || err), true);
    });
    unsubscribers.push(unsubAlunos);

    // AVISOS (tempo real)
    const qAvisos = query(collection(db, "avisos"), orderBy("createdAt", "desc"));
    const unsubAvisos = onSnapshot(qAvisos, (snap) => {
      const avisos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAvisos(avisos);
      $("kpiAvisos").textContent = String(avisos.length);
      renderAvisosResumo(avisos.slice(0, 3));
    }, (err) => {
      console.error(err);
      showNotice("Erro lendo avisos (Firestore): " + (err?.message || err), true);
    });
    unsubscribers.push(unsubAvisos);
  }

  function renderTurmas(turmas){
    const box = $("listTurmas");
    if(!box) return;

    if(!turmas.length){
      box.innerHTML = `<div class="small">Nenhuma turma cadastrada ainda.</div>`;
      return;
    }

    box.innerHTML = turmas.map(t => `
      <div class="item">
        <p class="item-title">${escapeHtml(t.nome || "Turma")}</p>
        <p class="item-sub">Ano: ${escapeHtml(t.ano || "")} • ID: ${t.id}</p>
      </div>
    `).join("");
  }

  function renderAlunos(alunos){
    const box = $("listAlunos");
    if(!box) return;

    if(!alunos.length){
      box.innerHTML = `<div class="small">Nenhum aluno cadastrado ainda.</div>`;
      return;
    }

    const turmaNameById = new Map(turmasCache.map(t => [t.id, `${t.nome} (${t.ano})`]));

    box.innerHTML = alunos.map(a => `
      <div class="item">
        <p class="item-title">${escapeHtml(a.nome || "Aluno")}</p>
        <p class="item-sub">
          Turma: ${escapeHtml(turmaNameById.get(a.turmaId) || a.turmaId || "—")}
          • ID: ${a.id}
        </p>
      </div>
    `).join("");
  }

  function renderAvisos(avisos){
    const box = $("listAvisos");
    if(!box) return;

    if(!avisos.length){
      box.innerHTML = `<div class="small">Nenhum aviso publicado ainda.</div>`;
      return;
    }

    box.innerHTML = avisos.map(a => `
      <div class="item">
        <p class="item-title">${escapeHtml(a.titulo || "Aviso")}</p>
        <p class="item-sub">Data: ${escapeHtml(a.data || "")}</p>
        <p class="item-sub">${escapeHtml(a.texto || "")}</p>
      </div>
    `).join("");
  }

  function renderAvisosResumo(avisos){
    const box = $("listAvisosResumo");
    if(!box) return;

    if(!avisos.length){
      box.innerHTML = `<div class="small">Sem avisos recentes.</div>`;
      return;
    }

    box.innerHTML = avisos.map(a => `
      <div class="item">
        <p class="item-title">${escapeHtml(a.titulo || "Aviso")}</p>
        <p class="item-sub">Data: ${escapeHtml(a.data || "")}</p>
      </div>
    `).join("");
  }
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
