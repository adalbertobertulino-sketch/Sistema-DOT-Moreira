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

// migração em lote
const migTurmaDe = document.getElementById("migTurmaDe");
const migTurmaPara = document.getElementById("migTurmaPara");
const btnMigrar = document.getElementById("btnMigrar");
const migStatus = document.getElementById("migStatus");

let cacheDocs = [];

function setStatus(el, msg, kind = "") {
  if (!el) return;
  el.textContent = msg || "";
  el.className = "status " + (kind || "");
}

function normTurma(t) {
  return (t || "").trim().toUpperCase();
}

function normLower(s) {
  return (s || "").trim().toLowerCase();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== CADASTRAR =====
async function cadastrarAluno() {
  const nome = (inpNome.value || "").trim();
  const turma = normTurma(inpTurma.value);
  const matricula = (inpMatricula.value || "").trim();
  const situacao = selSituacao.value || "ativo";

  if (!nome) { setStatus(alunosStatus, "Informe o nome.", "warn"); return; }
  if (!turma) { setStatus(alunosStatus, "Informe a turma (ex.: 2A).", "warn"); return; }

  try {
    setStatus(alunosStatus, "Cadastrando...", "warn");

    const ref = fb.doc(fb.collection(db, "alunos"));
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

    setStatus(alunosStatus, "Aluno cadastrado!", "ok");
    inpNome.value = "";
    inpMatricula.value = "";
  } catch (e) {
    console.error(e);
    setStatus(alunosStatus, "Erro ao cadastrar: " + (e?.code || e?.message || e), "bad");
  }
}

// ===== CARREGAR (SEM orderBy: evita índice) =====
async function carregarAlunos() {
  const turma = normTurma(inpTurmaFiltro.value);
  if (!turma) {
    tbodyAlunos.innerHTML = `<tr><td colspan="5" class="muted">Informe a turma.</td></tr>`;
    return;
  }

  tbodyAlunos.innerHTML = `<tr><td colspan="5" class="muted">Carregando...</td></tr>`;
  cacheDocs = [];

  try {
    const ref = fb.collection(db, "alunos");
    const q = fb.query(ref, fb.where("turmaUpper", "==", turma));
    const snap = await fb.getDocs(q);

    if (snap.empty) {
      tbodyAlunos.innerHTML = `<tr><td colspan="5" class="muted">Nenhum aluno encontrado.</td></tr>`;
      setStatus(alunosStatus, "Nenhum aluno na turma " + turma, "warn");
      return;
    }

    snap.forEach((d) => cacheDocs.push({ id: d.id, ...d.data() }));

    cacheDocs.sort((a, b) => (a.nomeLower || "").localeCompare(b.nomeLower || ""));

    renderTabela();
    setStatus(alunosStatus, `Carregado(s) ${cacheDocs.length} aluno(s).`, "ok");
  } catch (e) {
    console.error(e);
    tbodyAlunos.innerHTML = `<tr><td colspan="5" class="muted">Erro: ${escapeHtml(e?.code || e?.message || String(e))}</td></tr>`;
    setStatus(alunosStatus, "Erro ao carregar: " + (e?.code || e?.message || e), "bad");
  }
}

function renderTabela() {
  if (!cacheDocs.length) {
    tbodyAlunos.innerHTML = `<tr><td colspan="5" class="muted">Sem dados.</td></tr>`;
    return;
  }

  tbodyAlunos.innerHTML = cacheDocs.map(a => {
    return `
      <tr data-id="${a.id}">
        <td class="cell-nome">${escapeHtml(a.nome || "")}</td>
        <td class="cell-turma">${escapeHtml(a.turmaUpper || a.turma || "")}</td>
        <td class="cell-matricula">${escapeHtml(String(a.matricula || ""))}</td>
        <td class="cell-situacao">${escapeHtml(a.situacao || "")}</td>
        <td class="cell-acoes">
          <button class="btn secondary btn-edit">Editar</button>
          <button class="btn danger btn-del">Excluir</button>
        </td>
      </tr>
    `;
  }).join("");

  tbodyAlunos.querySelectorAll("tr").forEach(tr => {
    const id = tr.getAttribute("data-id");
    tr.querySelector(".btn-del").addEventListener("click", () => excluirAluno(id));
    tr.querySelector(".btn-edit").addEventListener("click", () => entrarModoEdicao(id));
  });
}

// ===== EXCLUIR =====
async function excluirAluno(id) {
  if (!confirm("Excluir este aluno?")) return;
  try {
    await fb.deleteDoc(fb.doc(db, "alunos", id));
    cacheDocs = cacheDocs.filter(x => x.id !== id);
    renderTabela();
    setStatus(alunosStatus, "Aluno excluído.", "ok");
  } catch (e) {
    console.error(e);
    setStatus(alunosStatus, "Erro ao excluir: " + (e?.code || e?.message || e), "bad");
  }
}

// ===== EDITAR (UM ALUNO) =====
function entrarModoEdicao(id) {
  const tr = tbodyAlunos.querySelector(`tr[data-id="${id}"]`);
  const aluno = cacheDocs.find(x => x.id === id);
  if (!tr || !aluno) return;

  tr.querySelector(".cell-nome").innerHTML =
    `<input class="input" id="edNome_${id}" value="${escapeHtml(aluno.nome || "")}">`;

  tr.querySelector(".cell-turma").innerHTML =
    `<input class="input" id="edTurma_${id}" value="${escapeHtml(aluno.turmaUpper || aluno.turma || "")}" style="width:90px">`;

  tr.querySelector(".cell-matricula").innerHTML =
    `<input class="input" id="edMat_${id}" value="${escapeHtml(String(aluno.matricula || ""))}" style="width:120px">`;

  tr.querySelector(".cell-situacao").innerHTML = `
    <select class="input" id="edSit_${id}">
      <option value="ativo">ativo</option>
      <option value="desistente">desistente</option>
      <option value="evadido">evadido</option>
    </select>
  `;
  tr.querySelector(`#edSit_${id}`).value = aluno.situacao || "ativo";

  tr.querySelector(".cell-acoes").innerHTML = `
    <button class="btn btn-save">Salvar</button>
    <button class="btn secondary btn-cancel">Cancelar</button>
  `;

  tr.querySelector(".btn-save").addEventListener("click", () => salvarEdicao(id));
  tr.querySelector(".btn-cancel").addEventListener("click", () => renderTabela());
}

async function salvarEdicao(id) {
  const aluno = cacheDocs.find(x => x.id === id);
  if (!aluno) return;

  const nome = (document.getElementById(`edNome_${id}`)?.value || "").trim();
  const turma = normTurma(document.getElementById(`edTurma_${id}`)?.value || "");
  const matricula = (document.getElementById(`edMat_${id}`)?.value || "").trim();
  const situacao = (document.getElementById(`edSit_${id}`)?.value || "ativo");

  if (!nome) { setStatus(alunosStatus, "Nome não pode ficar vazio.", "warn"); return; }
  if (!turma) { setStatus(alunosStatus, "Turma não pode ficar vazia.", "warn"); return; }

  try {
    setStatus(alunosStatus, "Salvando alterações...", "warn");

    await fb.updateDoc(fb.doc(db, "alunos", id), {
      nome,
      nomeLower: normLower(nome),
      turma,
      turmaUpper: turma,
      matricula: matricula || "",
      situacao,
      ativo: situacao === "ativo",
      atualizadoPor: auth.currentUser.uid,
      atualizadoEm: fb.serverTimestamp()
    });

    aluno.nome = nome;
    aluno.nomeLower = normLower(nome);
    aluno.turma = turma;
    aluno.turmaUpper = turma;
    aluno.matricula = matricula || "";
    aluno.situacao = situacao;
    aluno.ativo = situacao === "ativo";

    cacheDocs.sort((a, b) => (a.nomeLower || "").localeCompare(b.nomeLower || ""));
    renderTabela();

    setStatus(alunosStatus, "Alterações salvas!", "ok");
  } catch (e) {
    console.error(e);
    setStatus(alunosStatus, "Erro ao salvar: " + (e?.code || e?.message || e), "bad");
  }
}

// ===== MIGRAR TURMA (LOTE) =====
async function migrarTurmaLote() {
  const de = normTurma(migTurmaDe.value);
  const para = normTurma(migTurmaPara.value);

  if (!de) { setStatus(migStatus, "Informe a turma atual.", "warn"); return; }
  if (!para) { setStatus(migStatus, "Informe a nova turma.", "warn"); return; }
  if (de === para) { setStatus(migStatus, "As turmas são iguais.", "warn"); return; }

  const ok = confirm(`Confirmar migração: ${de} → ${para} ?\n\nIsso altera TODOS os alunos dessa turma.`);
  if (!ok) return;

  try {
    setStatus(migStatus, "Buscando alunos da turma " + de + "...", "warn");

    // pega todos os alunos da turma "de"
    const ref = fb.collection(db, "alunos");
    const q = fb.query(ref, fb.where("turmaUpper", "==", de));
    const snap = await fb.getDocs(q);

    if (snap.empty) {
      setStatus(migStatus, "Não encontrei alunos em " + de, "warn");
      return;
    }

    // batch com limite 450 por segurança
    const docs = [];
    snap.forEach(d => docs.push(d));

    let atualizados = 0;
    let batch = fb.writeBatch(db);
    let count = 0;

    for (const d of docs) {
      batch.update(d.ref, {
        turma: para,
        turmaUpper: para,
        atualizadoPor: auth.currentUser.uid,
        atualizadoEm: fb.serverTimestamp()
      });
      count++;
      atualizados++;

      if (count >= 450) {
        await batch.commit();
        batch = fb.writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) await batch.commit();

    setStatus(migStatus, `Migração concluída! ${atualizados} aluno(s) movidos para ${para}.`, "ok");

    // se o usuário estiver vendo a turma "de", recarrega.
    if (normTurma(inpTurmaFiltro.value) === de) {
      inpTurmaFiltro.value = para;
      await carregarAlunos();
    }
  } catch (e) {
    console.error(e);
    setStatus(migStatus, "Erro na migração: " + (e?.code || e?.message || e), "bad");
  }
}

// eventos
btnCadastrar.addEventListener("click", cadastrarAluno);
btnCarregar.addEventListener("click", carregarAlunos);
btnMigrar.addEventListener("click", migrarTurmaLote);
