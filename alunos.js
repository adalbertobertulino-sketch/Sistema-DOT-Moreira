import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

function setStatus(msg, kind="info"){
  const el = $("status");
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

function normalizeText(s) {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function onlyDigits(s){ return (s ?? "").toString().replace(/\D+/g, ""); }

function normSituacao(v) {
  const s = (v ?? "ativo").toString().trim().toLowerCase();
  if (s === "desistente") return "desistente";
  if (s === "evadido") return "evadido";
  return "ativo";
}

/**
 * ID ÚNICO:
 * - com matrícula: TURMA__M__MATRICULA
 * - sem matrícula: TURMA__N__NOME_NORMALIZADO
 */
function buildAlunoId({ turma, matricula, nome }) {
  const t = (turma ?? "").toString().trim().toUpperCase();
  const m = onlyDigits(matricula);
  if (m) return `${t}__M__${m}`;
  const n = normalizeText(nome).replace(/\s+/g, "_");
  return `${t}__N__${n}`;
}

let CURRENT_USER = null;
let ROLES = [];
let TURMAS_PERMITIDAS = [];
let CAN_WRITE = false;

let ALUNOS = []; // cache

async function getMyUserDoc(uid){
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : {};
}

function preencherSelectTurmas(selectEl, turmas, incluirTodas=false){
  selectEl.innerHTML = "";
  if (incluirTodas) {
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "Todas";
    selectEl.appendChild(optAll);
  } else {
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Selecione...";
    selectEl.appendChild(opt0);
  }

  turmas.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    selectEl.appendChild(opt);
  });

  // Se só tem uma turma permitida, já seleciona automaticamente
  if (!incluirTodas && turmas.length === 1) selectEl.value = turmas[0];
}

async function carregarLista() {
  const filtroTurma = $("filtroTurma").value; // "" = todas (mas dentro das permitidas)
  const filtroSit = ($("filtroSituacao").value || "").trim().toLowerCase();
  const busca = ($("busca").value || "").trim().toLowerCase();

  setStatus("Carregando alunos...", "info");
  $("lista").innerHTML = `<tr><td colspan="5" class="muted">Carregando...</td></tr>`;

  try {
    // Carregar alunos de turmas permitidas:
    // Como Firestore tem limite pra "IN", a gente consulta por turma quando precisar.
    // Se filtroTurma definido: 1 consulta.
    // Se "todas": faz 1 consulta por turma permitida e concatena.
    let results = [];

    const turmasAlvo = filtroTurma ? [filtroTurma] : TURMAS_PERMITIDAS.slice();

    for (const t of turmasAlvo) {
      const qref = query(collection(db, "alunos"), where("turmaUpper", "==", t), orderBy("nome"));
      const snap = await getDocs(qref);
      snap.forEach(d => results.push({ id: d.id, ...(d.data() || {}) }));
    }

    // filtros locais
    if (filtroSit) results = results.filter(a => normSituacao(a.situacao) === filtroSit);
    if (busca) results = results.filter(a => (a.nome || "").toLowerCase().includes(busca));

    ALUNOS = results;
    renderTabela();

    setStatus(`Alunos carregados ✅ (${ALUNOS.length})`, "ok");
  } catch (e) {
    console.error(e);
    setStatus("Erro ao carregar alunos: " + (e.code || e.message), "err");
  }
}

