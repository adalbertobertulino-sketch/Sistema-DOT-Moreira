// js/frequencia.js
import { auth, db, serverTimestamp } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const turmaSelect = document.getElementById("turmaSelect");
const dataInput = document.getElementById("dataInput");
const somenteAtivos = document.getElementById("somenteAtivos");
const buscarInput = document.getElementById("buscarInput");
const btnCarregar = document.getElementById("btnCarregar");
const btnSalvar = document.getElementById("btnSalvar");
const listaAlunos = document.getElementById("listaAlunos");
const statusFreq = document.getElementById("statusFreq");

let usuarioAtual = null;
let alunosCarregados = []; // [{id, ...data}]

function setStatus(msg, kind = "") {
  if (!statusFreq) return;
  statusFreq.textContent = msg || "";
  statusFreq.className = "status " + kind;
}

function hojeYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeTurma(t) {
  return (t || "").trim().toUpperCase();
}

function montarIdFrequencia(turmaUpper, matricula, data) {
  // ID do documento na coleção "frequencias"
  // EXEMPLO: 2A_3899204_2026-02-22
  return `${turmaUpper}_${matricula}_${data}`;
}

function renderTabela() {
  const termo = (buscarInput.value || "").trim().toLowerCase();
  const turmaSel = normalizeTurma(turmaSelect.value);

  const filtrados = alunosCarregados.filter(a => {
    if (turmaSel && normalizeTurma(a.turmaUpper || a.turma) !== turmaSel) return false;
    if (termo && !(a.nomeLower || (a.nome || "").toLowerCase()).includes(termo)) return false;
    if (somenteAtivos.checked && (a.ativo === false || (a.situacao && a.situacao !== "ativo"))) return false;
    return true;
  });

  if (!filtrados.length) {
    listaAlunos.innerHTML = `<tr><td colspan="8" class="muted">Nenhum aluno para exibir.</td></tr>`;
    return;
  }

  listaAlunos.innerHTML = filtrados.map(a => {
    const alunoId = a.id; // 🔥 id real do documento do aluno
    const presenteId = `presente_${alunoId}`;
    const faltasId = `faltas_${alunoId}`;
    const justId = `just_${alunoId}`;
    const justTxtId = `justtxt_${alunoId}`;

    return `
      <tr data-alunoid="${alunoId}">
        <td>${a.nome || ""}</td>
        <td>${normalizeTurma(a.turma || "")}</td>
        <td>${a.matricula || ""}</td>
        <td>${a.situacao || (a.ativo ? "ativo" : "inativo")}</td>
        <td><input type="checkbox" id="${presenteId}" checked></td>
        <td><input type="number" id="${faltasId}" min="0" max="10" value="0"></td>
        <td><input type="checkbox" id="${justId}"></td>
        <td><input type="text" id="${justTxtId}" placeholder="(opcional)"></td>
      </tr>
    `;
  }).join("");
}

async function carregarTurmasPermitidas() {
  // vem do dashboard.js -> localStorage
  const raw = localStorage.getItem("turmasPermitidas");
  let turmas = [];
  try { turmas = JSON.parse(raw || "[]"); } catch { turmas = []; }

  // se estiver vazio, ainda deixo um select (você pode preencher manualmente)
  turmaSelect.innerHTML = "";

  if (!turmas.length) {
    turmaSelect.innerHTML = `<option value="2A">2A</option>`;
    return;
  }

  turmas.forEach(t => {
    const tu = normalizeTurma(t);
    const opt = document.createElement("option");
    opt.value = tu;
    opt.textContent = tu;
    turmaSelect.appendChild(opt);
  });
}

async function carregarAlunosDaTurma() {
  const turmaUpper = normalizeTurma(turmaSelect.value);
  if (!turmaUpper) {
    setStatus("Selecione uma turma.", "warn");
    return;
  }

  setStatus("Carregando alunos...", "warn");
  listaAlunos.innerHTML = `<tr><td colspan="8" class="muted">Carregando alunos...</td></tr>`;

  // Consulta na coleção "alunos" filtrando por turmaUpper
  // IMPORTANTE: seus documentos de aluno devem ter campo turmaUpper: "2A"
  const ref = collection(db, "alunos");

  // Se quiser ordenar por nomeLower, garanta que existe em todos docs
  const q = query(ref, where("turmaUpper", "==", turmaUpper), orderBy("nomeLower"));

  const snap = await getDocs(q);
  alunosCarregados = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  setStatus(`Alunos carregados: ${alunosCarregados.length}`, "ok");
  renderTabela();
}

async function salvarTudo() {
  const turmaUpper = normalizeTurma(turmaSelect.value);
  const data = dataInput.value;

  if (!turmaUpper) { setStatus("Selecione a turma.", "warn"); return; }
  if (!data) { setStatus("Selecione a data.", "warn"); return; }
  if (!usuarioAtual) { setStatus("Sem usuário logado.", "bad"); return; }

  // pega linhas exibidas (ou seja, filtradas)
  const rows = Array.from(listaAlunos.querySelectorAll("tr[data-alunoid]"));
  if (!rows.length) {
    setStatus("Não há alunos na lista para salvar.", "warn");
    return;
  }

  setStatus("Salvando...", "warn");

  try {
    for (const row of rows) {
      const alunoId = row.getAttribute("data-alunoid");
      const aluno = alunosCarregados.find(a => a.id === alunoId);
      if (!aluno) continue;

      const presente = document.getElementById(`presente_${alunoId}`)?.checked ?? true;
      const faltasNoDia = Number(document.getElementById(`faltas_${alunoId}`)?.value ?? 0);
      const justificada = document.getElementById(`just_${alunoId}`)?.checked ?? false;
      const justificativa = (document.getElementById(`justtxt_${alunoId}`)?.value ?? "").trim();

      const matricula = String(aluno.matricula || "").trim();
      const nome = String(aluno.nome || "").trim();

      const docId = montarIdFrequencia(turmaUpper, matricula, data);
      const ref = doc(db, "frequencias", docId);

      // Documento de frequência
      const payload = {
        alunoId: alunoId,           // ✅ ID REAL DO DOC do aluno (ex: G8Kdjf93JdkslQ2)
        matricula: matricula,
        nome: nome,
        turma: turmaUpper,
        turmaUpper: turmaUpper,
        data: data,
        presente: !!presente,       // ✅ boolean
        faltasNoDia: Number.isFinite(faltasNoDia) ? faltasNoDia : 0,  // ✅ number
        justificada: !!justificada, // ✅ boolean
        justificativa: justificativa,
        editadoPor: usuarioAtual.uid,
        editadoEm: serverTimestamp()
      };

      // Se estiver criando a primeira vez, setDoc cria.
      // Se existir, setDoc com merge atualiza.
      await setDoc(ref, payload, { merge: true });
    }

    setStatus("Salvo com sucesso!", "ok");
  } catch (e) {
    console.error(e);
    setStatus("Erro ao salvar: " + (e?.message || e), "bad");
  }
}

function wireEvents() {
  btnCarregar.addEventListener("click", carregarAlunosDaTurma);
  btnSalvar.addEventListener("click", salvarTudo);

  somenteAtivos.addEventListener("change", renderTabela);
  buscarInput.addEventListener("input", renderTabela);
  turmaSelect.addEventListener("change", () => {
    // opcional: auto-carregar ao trocar turma
    // carregarAlunosDaTurma();
    renderTabela();
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }
  usuarioAtual = user;

  dataInput.value = hojeYYYYMMDD();

  await carregarTurmasPermitidas();
  wireEvents();

  setStatus("Selecione a turma e clique em “Carregar alunos”.", "");
});
