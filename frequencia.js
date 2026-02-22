import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id) { return document.getElementById(id); }

function setStatus(msg, kind = "info") {
  const el = $("status");
  if (!el) return;
  el.textContent = msg;
  el.className = `msg ${kind}`;
  console.log(msg);
}

function esc(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isoFromDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function hojeISO() { return isoFromDate(new Date()); }
function ontemISO() { const d = new Date(); d.setDate(d.getDate() - 1); return isoFromDate(d); }

function labelSituacao(v) {
  const s = (v ?? "ativo").toString().trim().toLowerCase();
  if (s === "desistente") return "Desistente";
  if (s === "evadido") return "Evadido";
  return "Ativo";
}

function normSituacao(v) {
  const s = (v ?? "ativo").toString().trim().toLowerCase();
  if (s === "desistente") return "desistente";
  if (s === "evadido") return "evadido";
  return "ativo";
}

function makeFreqId(alunoDocId, dataISO) {
  return `${alunoDocId}__${dataISO}`;
}

function labelJust(j) {
  if (!j || !j.status) return "—";
  const tipo = j.tipo ? ` (${j.tipo})` : "";
  return j.status === "justificada" ? `✅ Justificada${tipo}` : "—";
}

let CURRENT_USER = null;

// Permissões
let ROLES = [];
let CAN_INSERT = false;   // monitor/dot/admin
let CAN_EDIT = false;     // dot/admin
let CAN_JUSTIFY = false;  // dot/admin
let IS_MONITOR = false;

let ALUNOS = [];
let BUSCA = "";

// Cache local das frequências carregadas (por alunoId)
let FREQ_BY_ALUNO = new Map();

async function getMyRoles(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() || {};
  return Array.isArray(data.roles) ? data.roles : [];
}

function refreshPermissoesUI() {
  const parts = [];
  parts.push(`Perfis: ${ROLES.length ? ROLES.join(", ") : "(nenhum)"}`);
  parts.push(CAN_EDIT ? "Edição: ✅" : "Edição: ❌");
  parts.push(CAN_JUSTIFY ? "Justificar: ✅" : "Justificar: ❌");
  parts.push(CAN_INSERT ? "Lançar: ✅" : "Lançar: ❌");
  $("permissoes").textContent = parts.join(" | ");
}

async function carregarTurmas() {
  setStatus("Carregando turmas...", "info");
  const sel = $("turmaSelect");
  sel.innerHTML = `<option value="">Carregando...</option>`;

  // Pega turmas existentes a partir dos alunos cadastrados
  const snap = await getDocs(collection(db, "alunos"));
  const setTurmas = new Set();

  snap.forEach(d => {
    const a = d.data() || {};
    if (a.turma) setTurmas.add(String(a.turma)); // NÃO normaliza aqui
  });

  const turmas = Array.from(setTurmas).sort((a, b) => a.localeCompare(b, "pt-BR"));

  sel.innerHTML = `<option value="">Selecione...</option>`;
  for (const t of turmas) {
    const opt = document.createElement("option");
    opt.value = t;        // valor EXATO do Firestore
    opt.textContent = t;
    sel.appendChild(opt);
  }

  setStatus(`Turmas carregadas ✅ (${turmas.length})`, "ok");
}

function getLinhaUI(alunoId) {
  const chk = document.querySelector(`input[data-presente="${alunoId}"]`);
  const inp = document.querySelector(`input[data-faltas="${alunoId}"]`);

  const presente = chk ? chk.checked : true;
  let faltasNoDia = inp ? Number(inp.value || "0") : 0;

  if (presente) faltasNoDia = 0;
  if (Number.isNaN(faltasNoDia)) faltasNoDia = 0;
  faltasNoDia = Math.max(0, Math.min(10, faltasNoDia));

  return { presente, faltasNoDia };
}

function setLinhaUI(alunoId, presente, faltasNoDia) {
  const chk = document.querySelector(`input[data-presente="${alunoId}"]`);
  const inp = document.querySelector(`input[data-faltas="${alunoId}"]`);

  if (chk) chk.checked = !!presente;
  if (inp) {
    const faltas = Number.isNaN(Number(faltasNoDia)) ? 0 : Number(faltasNoDia);
    inp.value = String(Math.max(0, Math.min(10, faltas)));
    inp.disabled = !!presente;
  }
}

function updateJustUI(alunoId) {
  const jEl = document.querySelector(`[data-justlabel="${alunoId}"]`);
  const freq = FREQ_BY_ALUNO.get(alunoId) || null;
  const j = freq?.justificativa || null;
  if (jEl) jEl.textContent = labelJust(j);

  const btn = document.querySelector(`button[data-justbtn="${alunoId}"]`);
  if (!btn) return;

  const { presente, faltasNoDia } = getLinhaUI(alunoId);
  const podeMostrar = CAN_JUSTIFY && !presente && faltasNoDia > 0;

  btn.disabled = !podeMostrar;
  btn.title = podeMostrar ? "Justificar falta" : "Só DOT/Admin, com falta marcada";
}

function renderTabela() {
  const tbody = $("lista");
  const turma = $("turmaSelect").value;  // EXATO (sem normalizar)
  const dataISO = $("dataInput").value;

  if (!turma || !dataISO) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Selecione turma e data.</td></tr>`;
    return;
  }

  let lista = ALUNOS.slice();

  if (BUSCA.trim()) {
    const b = BUSCA.trim().toLowerCase();
    lista = lista.filter(a => (a.nome || "").toLowerCase().includes(b));
  }

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Nenhum aluno para mostrar.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(a => {
    const sit = normSituacao(a.situacao);
    const matricula = a.matricula || "";
    const freq = FREQ_BY_ALUNO.get(a.id) || null;
    const j = freq?.justificativa || null;

    return `
      <tr>
        <td><b>${esc(a.nome || "")}</b></td>
        <td>${esc(a.turma || turma)}</td>
        <td>${esc(matricula)}</td>
        <td>${esc(labelSituacao(sit))}</td>

        <td>
          <input type="checkbox" data-presente="${esc(a.id)}" checked />
        </td>

        <td>
          <input type="number" min="0" max="10" value="0" data-faltas="${esc(a.id)}" disabled style="width:90px" />
        </td>

        <td>
          <span data-justlabel="${esc(a.id)}">${esc(labelJust(j))}</span>
        </td>

        <td>
          <button class="btn" data-justbtn="${esc(a.id)}">Justificar</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("input[type=checkbox][data-presente]").forEach(chk => {
    chk.addEventListener("change", () => {
      const alunoId = chk.getAttribute("data-presente");
      const faltas = document.querySelector(`input[data-faltas="${alunoId}"]`);
      if (!faltas) return;

      if (chk.checked) {
        faltas.value = "0";
        faltas.disabled = true;
      } else {
        faltas.disabled = false;
        if (faltas.value === "0") faltas.value = "1";
      }
      updateJustUI(alunoId);
    });
  });

  tbody.querySelectorAll("input[type=number][data-faltas]").forEach(inp => {
    inp.addEventListener("input", () => {
      const alunoId = inp.getAttribute("data-faltas");
      updateJustUI(alunoId);
    });
  });

  tbody.querySelectorAll("button[data-justbtn]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const alunoId = btn.getAttribute("data-justbtn");
      await justificarFalta(alunoId);
    });
  });

  // Aplica valores carregados do Firestore (se existirem)
  for (const a of lista) {
    const freq = FREQ_BY_ALUNO.get(a.id);
    if (freq) setLinhaUI(a.id, !!freq.presente, Number(freq.faltasNoDia || 0));
    updateJustUI(a.id);
  }
}

