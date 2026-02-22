// frequencia.js (APAGUE TUDO e COLE)

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const msgEl = $("msg");
function showMsg(text, type = "ok") {
  msgEl.style.display = "block";
  msgEl.className = "msg " + (type === "ok" ? "ok" : "err");
  msgEl.textContent = text;
}
function setStatus(text) {
  $("status").textContent = text;
}

async function sair() {
  try {
    await signOut(auth);
    window.location.href = "./index.html";
  } catch (e) {
    console.error(e);
    showMsg("Erro ao sair: " + (e?.message || e), "err");
  }
}
$("btnSair").addEventListener("click", sair);

async function loadUserRoles(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return ["dot"];

  const data = snap.data() || {};
  if (Array.isArray(data.roles) && data.roles.length) return data.roles;
  if (data.role) return [data.role];
  return ["dot"];
}

function hojeISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function makeKey(alunoId, dataISO) {
  // id fixo para evitar duplicar: alunoId__2026-02-22
  return `${alunoId}__${dataISO}`;
}

let CURRENT_USER = null;
let CURRENT_ROLES = [];
let ALUNOS = []; // lista carregada da turma
let FILTRO = "";

function renderTabela() {
  const tbody = $("tbody");
  tbody.innerHTML = "";

  const turma = $("turmaSelect").value;
  const dataISO = $("dataInput").value;

  if (!turma || !dataISO) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Selecione turma e data.</td></tr>`;
    return;
  }

  let lista = ALUNOS.slice();

  if (FILTRO.trim()) {
    const f = FILTRO.trim().toLowerCase();
    lista = lista.filter(a => (a.nome || "").toLowerCase().includes(f));
  }

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Nenhum aluno encontrado.</td></tr>`;
    return;
  }

  for (const a of lista) {
    const tr = document.createElement("tr");

    const tdNome = document.createElement("td");
    tdNome.innerHTML = `<div><b>${a.nome || "(sem nome)"}</b></div><div class="small">${a.turma || ""}</div>`;
    tr.appendChild(tdNome);

    const tdMat = document.createElement("td");
    tdMat.textContent = a.matricula || "—";
    tr.appendChild(tdMat);

    const tdPresente = document.createElement("td");
    tdPresente.className = "toggle";
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = true; // padrão: presente
    chk.dataset.alunoId = a.id;
    chk.addEventListener("change", () => {
      const qtd = document.querySelector(`input[data-qtd="${a.id}"]`);
      if (!qtd) return;
      if (chk.checked) {
        qtd.value = "0";
        qtd.disabled = true;
      } else {
        qtd.disabled = false;
        if (qtd.value === "0") qtd.value = "1";
      }
    });
    tdPresente.appendChild(chk);
    tdPresente.appendChild(document.createTextNode(" Presente"));
    tr.appendChild(tdPresente);

    const tdQtd = document.createElement("td");
    const qtd = document.createElement("input");
    qtd.type = "number";
    qtd.min = "0";
    qtd.max = "10";
    qtd.value = "0";
    qtd.className = "qtd";
    qtd.disabled = true; // porque presente = true por padrão
    qtd.dataset.qtd = a.id;
    tdQtd.appendChild(qtd);
    tr.appendChild(tdQtd);

    const tdAcao = document.createElement("td");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Salvar";
    btn.addEventListener("click", async () => {
      await salvarLinha(a.id);
    });
    tdAcao.appendChild(btn);
    tr.appendChild(tdAcao);

    tbody.appendChild(tr);
  }
}

async function carregarTurmas() {
  // turmas são derivadas da coleção alunos
  setStatus("Carregando turmas...");
  const turmaSelect = $("turmaSelect");
  turmaSelect.innerHTML = `<option value="">Carregando...</option>`;

  const snap = await getDocs(collection(db, "alunos"));
  const setTurmas = new Set();

  snap.forEach((d) => {
    const data = d.data() || {};
    if (data.turma) setTurmas.add(String(data.turma));
  });

  const turmas = Array.from(setTurmas).sort((a, b) => a.localeCompare(b, "pt-BR"));

  turmaSelect.innerHTML = `<option value="">Selecione...</option>`;
  for (const t of turmas) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    turmaSelect.appendChild(opt);
  }

  setStatus("Turmas carregadas ✅");
}

