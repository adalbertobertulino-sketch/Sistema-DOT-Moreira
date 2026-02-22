// alunos.js (COMPLETO)
import { auth, watchAuth, db, fb, getMyProfile, logout } from "./firebase.js";

const btnSair = document.getElementById("btnSair");
btnSair?.addEventListener("click", async () => { await logout(); window.location.href="./index.html"; });

const inNome = document.getElementById("inNome");
const inTurma = document.getElementById("inTurma");
const inMatricula = document.getElementById("inMatricula");
const btnSalvar = document.getElementById("btnSalvar");
const statusForm = document.getElementById("statusForm");

const filtroTurma = document.getElementById("filtroTurma");
const buscarNome = document.getElementById("buscarNome");
const btnRecarregar = document.getElementById("btnRecarregar");
const tbody = document.getElementById("tbodyAlunos");
const statusLista = document.getElementById("statusLista");

let me = null;

function setForm(msg, kind="info"){ statusForm.textContent = msg; statusForm.className = `status ${kind}`; }
function setList(msg, kind="info"){ statusLista.textContent = msg; statusLista.className = `status ${kind}`; }

function turmaUpper(v){ return (v||"").trim().toUpperCase(); }
function nomeLower(v){ return (v||"").trim().toLowerCase(); }

function canManage() {
  const roles = Array.isArray(me?.roles) ? me.roles : [];
  return roles.includes("admin") || roles.includes("dot");
}
function isAdmin() {
  const roles = Array.isArray(me?.roles) ? me.roles : [];
  return roles.includes("admin");
}
function turmaPermitida(t) {
  const roles = Array.isArray(me?.roles) ? me.roles : [];
  if (roles.includes("admin")) return true;
  const tp = Array.isArray(me?.turmasPermitidas) ? me.turmasPermitidas : [];
  return tp.includes(turmaUpper(t));
}

async function salvarAluno() {
  if (!canManage()) {
    setForm("Sem permissão (apenas DOT/Admin).", "err");
    return;
  }

  const nome = (inNome.value||"").trim();
  const turma = turmaUpper(inTurma.value);
  const matricula = (inMatricula.value||"").trim();

  if (!nome || !turma) {
    setForm("Preencha Nome e Turma.", "err");
    return;
  }
  if (!turmaPermitida(turma)) {
    setForm(`Turma ${turma} não permitida para seu perfil.`, "err");
    return;
  }

  setForm("Salvando…", "info");

  // ID do aluno: TURMA + "_" + (matricula se tiver) senão timestamp
  const alunoId = matricula ? `${turma}_${matricula}` : `${turma}_${Date.now()}`;

  const ref = fb.doc(db, "alunos", alunoId);
  const u = auth.currentUser;

  const payload = {
    nome,
    nomeLower: nomeLower(nome),
    turma,
    turmaUpper: turma,
    matricula: matricula || "",
    situacao: "ativo",
    ativo: true,
    atualizadoPor: u.uid,
    atualizadoEm: fb.serverTimestamp()
  };

  // se não existir, cria com criadoEm
  const snap = await fb.getDoc(ref);
  if (!snap.exists()) {
    payload.criadoPor = u.uid;
    payload.criadoEm = fb.serverTimestamp();
    await fb.setDoc(ref, payload);
  } else {
    await fb.updateDoc(ref, payload);
  }

  setForm("Aluno salvo com sucesso.", "ok");
  inNome.value = "";
  inMatricula.value = "";
  await carregarAlunos();
}

async function marcarSituacao(alunoId, situacao) {
  if (!canManage()) return alert("Sem permissão (apenas DOT/Admin).");

  const ref = fb.doc(db, "alunos", alunoId);
  const snap = await fb.getDoc(ref);
  if (!snap.exists()) return;

  const turma = snap.data().turmaUpper;
  if (!turmaPermitida(turma)) return alert("Turma não permitida.");

  const u = auth.currentUser;
  await fb.updateDoc(ref, {
    situacao,
    ativo: (situacao === "ativo"),
    atualizadoPor: u.uid,
    atualizadoEm: fb.serverTimestamp()
  });

  await carregarAlunos();
}