async function carregarAlunosDaTurma() {
  const turma = $("turmaSelect").value;   // EXATO
  const dataISO = $("dataInput").value;
  const filtroSit = ($("filtroSituacao").value || "").trim().toLowerCase();

  if (!turma) return setStatus("Selecione a turma.", "err");
  if (!dataISO) return setStatus("Selecione a data.", "err");

  setStatus("Carregando alunos...", "info");
  $("subtitulo").textContent = `Turma: ${turma} | Data: ${dataISO}`;

  try {
    // IMPORTANTE: consulta por turma exata
    const qref = query(
      collection(db, "alunos"),
      where("turma", "==", turma),
      orderBy("nome")
    );

    const snap = await getDocs(qref);
    let all = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));

    // filtro de situação robusto (aceita "Ativo", "ativo", vazio)
    if (filtroSit) {
      all = all.filter(a => normSituacao(a.situacao) === filtroSit);
    }

    ALUNOS = all;

    // Carregar frequências existentes para esta data
    FREQ_BY_ALUNO = new Map();
    let existentes = 0;

    for (const a of ALUNOS) {
      const fid = makeFreqId(a.id, dataISO);
      const fsnap = await getDoc(doc(db, "frequencias", fid));
      if (fsnap.exists()) {
        FREQ_BY_ALUNO.set(a.id, { id: fid, ...(fsnap.data() || {}) });
        existentes++;
      }
    }

    setStatus(`Alunos: ${ALUNOS.length} | Frequências nessa data: ${existentes} ✅`, "ok");
    renderTabela();
  } catch (e) {
    console.error(e);
    setStatus("Erro ao carregar alunos: " + (e.code || e.message), "err");
  }
}

