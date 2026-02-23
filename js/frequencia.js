// /js/frequencia.js
import { requireAuth, bindLogout } from "./auth.js";
import { auth, db, fb } from "./firebase.js";

requireAuth("index.html");
bindLogout("btnSair", "index.html");

const selTurma = document.getElementById("selTurma");
const inpData = document.getElementById("inpData");
const btnCarregar = document.getElementById("btnCarregar");
const btnSalvar = document.getElementById("btnSalvar");
const inpBusca = document.getElementById("inpBusca");
const tbodyFreq = document.getElementById("tbodyFreq");
const freqStatus = document.getElementById("freqStatus");

let alunos = []; // alunos carregados (docs)

function setStatus(msg, kind="") {
  freqStatus.textContent = msg || "";
  freqStatus.className = "status " + (kind || "");
}

function hoje() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function normTurma(t){ return (t||"").trim().toUpperCase(); }
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function carregarTurmasPermitidas() {
  const raw = localStorage.getItem("turmasPermitidas");
  let turmas = [];
  try { turmas = JSON.parse(raw || "[]"); } catch { turmas = []; }

  selTurma.innerHTML = "";

  if (!turmas.length) {
    // fallback: permite digitar manualmente depois (mas aqui uso 2A como padrão)
    const opt = document.createElement("option");
    opt.value = "2A";
    opt.textContent = "2A";
    selTurma.appendChild(opt);
    return;
  }

  turmas.forEach(t => {
    const tu = normTurma(t);
    const opt = document.createElement("option");
    opt.value = tu;
    opt.textContent = tu;
    selTurma.appendChild(opt);
  });
}

async function carregarAlunos() {
  const turma = normTurma(selTurma.value);
  if (!turma) { setStatus("Selecione uma turma.", "warn"); return; }

  setStatus("Carregando alunos...", "warn");
  tbodyFreq.innerHTML = `<tr><td colspan="6" class="muted">Carregando alunos...</td></tr>`;
  alunos = [];

  try {
    // Busca por turmaUpper e ordena por nomeLower
    const ref = fb.collection(db, "alunos");
    const q = fb.query(ref, fb.where("turmaUpper", "==", turma), fb.orderBy("nomeLower"));
    const snap = await fb.getDocs(q);

    if (snap.empty) {
      tbodyFreq.innerHTML = `<tr><td colspan="6" class="muted">Nenhum aluno encontrado em "alunos" para turma ${escapeHtml(turma)}. Verifique se os docs têm turmaUpper e nomeLower.</td></tr>`;
      setStatus("Nenhum aluno encontrado.", "warn");
      return;
    }

    snap.forEach(d => alunos.push({ id: d.id, ...d.data() }));

    setStatus(`Alunos carregados: ${alunos.length}`, "ok");
    renderTabela();
  } catch (e) {
    console.error(e);
    setStatus("Erro ao carregar: " + (e?.code || e?.message || e), "bad");
    tbodyFreq.innerHTML = `<tr><td colspan="6" class="muted">Erro: ${escapeHtml(e?.code || e?.message || String(e))}</td></tr>`;
  }
}

function renderTabela() {
  const termo = (inpBusca.value || "").trim().toLowerCase();
  const lista = termo ? alunos.filter(a => (a.nomeLower || (a.nome||"").toLowerCase()).includes(termo)) : alunos;

  if (!lista.length) {
    tbodyFreq.innerHTML = `<tr><td colspan="6" class="muted">Nenhum aluno corresponde à busca.</td></tr>`;
    return;
  }

  tbodyFreq.innerHTML = lista.map(a => {
    const aid = a.id;
    return `
      <tr data-aid="${aid}">
        <td>${escapeHtml(a.nome || "")}</td>
        <td>${escapeHtml(String(a.matricula || ""))}</td>
        <td><input type="checkbox" id="pres_${aid}" checked></td>
        <td><input type="number" id="falt_${aid}" min="0" max="10" value="0" style="width:90px"></td>
        <td><input type="checkbox" id="jus_${aid}"></td>
        <td><input type="text" id="justxt_${aid}" placeholder="(opcional)" style="width:240px"></td>
      </tr>
    `;
  }).join("");
}

async function salvarTudo() {
  const turma = normTurma(selTurma.value);
  const data = inpData.value;

  if (!turma) { setStatus("Selecione turma.", "warn"); return; }
  if (!data) { setStatus("Selecione data.", "warn"); return; }
  if (!alunos.length) { setStatus("Carregue alunos antes de salvar.", "warn"); return; }

  setStatus("Salvando frequência...", "warn");

  try {
    for (const a of alunos) {
      const aid = a.id;
      const presente = document.getElementById(`pres_${aid}`)?.checked ?? true;
      const faltasNoDia = Number(document.getElementById(`falt_${aid}`)?.value ?? 0);
      const justificada = document.getElementById(`jus_${aid}`)?.checked ?? false;
      const justificativa = (document.getElementById(`justxt_${aid}`)?.value ?? "").trim();

      // docId único por aluno+data (com matrícula se existir)
      const mat = String(a.matricula || aid).trim();
      const docId = `${turma}_${mat}_${data}`;

      await fb.setDoc(fb.doc(db, "frequencias", docId), {
        alunoId: aid,
        nome: a.nome || "",
        matricula: a.matricula || "",
        turma,
        turmaUpper: turma,
        data,
        presente: !!presente,
        faltasNoDia: Number.isFinite(faltasNoDia) ? faltasNoDia : 0,
        justificada: !!justificada,
        justificativa,
        editadoPor: auth.currentUser.uid,
        editadoEm: fb.serverTimestamp()
      }, { merge: true });
    }

    setStatus("Frequência salva com sucesso!", "ok");
  } catch (e) {
    console.error(e);
    setStatus("Erro ao salvar: " + (e?.code || e?.message || e), "bad");
  }
}

btnCarregar.addEventListener("click", carregarAlunos);
btnSalvar.addEventListener("click", salvarTudo);
inpBusca.addEventListener("input", renderTabela);

// iniciar
inpData.value = hoje();
await carregarTurmasPermitidas();
setStatus("Selecione turma e clique em “Carregar alunos”.", "");
