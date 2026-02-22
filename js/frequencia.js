import { auth, db } from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const turmaSelect = document.getElementById("turmaSelect");
const dataInput = document.getElementById("dataInput");
const somenteAtivos = document.getElementById("somenteAtivos");
const buscaInput = document.getElementById("buscaInput");
const btnCarregar = document.getElementById("btnCarregar");
const btnSalvar = document.getElementById("btnSalvar");
const tbody = document.getElementById("tbody");
const statusBox = document.getElementById("statusBox");
const contador = document.getElementById("contador");

function showStatus(msg, kind = "ok") {
  statusBox.style.display = "block";
  statusBox.className = `status ${kind === "err" ? "err" : "ok"}`;
  statusBox.textContent = msg;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function turmaToUpper(turma) {
  return (turma || "").trim().toUpperCase();
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ✅ Timeout para NÃO ficar travado
async function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`TIMEOUT (${label}) após ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
}

let currentUser = null;
let roles = [];
let turmasPermitidas = [];

function isAdminOrDot() {
  return roles.includes("admin") || roles.includes("dot");
}
function isMonitorOnly() {
  return roles.includes("monitor") && !isAdminOrDot();
}

async function waitForUser() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        unsub();
        if (!u) return reject(new Error("Você não está logado. Volte e faça login."));
        resolve(u);
      },
      (e) => {
        unsub();
        reject(e);
      }
    );
  });
}

async function loadUserProfile(uid) {
  // ⚠️ se sua rules bloquear users, isso vai dar erro (e vamos ver na tela)
  const ref = doc(db, "users", uid);
  const snap = await withTimeout(getDoc(ref), 8000, "getDoc users");
  if (!snap.exists()) return {};
  return snap.data();
}

async function fillTurmasSelect() {
  if (Array.isArray(turmasPermitidas) && turmasPermitidas.length > 0) {
    turmaSelect.innerHTML = turmasPermitidas
      .map((t) => {
        const up = turmaToUpper(t);
        return `<option value="${up}">${up}</option>`;
      })
      .join("");
    return;
  }

  // fallback simples
  turmaSelect.innerHTML = `<option value="2A">2A</option>`;
}

function renderTabela(alunos) {
  tbody.innerHTML = "";
  contador.textContent = `Total: ${alunos.length}`;

  const termo = (buscaInput.value || "").trim().toLowerCase();

  alunos
    .filter((a) => !termo || (a.nome || "").toLowerCase().includes(termo))
    .forEach((a) => {
      const tr = document.createElement("tr");
      tr.dataset.alunoId = a.id;

      tr.innerHTML = `
        <td>${escapeHtml(a.nome)}</td>
        <td>${escapeHtml(a.turmaUpper)}</td>
        <td>${escapeHtml(a.matricula)}</td>
        <td>
          <select class="situacao small">
            <option value="ativo" ${a.situacao === "ativo" ? "selected" : ""}>ativo</option>
            <option value="desistente" ${a.situacao === "desistente" ? "selected" : ""}>desistente</option>
            <option value="evadido" ${a.situacao === "evadido" ? "selected" : ""}>evadido</option>
          </select>
        </td>
        <td><input class="presente" type="checkbox" checked /></td>
        <td><input class="faltas small" type="number" min="0" max="10" value="0" /></td>
        <td><input class="justificada" type="checkbox" ${isAdminOrDot() ? "" : "disabled"} /></td>
        <td><input class="justificativa" type="text" placeholder="(somente DOT/Admin)" ${isAdminOrDot() ? "" : "disabled"} style="width:240px" /></td>
      `;

      tbody.appendChild(tr);
    });
}

async function loadAlunos() {
  showStatus("Carregando alunos...", "ok");

  const turma = turmaToUpper(turmaSelect.value);
  const ativosOnly = !!somenteAtivos.checked;

  // monitor só hoje
  const data = dataInput.value || todayISO();
  if (isMonitorOnly() && data !== todayISO()) {
    throw new Error("Monitor só pode lançar frequência de HOJE.");
  }

  // ⚠️ OBRIGATÓRIO: seus alunos precisam ter turmaUpper = "2A"
  let qAlunos;
  if (ativosOnly) {
    qAlunos = query(
      collection(db, "alunos"),
      where("turmaUpper", "==", turma),
      where("ativo", "==", true),
      limit(500)
    );
  } else {
    qAlunos = query(
      collection(db, "alunos"),
      where("turmaUpper", "==", turma),
      limit(500)
    );
  }

  // ✅ se travar, vai dar timeout e mostrar o motivo
  const snap = await withTimeout(getDocs(qAlunos), 8000, "getDocs alunos");

  const alunos = [];
  snap.forEach((d) => {
    const a = d.data();
    alunos.push({
      id: d.id,
      nome: a.nome || "",
      turmaUpper: a.turmaUpper || turma,
      matricula: a.matricula || "",
      situacao: a.situacao || "ativo",
    });
  });

  alunos.sort((x, y) => (x.nome || "").localeCompare((y.nome || ""), "pt-BR"));

  renderTabela(alunos);
  showStatus(`Alunos carregados: ${alunos.length}`, "ok");
}

async function salvarTudo() {
  showStatus("Salvando frequência...", "ok");

  const turma = turmaToUpper(turmaSelect.value);
  const data = dataInput.value || todayISO();

  if (isMonitorOnly() && data !== todayISO()) {
    throw new Error("Monitor só pode lançar frequência de HOJE.");
  }

  const rows = [...tbody.querySelectorAll("tr")];
  if (rows.length === 0) throw new Error("Nenhum aluno carregado. Clique em 'Carregar alunos'.");

  for (const tr of rows) {
    const alunoId = tr.dataset.alunoId;

    const nome = tr.children[0].textContent || "";
    const turmaUpper = tr.children[1].textContent || turma;
    const matricula = tr.children[2].textContent || "";

    const situacao = tr.querySelector(".situacao")?.value || "ativo";
    const presente = !!tr.querySelector(".presente")?.checked;

    const faltasNoDiaRaw = tr.querySelector(".faltas")?.value;
    const faltasNoDia = Math.max(0, Math.min(10, Number(faltasNoDiaRaw || 0)));

    const justificada = isAdminOrDot() ? !!tr.querySelector(".justificada")?.checked : false;
    const justificativa = isAdminOrDot() ? (tr.querySelector(".justificativa")?.value || "") : "";

    const docId = `${turmaUpper}_${data}_${alunoId}`;

    await withTimeout(
      setDoc(
        doc(db, "frequencias", docId),
        {
          alunoId,
          nome,
          turma: turmaUpper,
          turmaUpper,
          matricula,

          data,
          presente,
          faltasNoDia,

          justificada,
          justificativa,

          situacao,

          criadoPor: currentUser.uid,
          criadoEm: serverTimestamp(),
          editadoPor: currentUser.uid,
          editadoEm: serverTimestamp(),
        },
        { merge: true }
      ),
      8000,
      "setDoc frequencias"
    );
  }

  showStatus(`Frequência salva com sucesso para ${turma} em ${data}.`, "ok");
}

async function boot() {
  dataInput.value = todayISO();

  showStatus("Iniciando…", "ok");

  currentUser = await waitForUser();
  showStatus("Logado. Carregando perfil…", "ok");

  const profile = await loadUserProfile(currentUser.uid);

  if (Array.isArray(profile.roles)) roles = profile.roles.map(String);
  else if (typeof profile.roles === "string") roles = profile.roles.split(",").map(s => s.trim()).filter(Boolean);
  else if (typeof profile.role === "string") roles = profile.role.split(",").map(s => s.trim()).filter(Boolean);
  else roles = [];

  turmasPermitidas = Array.isArray(profile.turmasPermitidas) ? profile.turmasPermitidas.map(turmaToUpper) : [];

  await fillTurmasSelect();

  btnCarregar.addEventListener("click", async () => {
    try {
      await loadAlunos();
    } catch (e) {
      console.error(e);
      showStatus(`ERRO ao carregar alunos:\n${e.message || e}`, "err");
    }
  });

  btnSalvar.addEventListener("click", async () => {
    try {
      await salvarTudo();
    } catch (e) {
      console.error(e);
      showStatus(`ERRO ao salvar:\n${e.message || e}`, "err");
    }
  });

  showStatus("Pronto. Clique em 'Carregar alunos'.", "ok");
}

boot().catch((e) => {
  console.error(e);
  showStatus(`ERRO ao iniciar:\n${e.message || e}`, "err");
});