function hasExistingForSomeone() {
  return FREQ_BY_ALUNO && FREQ_BY_ALUNO.size > 0;
}

function isDateTodaySelected() {
  return ($("dataInput").value || "") === hojeISO();
}

function canMonitorSaveNow() {
  if (!IS_MONITOR) return true;
  if (!isDateTodaySelected()) return false;
  if (hasExistingForSomeone()) return false;
  return true;
}

async function salvarTudo() {
  if (!CAN_INSERT) return setStatus("Seu perfil não pode lançar frequência.", "err");

  const turma = $("turmaSelect").value; // EXATO
  const dataISO = $("dataInput").value;

  if (!turma) return setStatus("Selecione a turma.", "err");
  if (!dataISO) return setStatus("Selecione a data.", "err");
  if (!ALUNOS.length) return setStatus("Carregue os alunos antes de salvar.", "err");

  if (!canMonitorSaveNow()) {
    return setStatus("Monitor só pode lançar frequência de HOJE e apenas se não existir lançamento para essa data.", "err");
  }

  if (hasExistingForSomeone() && !CAN_EDIT) {
    return setStatus("Somente DOT/Admin podem editar frequência já lançada.", "err");
  }

  setStatus("Salvando frequência...", "info");

  let ok = 0;
  for (const a of ALUNOS) {
    const { presente, faltasNoDia } = getLinhaUI(a.id);
    const freqId = makeFreqId(a.id, dataISO);

    const existed = FREQ_BY_ALUNO.has(a.id);
    if (existed && !CAN_EDIT) continue;

    const old = FREQ_BY_ALUNO.get(a.id) || null;
    const justificativa = old?.justificativa || null;

    const payload = {
      alunoId: a.id,
      nome: a.nome || "",
      turma: a.turma || turma,
      matricula: a.matricula || "",
      situacao: normSituacao(a.situacao),

      data: dataISO,
      presente,
      faltasNoDia,

      justificativa: justificativa || null,

      criadoPor: old?.criadoPor || CURRENT_USER.uid,
      criadoEm: old?.criadoEm || serverTimestamp(),
      atualizadoPor: CURRENT_USER.uid,
      atualizadoEm: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "frequencias", freqId), payload, { merge: true });
      ok++;
      FREQ_BY_ALUNO.set(a.id, { id: freqId, ...payload });
    } catch (e) {
      console.error(e);
      return setStatus("Erro salvando: " + (e.code || e.message), "err");
    }
  }

  setStatus(`Frequência salva ✅ (${ok}/${ALUNOS.length})`, "ok");
  renderTabela();
}

