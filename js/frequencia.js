// js/frequencia.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  doc, getDoc,
  collection, query, where, getDocs,
  writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const selTurma = document.getElementById("selTurma");
const inpData = document.getElementById("inpData");
const chkSomenteAtivos = document.getElementById("chkSomenteAtivos");
const inpBusca = document.getElementById("inpBusca");
const btnCarregar = document.getElementById("btnCarregar");
const btnSalvarTudo = document.getElementById("btnSalvarTudo");
const lista = document.getElementById("lista");
const status = document.getElementById("status");
const btnLogout = document.getElementById("btnLogout");

btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

function setStatus(texto, erro=false) {
  if (!status) return;
  status.textContent = texto || "";
  status.style.color = erro ? "#fecaca" : "#9ca3af";
  status.style.borderColor = erro ? "rgba(239,68,68,.4)" : "rgba(36,48,71,1)";
}

function hojeISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizaTurma(t) {
  return (t || "").trim().toUpperCase();
}

function buildFreqDocId(turmaUpper, alunoDocId, dataISO) {
  // ✅ alunoDocId é o ID REAL do aluno (ex.: G8Kdjf93JdkslQ2)
  return `${turmaUpper}_${alunoDocId}_${dataISO}`;
}

let ctx = {
  user: null,
  perfil: null,
  roles: [],
  isAdmin: false,
  isDot: false,
  isMonitor: false,
  turmasPermitidas: [],
  alunos: []
};

async function carregarPerfil(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

function preencherTurmas() {
  selTurma.innerHTML = "";
  const turmas = (ctx.turmasPermitidas || []).map(normalizaTurma).filter(Boolean);

  if (!turmas.length) {
    selTurma.innerHTML = `<option value="">(sem turmasPermitidas)</option>`;
    return;
  }
  for (const t of turmas) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    selTurma.appendChild(opt);
  }
}

function renderLista() {
  const termo = (inpBusca.value || "").trim().toLowerCase();

  const alunos = ctx.alunos.filter(a => {
    const nome = String(a.nomeLower || a.nome || "").toLowerCase();
    if (termo && !nome.includes(termo)) return false;
    return true;
  });

  if (!alunos.length) {
    lista.innerHTML = `<p class="muted">Nenhum aluno encontrado.</p>`;
    return;
  }

  const podeJustificar = ctx.isAdmin || ctx.isDot;
  const dataISO = inpData.value;

  lista.innerHTML = alunos.map(a => `
    <div class="item" data-alunoid="${a.id}">
      <h4>${a.nome || "(sem nome)"} <span class="badge">${a.turmaUpper || "—"}</span></h4>
      <div class="row">
        <div class="badge">Matrícula: ${a.matricula || "-"}</div>
        <div class="badge">Situação: ${a.situacao || (a.ativo ? "ativo" : "inativo")}</div>
      </div>

      <div class="row" style="margin-top:10px">
        <label style="margin:0">
          <input type="checkbox" class="chkPresente" checked />
          Presente
        </label>

        <div style="min-width:180px">
          <label>Faltas no dia (0–10)</label>
          <input class="inpFaltas" type="number" min="0" max="10" value="0" />
        </div>

        <div style="flex:1;min-width:260px">
          <label class="${podeJustificar ? "" : "muted"}">Justificativa (DOT/Admin)</label>
          <input class="inpJust" type="text" ${podeJustificar ? "" : "disabled"} placeholder="Ex.: atestado / documento legal" />
          <label style="margin-top:6px">
            <input type="checkbox" class="chkJustificada" ${podeJustificar ? "" : "disabled"} />
            Falta justificada
          </label>
        </div>
      </div>

      <div class="muted" style="margin-top:8px">
        Registro para a data: <b>${dataISO}</b>
      </div>
    </div>
  `).join("");
}

