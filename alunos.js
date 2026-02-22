import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
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

function normalizeText(s) {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeTurma(s) {
  return (s ?? "").toString().trim().toUpperCase().replace(/\s+/g, "");
}

function onlyDigits(s) {
  return (s ?? "").toString().replace(/\D+/g, "");
}

/**
 * ID ÚNICO:
 * - com matrícula: TURMA__M__MATRICULA
 * - sem matrícula: TURMA__N__NOME_NORMALIZADO
 */
function buildAlunoId({ turma, matricula, nome }) {
  const t = normalizeTurma(turma);
  const m = onlyDigits(matricula);
  if (m) return `${t}__M__${m}`;
  const n = normalizeText(nome).replace(/\s+/g, "_");
  return `${t}__N__${n}`;
}

function labelSituacao(v) {
  if (v === "desistente") return "Desistente";
  if (v === "evadido") return "Evadido";
  return "Ativo";
}

let unsub = null;
let currentUser = null;
let canWrite = false;

async function getMyRoles(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() || {};
  return Array.isArray(data.roles) ? data.roles : [];
}

function renderRows(docs) {
  const tbody = $("lista");
  if (!tbody) return;

  if (!docs.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Nenhum aluno encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = docs.map(d => {
    const a = d.data();
    const situacao = a.situacao || "ativo";

    const selectSituacao = `
      <select data-action="situacao" data-id="${esc(d.id)}" ${canWrite ? "" : "disabled"}>
        <option value="ativo" ${situacao === "ativo" ? "selected" : ""}>Ativo</option>
        <option value="desistente" ${situacao === "desistente" ? "selected" : ""}>Desistente</option>
        <option value="evadido" ${situacao === "evadido" ? "selected" : ""}>Evadido</option>
      </select>
    `;

    // Por segurança: sem excluir
    const actions = `
      <div class="rowActions">
        ${selectSituacao}
      </div>
    `;

    return `
      <tr>
        <td>${esc(a.nome)}</td>
        <td>${esc(a.turma)}</td>
        <td>${esc(a.matricula || "")}</td>
        <td>${esc(labelSituacao(situacao))}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join("");
}

function startList(turmaFiltro = "", situacaoFiltro = "") {
  if (unsub) unsub();

  const base = collection(db, "alunos");
  const turma = normalizeTurma(turmaFiltro);
  const sit = (situacaoFiltro || "").trim().toLowerCase();

  // Combina filtros: turma + situacao (se escolhidos)
  let qref = query(base, orderBy("nome"));

  if (turma) qref = query(base, where("turma", "==", turma), orderBy("nome"));
  if (turma && sit) qref = query(base, where("turma", "==", turma), where("situacao", "==", sit), orderBy("nome"));
  if (!turma && sit) qref = query(base, where("situacao", "==", sit), orderBy("nome"));

  unsub = onSnapshot(
    qref,
    (snap) => renderRows(snap.docs),
    (err) => {
      console.error(err);
      renderRows([]);
      setStatus("Erro ao carregar alunos: " + (err.code || err.message), "err");
    }
  );
}

async function salvarOuAtualizarAluno({ nome, turma, matricula, situacao }) {
  const turmaNorm = normalizeTurma(turma);
  const nomeNorm = normalizeText(nome);
  const matriculaDigits = onlyDigits(matricula);

  const alunoId = buildAlunoId({ turma: turmaNorm, matricula: matriculaDigits, nome: nomeNorm });
  const ref = doc(db, "alunos", alunoId);

  const existente = await getDoc(ref);
  if (existente.exists()) {
    const ok = confirm("Esse aluno já existe (mesma turma e matrícula/nome). Quer ATUALIZAR em vez de duplicar?");
    if (!ok) {
      setStatus("Cancelado para evitar duplicado.", "info");
      return;
    }
  }

  await setDoc(ref, {
    nome: nome.trim(),
    turma: turmaNorm,
    matricula: matriculaDigits || "",
    situacao: (situacao || "ativo"),

    // auxiliares
    nomeLower: nomeNorm,
    turmaUpper: turmaNorm,

    criadoPor: currentUser.uid,
    criadoEm: existente.exists() ? (existente.data()?.criadoEm || serverTimestamp()) : serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  }, { merge: true });

  setStatus(existente.exists() ? "Aluno atualizado ✅ (sem duplicar)" : "Aluno salvo ✅", "ok");
}

async function atualizarSituacao(alunoId, novaSituacao) {
  if (!canWrite) {
    setStatus("Sem permissão para alterar situação.", "err");
    return;
  }
  const v = (novaSituacao || "").toLowerCase();
  if (!["ativo", "desistente", "evadido"].includes(v)) {
    setStatus("Situação inválida.", "err");
    return;
  }

  try {
    await updateDoc(doc(db, "alunos", alunoId), {
      situacao: v,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: currentUser.uid,
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

  $("btnRecarregar")?.addEventListener("click", () => {
    const turma = $("filtroTurma")?.value || "";
    const sit = $("filtroSituacao")?.value || "";
    startList(turma, sit);
    setStatus("Recarregando...", "info");
  });

  // Mudança de situação na tabela
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
    currentUser = user;

    const roles = await getMyRoles(user.uid);
    canWrite = roles.includes("admin") || roles.includes("dot");

    startList("", "");
    setStatus(canWrite ? "Pronto ✅ Você pode cadastrar/alterar situação." : "Pronto ✅ Você pode apenas visualizar.", canWrite ? "ok" : "info");

    $("btnSalvar")?.addEventListener("click", async () => {
      if (!canWrite) {
        setStatus("Seu perfil não pode cadastrar/altera situação. Roles: " + roles.join(", "), "err");
        return;
      }

      const nome = ($("nome")?.value || "").trim();
      const turma = ($("turma")?.value || "").trim();
      const matricula = ($("matricula")?.value || "").trim();
      const situacao = ($("situacao")?.value || "ativo").trim().toLowerCase();

      if (!nome || !turma) {
        setStatus("Preencha NOME e TURMA.", "err");
        return;
      }

      setStatus("Salvando (anti-duplicado)...", "info");
      try {
        await salvarOuAtualizarAluno({ nome, turma, matricula, situacao });

        $("nome").value = "";
        $("turma").value = "";
        $("matricula").value = "";
        $("situacao").value = "ativo";

      } catch (e) {
        console.error(e);
        setStatus("Erro ao salvar: " + (e.code || e.message), "err");
      }
    });
  });
});
