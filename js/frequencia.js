// js/frequencia.js
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import { db } from "./firebase.js";
import { requireAuth, bindLogout } from "./auth.js";

// protege e habilita sair
requireAuth("index.html");
bindLogout("btnSair", "index.html");

// elementos
const selTurma = document.getElementById("selTurma");
const inpData = document.getElementById("inpData");
const btnCarregar = document.getElementById("btnCarregar");
const btnSalvarTudo = document.getElementById("btnSalvarTudo");
const chkSomenteAtivos = document.getElementById("chkSomenteAtivos");
const inpBusca = document.getElementById("inpBusca");
const tbody = document.getElementById("tbody");
const msg = document.getElementById("msg");

// data padrão hoje
(function setHoje() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  inpData.value = `${yyyy}-${mm}-${dd}`;
})();

function setMsg(text, kind = "") {
  msg.textContent = text;
  msg.className = "msg " + (kind || "");
}

let alunosCache = []; // guarda alunos carregados

btnCarregar.addEventListener("click", carregarAlunos);
inpBusca.addEventListener("input", renderTabela);
chkSomenteAtivos.addEventListener("change", carregarAlunos);

btnSalvarTudo.addEventListener("click", () => {
  alert("Salvar tudo ainda não foi ligado ao Firestore neste arquivo. Se você quiser, eu completo o salvar também.");
});

// ✅ carrega alunos SEM orderBy (evita precisar de índice)
// depois a gente ordena localmente por nome
async function carregarAlunos() {
  tbody.innerHTML = "";
  alunosCache = [];

  const turma = (selTurma.value || "").trim();
  const somenteAtivos = chkSomenteAtivos.checked;

  if (!turma) {
    setMsg("Selecione uma turma.", "warn");
    return;
  }

  setMsg("Carregando alunos...", "info");

  try {
    // Se você usa turmaUpper nos docs:
    //  - turmaUpper deve existir e ser "2A"
    // Se você usa turma:
    //  - turma deve existir e ser "2A"
    //
    // Vou tentar primeiro por turmaUpper. Se não vier nada, tento por turma.
    let q1 = query(collection(db, "alunos"), where("turmaUpper", "==", turma));
    if (somenteAtivos) q1 = query(q1, where("ativo", "==", true));

    let snap = await getDocs(q1);

    // fallback: se turmaUpper não existe
    if (snap.empty) {
      let q2 = query(collection(db, "alunos"), where("turma", "==", turma));
      if (somenteAtivos) q2 = query(q2, where("ativo", "==", true));
      snap = await getDocs(q2);
    }

    if (snap.empty) {
      setMsg("Nenhum aluno encontrado para essa turma. Verifique se os documentos em 'alunos' têm turma/turmaUpper corretos.", "warn");
      return;
    }

    // monta cache
    snap.forEach((doc) => {
      const data = doc.data();
      alunosCache.push({
        id: doc.id,
        nome: data.nome || "",
        nomeLower: data.nomeLower || (data.nome ? String(data.nome).toLowerCase() : ""),
        turma: data.turma || data.turmaUpper || turma,
        matricula: data.matricula ?? "",
        situacao: data.situacao || "",
        ativo: data.ativo === true
      });
    });

    // ordena por nome
    alunosCache.sort((a, b) => a.nomeLower.localeCompare(b.nomeLower));

    setMsg(`Alunos carregados: ${alunosCache.length}`, "ok");
    renderTabela();
  } catch (e) {
    console.error("ERRO ao carregar alunos:", e);
    setMsg(`Erro ao carregar alunos: ${e?.code || e?.message}`, "error");
  }
}

function renderTabela() {
  const termo = (inpBusca.value || "").trim().toLowerCase();
  const lista = termo
    ? alunosCache.filter(a => (a.nomeLower || "").includes(termo))
    : alunosCache;

  tbody.innerHTML = "";

  for (const a of lista) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHtml(a.nome)}</td>
      <td>${escapeHtml(a.turma)}</td>
      <td>${escapeHtml(String(a.matricula))}</td>
      <td>${escapeHtml(a.situacao)}</td>
      <td>
        <input type="checkbox" class="chkPresente" data-id="${a.id}" checked />
      </td>
      <td>
        <input type="number" class="inpFaltas" data-id="${a.id}" min="0" max="10" value="0" style="width:80px" />
      </td>
      <td>
        <input type="checkbox" class="chkJust" data-id="${a.id}" />
      </td>
      <td>
        <input type="text" class="inpJustTxt" data-id="${a.id}" placeholder="Opcional" />
      </td>
    `;

    tbody.appendChild(tr);
  }

  if (alunosCache.length > 0 && lista.length === 0) {
    setMsg("Nenhum aluno bate com a busca.", "warn");
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

// carrega ao abrir
carregarAlunos();