async function carregarAlunos() {
  const turmaUpper = normalizaTurma(selTurma.value);
  const somenteAtivos = !!chkSomenteAtivos.checked;

  if (!turmaUpper) return setStatus("Selecione uma turma.", true);

  setStatus("Carregando alunos...");
  lista.innerHTML = "";

  try {
    // ✅ CONSULTA CORRETA (isso remove o erro rosa)
    const ref = collection(db, "alunos");
    const filtros = [where("turmaUpper", "==", turmaUpper)];
    if (somenteAtivos) filtros.push(where("ativo", "==", true));

    const q = query(ref, ...filtros);
    const snap = await getDocs(q);

    ctx.alunos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (a.nomeLower || a.nome || "").toString().localeCompare((b.nomeLower || b.nome || "").toString()));

    setStatus(ctx.alunos.length ? `Alunos carregados: ${ctx.alunos.length}` : "Nenhum aluno encontrado.");
    renderLista();
  } catch (e) {
    console.error(e);
    setStatus("Erro ao carregar alunos: " + (e?.message || e), true);
  }
}

function validarPermissaoData(dataISO) {
  const hoje = hojeISO();
  if (ctx.isMonitor && !(ctx.isAdmin || ctx.isDot) && dataISO !== hoje) {
    return { ok:false, msg:"Monitor só pode lançar frequência do dia (hoje)." };
  }
  return { ok:true };
}

async function salvarTudo() {
  const turmaUpper = normalizaTurma(selTurma.value);
  const dataISO = inpData.value;

  if (!turmaUpper) return setStatus("Selecione a turma.", true);
  if (!dataISO) return setStatus("Selecione a data.", true);

  const perm = validarPermissaoData(dataISO);
  if (!perm.ok) return setStatus(perm.msg, true);

  const itens = Array.from(document.querySelectorAll(".item"));
  if (!itens.length) return setStatus("Carregue os alunos primeiro.", true);

  setStatus("Salvando frequência...");

  try {
    const batch = writeBatch(db);
    const refFreq = collection(db, "frequencias");

    for (const el of itens) {
      const alunoId = el.getAttribute("data-alunoid"); // ✅ ID REAL do aluno
      const aluno = ctx.alunos.find(a => a.id === alunoId);
      if (!aluno) continue;

      const presente = !!el.querySelector(".chkPresente")?.checked;
      const faltasNoDia = Number(el.querySelector(".inpFaltas")?.value || 0);

      let justificada = false;
      let justificativa = "";
      if (ctx.isAdmin || ctx.isDot) {
        justificada = !!el.querySelector(".chkJustificada")?.checked;
        justificativa = (el.querySelector(".inpJust")?.value || "").trim();
      }

      const docId = buildFreqDocId(turmaUpper, alunoId, dataISO);
      const docRef = doc(refFreq, docId);

      batch.set(docRef, {
        alunoId,
        nome: aluno.nome || "",
        nomeLower: aluno.nomeLower || (aluno.nome || "").toLowerCase(),
        matricula: aluno.matricula || "",
        turma: turmaUpper,
        turmaUpper,
        data: dataISO,

        presente,                 // boolean
        faltasNoDia,              // number
        justificada,              // boolean
        justificativa,            // string

        editadoPor: ctx.user.uid,
        editadoEm: serverTimestamp(),
        criadoPor: ctx.user.uid,
        criadoEm: serverTimestamp()
      }, { merge: true });
    }

    await batch.commit();
    setStatus("Frequência salva com sucesso ✅");
  } catch (e) {
    console.error(e);
    setStatus("Erro ao salvar: " + (e?.message || e), true);
  }
}

btnCarregar?.addEventListener("click", carregarAlunos);
btnSalvarTudo?.addEventListener("click", salvarTudo);
inpBusca?.addEventListener("input", renderLista);

onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "./index.html";
  ctx.user = user;

  // data padrão = hoje
  inpData.value = hojeISO();

  setStatus("Carregando perfil...");
  const perfil = await carregarPerfil(user.uid);

  if (!perfil) {
    return setStatus(`Não existe users/${user.uid}. Crie esse doc na coleção users.`, true);
  }

  ctx.perfil = perfil;
  const roles = Array.isArray(perfil.roles) ? perfil.roles : (perfil.role ? [perfil.role] : []);
  ctx.roles = roles.map(r => String(r).toLowerCase());

  ctx.isAdmin = ctx.roles.includes("admin");
  ctx.isDot = ctx.roles.includes("dot");
  ctx.isMonitor = ctx.roles.includes("monitor");

  ctx.turmasPermitidas = Array.isArray(perfil.turmasPermitidas) ? perfil.turmasPermitidas : [];
  preencherTurmas();

  setStatus("Selecione a turma e clique em “Carregar alunos”.");
});