async function justificarFalta(alunoId) {
  if (!CAN_JUSTIFY) return setStatus("Somente DOT/Admin podem justificar faltas.", "err");

  const turma = $("turmaSelect").value;
  const dataISO = $("dataInput").value;
  if (!turma || !dataISO) return setStatus("Selecione turma e data.", "err");

  const { presente, faltasNoDia } = getLinhaUI(alunoId);
  if (presente || faltasNoDia <= 0) return setStatus("Para justificar, o aluno precisa estar ausente e ter faltas > 0.", "err");

  const tipo = prompt("Tipo de comprovação (ex.: Atestado médico, Declaração, Outro):", "Atestado médico");
  if (tipo === null) return;

  const motivo = prompt("Motivo/observação (obrigatório). Ex.: apresentou atestado, consulta, etc.:", "");
  if (motivo === null) return;
  if (!motivo.trim()) return setStatus("Motivo é obrigatório para justificar.", "err");

  const aluno = ALUNOS.find(a => a.id === alunoId);
  if (!aluno) return setStatus("Aluno não encontrado na lista.", "err");

  const freqId = makeFreqId(alunoId, dataISO);
  const old = FREQ_BY_ALUNO.get(alunoId) || null;

  const justificativa = {
    status: "justificada",
    tipo: (tipo || "").trim(),
    motivo: motivo.trim(),
    justificadoPor: CURRENT_USER.uid,
    justificadoEm: serverTimestamp(),
  };

  const payload = {
    alunoId,
    nome: aluno?.nome || "",
    turma: aluno?.turma || turma,
    matricula: aluno?.matricula || "",
    situacao: normSituacao(aluno?.situacao),

    data: dataISO,
    presente: false,
    faltasNoDia,

    justificativa,

    criadoPor: old?.criadoPor || CURRENT_USER.uid,
    criadoEm: old?.criadoEm || serverTimestamp(),
    atualizadoPor: CURRENT_USER.uid,
    atualizadoEm: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, "frequencias", freqId), payload, { merge: true });
    FREQ_BY_ALUNO.set(alunoId, { id: freqId, ...payload });
    setStatus(`Falta justificada ✅ (${aluno?.nome || alunoId})`, "ok");
    renderTabela();
  } catch (e) {
    console.error(e);
    setStatus("Erro justificando: " + (e.code || e.message), "err");
  }
}

async function sair() {
  await signOut(auth);
  location.href = "./index.html";
}

window.addEventListener("DOMContentLoaded", () => {
  $("btnSair").addEventListener("click", sair);

  if (!$("dataInput").value) $("dataInput").value = hojeISO();

  $("btnOntem").addEventListener("click", () => { $("dataInput").value = ontemISO(); });
  $("btnHoje").addEventListener("click", () => { $("dataInput").value = hojeISO(); });

  $("btnCarregar").addEventListener("click", carregarAlunosDaTurma);
  $("btnSalvarTudo").addEventListener("click", salvarTudo);

  $("buscaInput").addEventListener("input", (e) => {
    BUSCA = e.target.value || "";
    renderTabela();
  });

  $("filtroSituacao").addEventListener("change", () => { carregarAlunosDaTurma(); });

  $("turmaSelect").addEventListener("change", () => {
    ALUNOS = [];
    FREQ_BY_ALUNO = new Map();
    renderTabela();
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) return (location.href = "./index.html");

    CURRENT_USER = user;

    try {
      ROLES = await getMyRoles(user.uid);

      IS_MONITOR = ROLES.includes("monitor");
      CAN_INSERT = ROLES.includes("admin") || ROLES.includes("dot") || ROLES.includes("monitor");
      CAN_EDIT = ROLES.includes("admin") || ROLES.includes("dot");
      CAN_JUSTIFY = ROLES.includes("admin") || ROLES.includes("dot");

      refreshPermissoesUI();

      setStatus("Pronto ✅", "ok");
      await carregarTurmas();
      renderTabela();
    } catch (e) {
      console.error(e);
      setStatus("Erro ao iniciar: " + (e.code || e.message), "err");
    }
  });
});