async function carregarAlunosDaTurma() {
  const turma = $("turmaSelect").value;
  const dataISO = $("dataInput").value;

  if (!turma) {
    showMsg("Selecione uma turma.", "err");
    return;
  }
  if (!dataISO) {
    showMsg("Selecione uma data.", "err");
    return;
  }

  setStatus("Carregando alunos...");
  $("subtitulo").textContent = `Turma: ${turma} | Data: ${dataISO}`;

  // alunos where turma == selecionada
  const qy = query(
    collection(db, "alunos"),
    where("turma", "==", turma),
    orderBy("nome")
  );

  const snap = await getDocs(qy);
  ALUNOS = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));

  setStatus(`Alunos carregados: ${ALUNOS.length} ✅`);
  renderTabela();
}

function getLinhaValues(alunoId) {
  const chk = document.querySelector(`input[type="checkbox"][data-aluno-id="${alunoId}"]`);
  const qtd = document.querySelector(`input[data-qtd="${alunoId}"]`);

  // se não achou, tenta localizar pelo dataset correto (fallback)
  const chk2 = Array.from(document.querySelectorAll(`input[type="checkbox"]`))
    .find(x => x.dataset.alunoId === alunoId);

  const presente = (chk2 || chk)?.checked ?? true;
  const faltas = Number((qtd?.value ?? "0").trim() || "0");

  return {
    presente,
    faltasNoDia: presente ? 0 : Math.max(0, Math.min(10, faltas))
  };
}

async function salvarLinha(alunoId) {
  const turma = $("turmaSelect").value;
  const dataISO = $("dataInput").value;
  if (!turma || !dataISO) {
    showMsg("Selecione turma e data.", "err");
    return;
  }

  const aluno = ALUNOS.find(a => a.id === alunoId);
  if (!aluno) {
    showMsg("Aluno não encontrado na lista.", "err");
    return;
  }

  const { presente, faltasNoDia } = getLinhaValues(alunoId);
  const docId = makeKey(alunoId, dataISO);

  const payload = {
    alunoId,
    nome: aluno.nome || "",
    turma: aluno.turma || turma,
    data: dataISO,
    presente,
    faltasNoDia,
    criadoPor: CURRENT_USER.uid,
    criadoEm: serverTimestamp()
  };

  try {
    setStatus("Salvando frequência...");
    await setDoc(doc(db, "frequencias", docId), payload, { merge: true });
    setStatus("Frequência salva ✅");
    showMsg(`Salvo: ${aluno.nome} (${dataISO})`, "ok");
  } catch (e) {
    console.error(e);
    setStatus("Erro ao salvar.");
    showMsg("Erro ao salvar: " + (e?.message || e), "err");
  }
}

async function salvarTudo() {
  const turma = $("turmaSelect").value;
  const dataISO = $("dataInput").value;

  if (!turma || !dataISO) {
    showMsg("Selecione turma e data.", "err");
    return;
  }
  if (!ALUNOS.length) {
    showMsg("Carregue os alunos primeiro.", "err");
    return;
  }

  setStatus("Salvando tudo...");
  let ok = 0;

  for (const a of ALUNOS) {
    try {
      await salvarLinha(a.id);
      ok++;
    } catch (e) {
      console.error(e);
    }
  }

  setStatus(`Concluído ✅ (${ok}/${ALUNOS.length})`);
  showMsg(`Salvo tudo: ${ok}/${ALUNOS.length}`, "ok");
}

$("btnCarregar").addEventListener("click", carregarAlunosDaTurma);
$("btnSalvarTudo").addEventListener("click", salvarTudo);

$("buscaInput").addEventListener("input", (e) => {
  FILTRO = e.target.value || "";
  renderTabela();
});

$("turmaSelect").addEventListener("change", () => {
  // quando troca turma, limpa lista
  ALUNOS = [];
  renderTabela();
});

$("dataInput").value = hojeISO();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  CURRENT_USER = user;

  try {
    setStatus("Carregando perfil...");
    CURRENT_ROLES = await loadUserRoles(user.uid);

    $("perfilPill").textContent = "Perfis: " + CURRENT_ROLES.join(", ");

    // Controle simples: se não for dot/admin, bloqueia (ex.: monitor só lança? depois ajustamos)
    const permitido = CURRENT_ROLES.includes("admin") || CURRENT_ROLES.includes("dot") || CURRENT_ROLES.includes("monitor");
    if (!permitido) {
      showMsg("Seu usuário não tem permissão para acessar a frequência.", "err");
      $("tbody").innerHTML = `<tr><td colspan="5" class="muted">Sem permissão.</td></tr>`;
      setStatus("Bloqueado ❌");
      return;
    }

    await carregarTurmas();
    setStatus("Pronto ✅ Selecione turma e clique em Carregar alunos.");

  } catch (e) {
    console.error(e);
    setStatus("Erro.");
    showMsg("Erro ao iniciar: " + (e?.message || e), "err");
  }
});
