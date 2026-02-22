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

function normalizeTurma(s) {
  return (s ?? "").toString().trim().toUpperCase().replace(/\s+/g, "");
}

function hojeISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function labelSituacao(v) {
  if (v === "desistente") return "Desistente";
  if (v === "evadido") return "Evadido";
  return "Ativo";
}

function makeFreqId(alunoDocId, dataISO) {
  return `${alunoDocId}__${dataISO}`;
}

let CURRENT_USER = null;
let CAN_WRITE = false;

let ALUNOS = [];      // alunos carregados da turma (já filtrados)
let BUSCA = "";       // filtro de nome

async function getMyRoles(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() || {};
  return Array.isArray(data.roles) ? data.roles : [];
}

async function carregarTurmas() {
  setStatus("Carregando turmas...", "info");
  const sel = $("turmaSelect");
  sel.innerHTML = `<option value="">Carregando...</option>`;

  const snap = await getDocs(collection(db, "alunos"));
  const setTurmas = new Set();

  snap.forEach(d => {
    const a = d.data() || {};
    if (a.turma) setTurmas.add(String(a.turma));
  });

  const turmas = Array.from(setTurmas).sort((a, b) => a.localeCompare(b, "pt-BR"));
  sel.innerHTML = `<option value="">Selecione...</option>`;
  for (const t of turmas) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  }

  setStatus("Turmas carregadas ✅", "ok");
}

function renderTabela() {
  const tbody = $("lista");
  const turma = normalizeTurma($("turmaSelect").value);
  const dataISO = $("dataInput").value;

  if (!turma || !dataISO) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Selecione turma e data.</td></tr>`;
    return;
  }

  let lista = ALUNOS.slice();

  if (BUSCA.trim()) {
    const b = BUSCA.trim().toLowerCase();
    lista = lista.filter(a => (a.nome || "").toLowerCase().includes(b));
  }

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Nenhum aluno para mostrar.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(a => {
    const sit = a.situacao || "ativo";
    const matricula = a.matricula || "";
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
      </tr>
    `;
  }).join("");

  // comportamento: presente => faltas = 0 e desabilita
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
    });
  });
}

async function carregarAlunosDaTurma() {
  const turma = normalizeTurma($("turmaSelect").value);
  const dataISO = $("dataInput").value;
  const filtroSit = ($("filtroSituacao").value || "").trim().toLowerCase();

  if (!turma) return setStatus("Selecione a turma.", "err");
  if (!dataISO) return setStatus("Selecione a data.", "err");

  setStatus("Carregando alunos...", "info");
  $("subtitulo").textContent = `Turma: ${turma} | Data: ${dataISO}`;

  // Consulta por turma, ordenado por nome
  let qref = query(collection(db, "alunos"), where("turma", "==", turma), orderBy("nome"));
  const snap = await getDocs(qref);

  let all = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));

  // Aplica filtro de situação
  if (filtroSit) {
    all = all.filter(a => (a.situacao || "ativo") === filtroSit);
  } else {
    // filtroSit vazio => todos
  }

  // Por padrão (se você escolher "Somente Ativos"), já vem ativo
  ALUNOS = all;

  setStatus(`Alunos carregados: ${ALUNOS.length} ✅`, "ok");
  renderTabela();
}

function getLinha(alunoId) {
  const chk = document.querySelector(`input[data-presente="${alunoId}"]`);
  const inp = document.querySelector(`input[data-faltas="${alunoId}"]`);

  const presente = chk ? chk.checked : true;
  let faltasNoDia = inp ? Number(inp.value || "0") : 0;

  if (presente) faltasNoDia = 0;
  if (Number.isNaN(faltasNoDia)) faltasNoDia = 0;
  faltasNoDia = Math.max(0, Math.min(10, faltasNoDia));

  return { presente, faltasNoDia };
}

async function salvarTudo() {
  if (!CAN_WRITE) {
    setStatus("Seu perfil não pode salvar frequência (precisa ser admin/dot).", "err");
    return;
  }

  const turma = normalizeTurma($("turmaSelect").value);
  const dataISO = $("dataInput").value;

  if (!turma) return setStatus("Selecione a turma.", "err");
  if (!dataISO) return setStatus("Selecione a data.", "err");
  if (!ALUNOS.length) return setStatus("Carregue os alunos antes de salvar.", "err");

  setStatus("Salvando frequência...", "info");

  let ok = 0;
  for (const a of ALUNOS) {
    const { presente, faltasNoDia } = getLinha(a.id);
    const freqId = makeFreqId(a.id, dataISO);

    const payload = {
      alunoId: a.id,
      nome: a.nome || "",
      turma: a.turma || turma,
      matricula: a.matricula || "",
      situacao: a.situacao || "ativo",

      data: dataISO,
      presente,
      faltasNoDia,

      criadoPor: CURRENT_USER.uid,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "frequencias", freqId), payload, { merge: true });
      ok++;
    } catch (e) {
      console.error(e);
      setStatus("Erro salvando: " + (e.code || e.message), "err");
      return;
    }
  }

  setStatus(`Frequência salva ✅ (${ok}/${ALUNOS.length})`, "ok");
}

async function sair() {
  await signOut(auth);
  location.href = "./index.html";
}

window.addEventListener("DOMContentLoaded", () => {
  $("btnSair").addEventListener("click", sair);

  $("dataInput").value = hojeISO();

  $("btnCarregar").addEventListener("click", carregarAlunosDaTurma);
  $("btnSalvarTudo").addEventListener("click", salvarTudo);

  $("buscaInput").addEventListener("input", (e) => {
    BUSCA = e.target.value || "";
    renderTabela();
  });

  $("filtroSituacao").addEventListener("change", () => {
    // recarrega alunos com o novo filtro
    carregarAlunosDaTurma();
  });

  $("turmaSelect").addEventListener("change", () => {
    ALUNOS = [];
    renderTabela();
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.href = "./index.html";
      return;
    }

    CURRENT_USER = user;

    try {
      const roles = await getMyRoles(user.uid);
      CAN_WRITE = roles.includes("admin") || roles.includes("dot");

      setStatus(CAN_WRITE ? "Pronto ✅ (admin/dot pode salvar)" : "Pronto ✅ (somente leitura)", CAN_WRITE ? "ok" : "info");
      await carregarTurmas();
    } catch (e) {
      console.error(e);
      setStatus("Erro ao iniciar: " + (e.code || e.message), "err");
    }
  });
});
