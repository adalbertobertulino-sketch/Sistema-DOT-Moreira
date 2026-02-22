// alunos.js (APAGUE TUDO e COLE)

import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  addDoc,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/** Helpers UI */
const $ = (id) => document.getElementById(id);

const msgEl = $("msg");
function showMsg(text, type = "ok") {
  msgEl.style.display = "block";
  msgEl.className = "msg " + (type === "ok" ? "ok" : "err");
  msgEl.textContent = text;
}

function clearMsg() {
  msgEl.style.display = "none";
  msgEl.textContent = "";
}

function normTurma(t) {
  return (t || "").trim();
}

function normNome(n) {
  return (n || "").trim();
}

/** Auth + Role */
let currentUser = null;
let currentRoles = [];

async function loadUserRoles(uid) {
  // users/{uid} deve existir (se não existir, considera DOT por padrão)
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return ["dot"];
  const data = snap.data() || {};
  const roles = Array.isArray(data.roles) ? data.roles : (data.role ? [data.role] : []);
  return roles.length ? roles : ["dot"];
}

function hasRole(role) {
  return currentRoles.includes(role);
}

function requireDotOrAdmin() {
  // DOT ou admin podem cadastrar aluno
  if (!hasRole("dot") && !hasRole("admin")) {
    showMsg("Acesso negado: somente DOT ou admin pode cadastrar/editar alunos.", "err");
    $("btnSalvar").disabled = true;
    return false;
  }
  $("btnSalvar").disabled = false;
  return true;
}

/** Render */
function renderRows(rows) {
  const tbody = $("tbody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Nenhum aluno encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const matricula = r.matricula ? r.matricula : "-";
    const ativoTxt = r.ativo ? "Sim" : "Não";
    const btnTxt = r.ativo ? "Desativar" : "Ativar";
    return `
      <tr>
        <td>${escapeHtml(r.nome)}</td>
        <td>${escapeHtml(r.turma)}</td>
        <td>${escapeHtml(matricula)}</td>
        <td>${ativoTxt}</td>
        <td>
          <button class="secondary" data-action="toggle" data-id="${r.id}">${btnTxt}</button>
        </td>
      </tr>
    `;
  }).join("");

  // bind toggles
  tbody.querySelectorAll("button[data-action='toggle']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      await toggleAtivo(id);
    });
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** CRUD */
async function salvarAluno() {
  clearMsg();

  if (!currentUser) {
    showMsg("Você precisa estar logado.", "err");
    return;
  }
  if (!requireDotOrAdmin()) return;

  const nome = normNome($("nome").value);
  const turma = normTurma($("turma").value);
  const matricula = ( $("matricula").value || "" ).trim();

  if (!nome) return showMsg("Informe o nome completo.", "err");
  if (!turma) return showMsg("Informe a turma (ex.: 1A).", "err");

  $("btnSalvar").disabled = true;

  try {
    await addDoc(collection(db, "alunos"), {
      nome,
      turma,
      matricula: matricula || "",
      ativo: true,
      criadoPor: currentUser.uid,
      criadoEm: serverTimestamp()
    });

    $("nome").value = "";
    $("turma").value = "";
    $("matricula").value = "";

    showMsg("Aluno cadastrado com sucesso ✅", "ok");
    await carregarAlunos();
  } catch (e) {
    console.error(e);
    showMsg("Erro ao salvar aluno: " + (e?.message || e), "err");
  } finally {
    $("btnSalvar").disabled = false;
  }
}

async function carregarAlunos() {
  const tbody = $("tbody");
  tbody.innerHTML = `<tr><td colspan="5" class="muted">Carregando...</td></tr>`;

  try {
    const turmaFiltro = normTurma($("filtroTurma").value);

    // Query: alunos ativos e ordenados por nome
    let qRef;
    if (turmaFiltro) {
      qRef = query(
        collection(db, "alunos"),
        where("turma", "==", turmaFiltro),
        orderBy("nome", "asc")
      );
    } else {
      qRef = query(
        collection(db, "alunos"),
        orderBy("turma", "asc"),
        orderBy("nome", "asc")
      );
    }

    const snap = await getDocs(qRef);
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRows(rows);
  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Erro ao carregar.</td></tr>`;
    showMsg("Erro ao carregar alunos: " + (e?.message || e), "err");
  }
}

async function toggleAtivo(alunoDocId) {
  clearMsg();

  if (!currentUser) return showMsg("Você precisa estar logado.", "err");
  if (!requireDotOrAdmin()) return;

  try {
    const ref = doc(db, "alunos", alunoDocId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return showMsg("Aluno não encontrado.", "err");

    const data = snap.data();
    const novo = !Boolean(data.ativo);

    await updateDoc(ref, {
      ativo: novo
    });

    showMsg(novo ? "Aluno ativado ✅" : "Aluno desativado ✅", "ok");
    await carregarAlunos();
  } catch (e) {
    console.error(e);
    showMsg("Erro ao alterar aluno: " + (e?.message || e), "err");
  }
}

/** Logout */
async function sair() {
  try {
    await signOut(auth);
    window.location.href = "./index.html";
  } catch (e) {
    console.error(e);
    showMsg("Erro ao sair: " + (e?.message || e), "err");
  }
}

/** Boot */
$("btnSalvar").addEventListener("click", salvarAluno);
$("btnRecarregar").addEventListener("click", carregarAlunos);
$("btnSair").addEventListener("click", sair);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // se não estiver logado, manda para login
    window.location.href = "./index.html";
    return;
  }

  currentUser = user;

  // carrega roles
  currentRoles = await loadUserRoles(user.uid);

  // mostra no topo
  $("perfilPill").textContent = "Perfil: " + currentRoles.join(", ");

  // só DOT/admin podem mexer
  requireDotOrAdmin();

  // carrega lista
  await carregarAlunos();
});