function renderTabela() {
  const tbody = $("lista");

  if (!ALUNOS.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Nenhum aluno encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = ALUNOS.map(a => {
    const sit = normSituacao(a.situacao);

    return `
      <tr>
        <td>${esc(a.nome || "")}</td>
        <td>${esc(a.turmaUpper || a.turma || "")}</td>
        <td>${esc(a.matricula || "")}</td>
        <td>${esc(sit)}</td>
        <td>
          <select data-action="situacao" data-id="${esc(a.id)}" ${CAN_WRITE ? "" : "disabled"}>
            <option value="ativo" ${sit==="ativo"?"selected":""}>Ativo</option>
            <option value="desistente" ${sit==="desistente"?"selected":""}>Desistente</option>
            <option value="evadido" ${sit==="evadido"?"selected":""}>Evadido</option>
          </select>
        </td>
      </tr>
    `;
  }).join("");
}

async function salvarAluno() {
  if (!CAN_WRITE) {
    setStatus("Seu perfil não pode cadastrar alunos.", "err");
    return;
  }

  const nome = ($("nome").value || "").trim();
  const turma = ($("turma").value || "").trim(); // turmaUpper (permitida)
  const matricula = ($("matricula").value || "").trim();
  const situacao = normSituacao($("situacao").value);

  if (!nome || !turma) {
    setStatus("Preencha NOME e TURMA.", "err");
    return;
  }

  if (!TURMAS_PERMITIDAS.includes(turma)) {
    setStatus("Você não tem permissão para cadastrar nessa turma.", "err");
    return;
  }

  const alunoId = buildAlunoId({ turma, matricula, nome });
  const ref = doc(db, "alunos", alunoId);

  setStatus("Salvando (anti-duplicado)...", "info");

  try {
    const existente = await getDoc(ref);
    if (existente.exists()) {
      const ok = confirm("Esse aluno já existe nessa turma (matrícula/nome). Quer ATUALIZAR em vez de duplicar?");
      if (!ok) {
        setStatus("Cancelado para evitar duplicado.", "info");
        return;
      }
    }

    await setDoc(ref, {
      nome,
      turmaUpper: turma,         // PADRÃO sem °/º (ex.: 2A)
      turma: turma,              // pode manter igual para exibir
      matricula: onlyDigits(matricula) || "",
      situacao,

      nomeLower: normalizeText(nome),

      criadoPor: CURRENT_USER.uid,
      criadoEm: existente.exists() ? (existente.data()?.criadoEm || serverTimestamp()) : serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    }, { merge: true });

    $("nome").value = "";
    $("matricula").value = "";
    $("situacao").value = "ativo";

    setStatus(existente.exists() ? "Aluno atualizado ✅" : "Aluno cadastrado ✅", "ok");
    await carregarLista();
  } catch (e) {
    console.error(e);
    setStatus("Erro ao salvar aluno: " + (e.code || e.message), "err");
  }
}

async function atualizarSituacao(alunoId, novaSit) {
  if (!CAN_WRITE) return;

  const sit = normSituacao(novaSit);
  setStatus("Atualizando situação...", "info");

  try {
    await updateDoc(doc(db, "alunos", alunoId), {
      situacao: sit,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: CURRENT_USER.uid,
    });
    setStatus("Situação atualizada ✅", "ok");
  } catch (e) {
    console.error(e);
    setStatus("Erro ao atualizar situação: " + (e.code || e.message), "err");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  $("btnSair")?.addEventListener("click", async () => {
    await signOut(auth);
    location.href = "./index.html";
  });

  $("btnSalvar")?.addEventListener("click", salvarAluno);
  $("btnRecarregar")?.addEventListener("click", carregarLista);

  $("busca")?.addEventListener("input", () => {
    // não recarrega do banco, só filtra local => rápido
    renderTabela();
  });

  $("filtroSituacao")?.addEventListener("change", () => carregarLista());
  $("filtroTurma")?.addEventListener("change", () => carregarLista());

  $("lista")?.addEventListener("change", async (ev) => {
    const el = ev.target;
    if (!el) return;
    const action = el.getAttribute("data-action");
    const id = el.getAttribute("data-id");
    if (action === "situacao" && id) {
      await atualizarSituacao(id, el.value);
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.href = "./index.html";
      return;
    }

    CURRENT_USER = user;

    const userDoc = await getMyUserDoc(user.uid);
    ROLES = userDoc.roles || [];
    TURMAS_PERMITIDAS = (userDoc.turmasPermitidas || []).map(t => String(t).trim().toUpperCase());

    CAN_WRITE = ROLES.includes("admin") || ROLES.includes("dot");

    if (!TURMAS_PERMITIDAS.length) {
      setStatus("Sem turmasPermitidas no seu usuário. Adicione em users/SEU_UID.", "err");
      preencherSelectTurmas($("turma"), []);
      preencherSelectTurmas($("filtroTurma"), [], true);
      return;
    }

    preencherSelectTurmas($("turma"), TURMAS_PERMITIDAS, false);
    preencherSelectTurmas($("filtroTurma"), TURMAS_PERMITIDAS, true);

    setStatus("Pronto ✅", "ok");
    await carregarLista();
  });
});