async function excluirAluno(alunoId) {
  if (!isAdmin()) return alert("Somente ADMIN pode excluir.");
  if (!confirm("Excluir aluno? (ação irreversível)")) return;

  const ref = fb.doc(db, "alunos", alunoId);
  await fb.deleteDoc(ref);
  await carregarAlunos();
}

function renderRows(docs) {
  tbody.innerHTML = "";
  if (!docs.length) {
    tbody.innerHTML = `<tr><td colspan="5">Nenhum aluno encontrado.</td></tr>`;
    return;
  }

  for (const d of docs) {
    const a = d.data();
    const id = d.id;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${a.nome || ""}</td>
      <td>${a.turmaUpper || a.turma || ""}</td>
      <td>${a.matricula || ""}</td>
      <td>${a.situacao || (a.ativo ? "ativo" : "inativo")}</td>
      <td class="actions"></td>
    `;

    const tdActions = tr.querySelector(".actions");

    const btnAtivo = document.createElement("button");
    btnAtivo.className = "btn small";
    btnAtivo.textContent = "Ativo";
    btnAtivo.onclick = () => marcarSituacao(id, "ativo");

    const btnEvadido = document.createElement("button");
    btnEvadido.className = "btn small";
    btnEvadido.textContent = "Evadido";
    btnEvadido.onclick = () => marcarSituacao(id, "evadido");

    const btnDesistente = document.createElement("button");
    btnDesistente.className = "btn small";
    btnDesistente.textContent = "Desistente";
    btnDesistente.onclick = () => marcarSituacao(id, "desistente");

    tdActions.appendChild(btnAtivo);
    tdActions.appendChild(btnEvadido);
    tdActions.appendChild(btnDesistente);

    if (isAdmin()) {
      const btnDel = document.createElement("button");
      btnDel.className = "btn small danger";
      btnDel.textContent = "Excluir";
      btnDel.onclick = () => excluirAluno(id);
      tdActions.appendChild(btnDel);
    }

    tbody.appendChild(tr);
  }
}

async function carregarAlunos() {
  if (!me) return;

  setList("Carregando alunos…", "info");

  const ft = turmaUpper(filtroTurma.value);
  const bn = nomeLower(buscarNome.value);

  let qRef = fb.collection(db, "alunos");
  let q;

  // Filtro por turma (se informado). Senão: só turmas permitidas do usuário
  if (ft) {
    if (!turmaPermitida(ft)) {
      setList(`Turma ${ft} não permitida.`, "err");
      renderRows([]);
      return;
    }
    q = fb.query(qRef, fb.where("turmaUpper", "==", ft), fb.orderBy("nomeLower"), fb.limit(200));
  } else {
    // se não filtrar, limita nas turmas permitidas (se não for admin)
    const roles = Array.isArray(me.roles) ? me.roles : [];
    if (roles.includes("admin")) {
      q = fb.query(qRef, fb.orderBy("nomeLower"), fb.limit(200));
    } else {
      const tp = Array.isArray(me.turmasPermitidas) ? me.turmasPermitidas : [];
      if (!tp.length) {
        setList("Sem turmas permitidas no seu perfil.", "err");
        renderRows([]);
        return;
      }
      // Firestore não aceita where IN com >10 valores. Aqui costuma ser 1-3. Se tiver muitas, ajustamos depois.
      q = fb.query(qRef, fb.where("turmaUpper", "in", tp.slice(0, 10)), fb.orderBy("nomeLower"), fb.limit(200));
    }
  }

  const snap = await fb.getDocs(q);
  let docs = snap.docs;

  // busca por nome (cliente)
  if (bn) {
    docs = docs.filter(d => (d.data().nomeLower || "").includes(bn));
  }

  renderRows(docs);
  setList(`OK — ${docs.length} aluno(s).`, "ok");
}

btnSalvar?.addEventListener("click", salvarAluno);
btnRecarregar?.addEventListener("click", carregarAlunos);
buscarNome?.addEventListener("input", () => carregarAlunos());

watchAuth(async (user) => {
  if (!user) { window.location.href="./index.html"; return; }
  me = await getMyProfile();
  if (!me) { setList("Perfil não encontrado.", "err"); return; }
  await carregarAlunos();
});
