// /js/alunos.js
import { requireAuth, bindLogout } from "./auth.js";
import { auth, db, fb } from "./firebase.js";

requireAuth("index.html");
bindLogout("btnSair", "index.html");

const inpNome = document.getElementById("inpNome");
const inpTurma = document.getElementById("inpTurma");
const inpMatricula = document.getElementById("inpMatricula");
const selSituacao = document.getElementById("selSituacao");
const btnCadastrar = document.getElementById("btnCadastrar");

const inpTurmaFiltro = document.getElementById("inpTurmaFiltro");
const btnCarregar = document.getElementById("btnCarregar");
const tbodyAlunos = document.getElementById("tbodyAlunos");

const alunosStatus = document.getElementById("alunosStatus");

function setStatus(msg, kind="") {
  alunosStatus.textContent = msg || "";
  alunosStatus.className = "status " + (kind || "");
}

function normTurma(t) {
  return (t || "").trim().toUpperCase();
}

function normLower(s) {
  return (s || "").trim().toLowerCase();
}

async function cadastrarAluno() {
  const nome = (inpNome.value || "").trim();
  const turma = normTurma(inpTurma.value);
  const matricula = (inpMatricula.value || "").trim();
  const situacao = selSituacao.value || "ativo";

  if (!nome) { setStatus("Informe o nome.", "warn"); return; }
  if (!turma) { setStatus("Informe a turma (ex.: 2A).", "warn"); return; }

  try {
    setStatus("Cadastrando...", "warn");

    const ref = fb.doc(fb.collection(db, "alunos")); // ID automático
    await fb.setDoc(ref, {
      nome,
      nomeLower: normLower(nome),
      turma,
      turmaUpper: turma,
      matricula: matricula || "",
      situacao,
      ativo: situacao === "ativo",
      criadoPor: auth.currentUser.uid,
      criadoEm: fb.serverTimestamp()
    });

    setStatus("Aluno cadastrado com sucesso!", "ok");
    inpNome.value = "";
    inpMatricula.value = "";
    // mantém turma para facilitar

  } catch (e) {
    console.error(e);
    setStatus("Erro ao cadastrar: " + (e?.code || e?.message || e), "bad");
  }
}

async function carregarAlunos() {
  const turma = normTurma(inpTurmaFiltro.value);
  if (!turma) {
    tbodyAlunos.innerHTML = `<tr><td colspan="5" class="muted">Informe a turma.</td></tr>`;
    return;
  }

  tbodyAlunos.innerHTML = `<tr><td colspan="5" class="muted">Carregando...</td></tr>`;

  try {
    const ref = fb.collection(db, "alunos");
    const q = fb.query(ref, fb.where("turmaUpper", "==", turma), fb.orderBy("nomeLower"));
    const snap = await fb.getDocs(q);

    if (snap.empty) {
      tbodyAlunos.innerHTML = `<tr><td colspan="5" class="muted">Nenhum aluno encontrado.</td></tr>`;
      return;
    }

    tbodyAlunos.innerHTML = "";
    snap.forEach((d) => {
      const a = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(a.nome || "")}</td>
        <td>${escapeHtml(a.turmaUpper || a.turma || "")}</td>
        <td>${escapeHtml(String(a.matricula || ""))}</td>
        <td>${escapeHtml(a.situacao || "")}</td>
        <td>
          <button class="btn secondary" data-del="${d.id}">Excluir</button>
        </td>
      `;
      tbodyAlunos.appendChild(tr);
    });

    // eventos excluir
    tbodyAlunos.querySelectorAll("button[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!confirm("Excluir este aluno?")) return;
        await fb.deleteDoc(fb.doc(db, "alunos", id));
        await carregarAlunos();
      });
    });

  } catch (e) {
    console.error(e);
    tbodyAlunos.innerHTML = `<tr><td colspan="5" class="muted">Erro: ${escapeHtml(e?.code || e?.message || String(e))}</td></tr>`;
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

btnCadastrar.addEventListener("click", cadastrarAluno);
btnCarregar.addEventListener("click", carregarAlunos);
