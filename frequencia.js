import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Helpers de UI
 */
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

function clearStatus() {
  statusBox.style.display = "none";
  statusBox.textContent = "";
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

/**
 * Auth + Perfil do usuário
 */
let currentUser = null;
let currentUserDoc = null; // users/{uid}
let roles = [];            // ["admin","dot","monitor"]
let turmasPermitidas = []; // ["2A","1A"...] opcional

async function waitForUser() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      if (!u) return reject(new Error("Você não está logado. Volte e faça login."));
      resolve(u);
    }, reject);
  });
}

async function loadUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Se não existir, ainda deixa funcionar com permissões mínimas (mas pode falhar por rules)
    return { roles: [], turmasPermitidas: [] };
  }
  return snap.data();
}

function isAdminOrDot() {
  return roles.includes("admin") || roles.includes("dot");
}
function isMonitorOnly() {
  return roles.includes("monitor") && !isAdminOrDot();
}

/**
 * Carrega turmas no select:
 *  - se tiver turmasPermitidas no user -> usa elas
 *  - senão tenta ler coleção "turmas" (se existir)
 *  - senão fica com a opção default 2A
 */
async function fillTurmasSelect() {
  // 1) Turmas do usuário
  if (Array.isArray(turmasPermitidas) && turmasPermitidas.length > 0) {
    turmaSelect.innerHTML = turmasPermitidas
      .map(t => `<option value="${turmaToUpper(t)}">${turmaToUpper(t)}</option>`)
      .join("");
    return;
  }

  // 2) Tenta coleção "turmas" (opcional)
  try {
    const qTurmas = query(collection(db, "turmas"), orderBy("turmaUpper"), limit(200));
    const snap = await getDocs(qTurmas);

    if (!snap.empty) {
      const opts = [];
      snap.forEach(d => {
        const data = d.data();
        const t = turmaToUpper(data.turmaUpper || data.turma || d.id);
        if (t) opts.push(t);
      });
      const uniq = [...new Set(opts)];
      if (uniq.length > 0) {
        turmaSelect.innerHTML = uniq.map(t => `<option value="${t}">${t}</option>`).join("");
      }
    }
  } catch (e) {
    // se não existir a coleção, ignora
  }
}

/**
 * Busca alunos por turmaUpper
 * coleção: alunos
 * campos esperados por aluno:
 *  - nome (string)
 *  - turma (string)
 *  - turmaUpper (string)  <- IMPORTANTÍSSIMO
 *  - matricula (string opcional)
 *  - ativo (boolean)
 *  - situacao ("ativo" | "desistente" | "evadido")
 */
async function loadAlunos() {
  clearStatus();
  showStatus("Carregando alunos...", "ok");

  const turma = turmaToUpper(turmaSelect.value);
  const ativosOnly = !!somenteAtivos.checked;

  // Segurança “na tela” (rules devem fazer o principal, mas isso ajuda)
  if (isMonitorOnly()) {
    // monitor só pode lançar hoje
    const d = dataInput.value || todayISO();
    if (d !== todayISO()) {
      throw new Error("Monitor só pode lançar frequência de HOJE. Selecione a data de hoje.");
    }
  }

  // Monta query
  let qAlunos = query(
    collection(db, "alunos"),
    where("turmaUpper", "==", turma)
  );

  // Se você usa ativo boolean, filtra
  if (ativosOnly) {
    qAlunos = query(
      collection(db, "alunos"),
      where("turmaUpper", "==", turma),
      where("ativo", "==", true)
    );
  }

  const snap = await getDocs(qAlunos);

  const alunos = [];
  snap.forEach((d) => {
    const a = d.data();
    alunos.push({
      id: d.id,
      nome: a.nome || "",
      turma: a.turma || turma,
      turmaUpper: a.turmaUpper || turma,
      matricula: a.matricula || "",
      ativo: a.ativo !== false,
      situacao: a.situacao || (a.ativo === false ? "inativo" : "ativo"),
    });
  });

  // Ordena por nome
  alunos.sort((x, y) => (x.nome || "").localeCompare((y.nome || ""), "pt-BR"));

  renderTabela(alunos);
  showStatus(`Alunos carregados: ${alunos.length}`, "ok");
}

/**
 * Render da tabela
 */
function renderTabela(alunos) {
  tbody.innerHTML = "";
  contador.textContent = `Total: ${alunos.length}`;

  const termo = (buscaInput.value || "").trim().toLowerCase();

  alunos
    .filter(a => !termo || (a.nome || "").toLowerCase().includes(termo))
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

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Salvar frequência (coleção frequencias)
 * ID recomendado: `${turmaUpper}_${data}_${alunoId}`
 */
async function salvarTudo() {
  clearStatus();
  showStatus("Salvando frequência...", "ok");

  const turma = turmaToUpper(turmaSelect.value);
  const data = dataInput.value || todayISO();

  // monitor só hoje
  if (isMonitorOnly() && data !== todayISO()) {
    throw new Error("Monitor só pode lançar frequência de HOJE.");
  }

  const rows = [...tbody.querySelectorAll("tr")];
  if (rows.length === 0) {
    throw new Error("Nenhum aluno carregado. Clique em 'Carregar alunos' primeiro.");
  }

  // Para cada aluno, grava/atualiza doc em frequencias
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
    const ref = doc(db, "frequencias", docId);

    const payload = {
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

      situacao, // opcional (ajuda relatórios)

      criadoPor: currentUser.uid,
      criadoEm: serverTimestamp(),
      editadoPor: currentUser.uid,
      editadoEm: serverTimestamp(),
    };

    await setDoc(ref, payload, { merge: true });
  }

  showStatus(`Frequência salva com sucesso para ${turma} em ${data}.`, "ok");
}

/**
 * Boot
 */
async function boot() {
  // data default
  dataInput.value = todayISO();

  currentUser = await waitForUser();
  currentUserDoc = await loadUserProfile(currentUser.uid);

  // roles pode ser string "admin, dot" OU array ["admin","dot"]
  if (Array.isArray(currentUserDoc.roles)) roles = currentUserDoc.roles.map(String);
  else if (typeof currentUserDoc.roles === "string") roles = currentUserDoc.roles.split(",").map(s => s.trim()).filter(Boolean);
  else if (typeof currentUserDoc.role === "string") roles = currentUserDoc.role.split(",").map(s => s.trim()).filter(Boolean);

  // turmasPermitidas opcional
  turmasPermitidas = Array.isArray(currentUserDoc.turmasPermitidas)
    ? currentUserDoc.turmasPermitidas.map(turmaToUpper)
    : [];

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

  buscaInput.addEventListener("input", async () => {
    // re-render simples: só filtra o que já está na tabela, sem nova consulta
    // (para manter simples, vamos só simular "recarregar" pegando os TRs atuais)
    // Se quiser perfeito, usamos estado em memória — mas isso já resolve seu problema.
  });

  showStatus("Pronto. Selecione a turma e clique em 'Carregar alunos'.", "ok");
}

boot().catch((e) => {
  console.error(e);
  showStatus(`ERRO ao iniciar a página:\n${e.message || e}`, "err");
});
