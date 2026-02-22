// frequencia.js (COMPLETO)
import { auth, watchAuth, db, fb, getMyProfile, getTodayISO, logout } from "./firebase.js";

const btnSair = document.getElementById("btnSair");
btnSair?.addEventListener("click", async () => { await logout(); window.location.href="./index.html"; });

const selTurma = document.getElementById("selTurma");
const inData = document.getElementById("inData");
const chkSomenteAtivos = document.getElementById("chkSomenteAtivos");
const buscar = document.getElementById("buscar");
const btnCarregar = document.getElementById("btnCarregar");
const btnSalvarTudo = document.getElementById("btnSalvarTudo");
const statusEl = document.getElementById("status");
const tbody = document.getElementById("tbody");

let me = null;
let alunosCache = []; // [{id, ...}]
let freqCache = new Map(); // alunoId -> doc frequência existente

function setStatus(msg, kind="info") {
  statusEl.textContent = msg;
  statusEl.className = `status ${kind}`;
}

function turmaUpper(v){ return (v||"").trim().toUpperCase(); }
function nomeLower(v){ return (v||"").trim().toLowerCase(); }

function roles() { return Array.isArray(me?.roles) ? me.roles : []; }
function isAdmin(){ return roles().includes("admin"); }
function isDot(){ return roles().includes("dot"); }
function isMonitor(){ return roles().includes("monitor"); }

function turmasPermitidas(){
  return Array.isArray(me?.turmasPermitidas) ? me.turmasPermitidas : [];
}

function canAccessTurma(t){
  const tu = turmaUpper(t);
  if (isAdmin()) return true;
  return turmasPermitidas().includes(tu);
}

function canEdit(){
  return isAdmin() || isDot();
}
function canJustify(){
  return isAdmin() || isDot();
}

function todayISO(){
  return getTodayISO();
}

function fillTurmasSelect() {
  selTurma.innerHTML = "";
  const list = isAdmin() ? (turmasPermitidas().length ? turmasPermitidas() : ["2A"]) : turmasPermitidas();
  const turmas = list.length ? list : ["2A"];
  for (const t of turmas) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    selTurma.appendChild(opt);
  }
}

function ensureDateDefault(){
  if (!inData.value) inData.value = todayISO();
}

function requireMonitorToday(){
  if (isMonitor() && inData.value !== todayISO()) {
    setStatus("Monitor só pode lançar frequência de HOJE. Selecione a data de hoje.", "err");
    return false;
  }
  return true;
}

async function carregarAlunos() {
  if (!me) return;
  ensureDateDefault();

  const turma = turmaUpper(selTurma.value);
  const data = inData.value;
  const bn = nomeLower(buscar.value);

  if (!turma) { setStatus("Selecione a turma.", "err"); return; }
  if (!canAccessTurma(turma)) { setStatus(`Turma ${turma} não permitida.`, "err"); return; }
  if (!requireMonitorToday()) return;

  setStatus("Carregando alunos…", "info");
  tbody.innerHTML = `<tr><td colspan="7">Carregando…</td></tr>`;

  // 1) Carrega alunos da turma
  let qAlunos = fb.query(
    fb.collection(db, "alunos"),
    fb.where("turmaUpper", "==", turma),
    fb.orderBy("nomeLower"),
    fb.limit(300)
  );

  const snapAlunos = await fb.getDocs(qAlunos);
  let docs = snapAlunos.docs.map(d => ({ id: d.id, ...d.data() }));

  // somente ativos?
  if (chkSomenteAtivos.checked) {
    docs = docs.filter(a => (a.situacao || "ativo") === "ativo" && (a.ativo !== false));
  }

  // busca
  if (bn) {
    docs = docs.filter(a => (a.nomeLower || "").includes(bn));
  }

  alunosCache = docs;

  // 2) Carrega frequências existentes para esta data+turma (para editar)
  freqCache.clear();
  const qFreq = fb.query(
    fb.collection(db, "frequencias"),
    fb.where("turmaUpper", "==", turma),
    fb.where("data", "==", data),
    fb.limit(500)
  );
  const snapFreq = await fb.getDocs(qFreq);
  for (const d of snapFreq.docs) {
    const f = d.data();
    if (f?.alunoId) freqCache.set(f.alunoId, { id: d.id, ...f });
  }

  renderTabela();
  setStatus(`OK — ${alunosCache.length} aluno(s) carregado(s).`, "ok");
}

function renderTabela() {
  tbody.innerHTML = "";
  if (!alunosCache.length) {
    tbody.innerHTML = `<tr><td colspan="7">Nenhum aluno encontrado para os filtros.</td></tr>`;
    return;
  }

  for (const a of alunosCache) {
    const tr = document.createElement("tr");

    const existing = freqCache.get(a.id);
    const presenteVal = existing ? !!existing.presente : true;
    const faltasVal = existing ? Number(existing.faltasNoDia || 0) : 0;
    const justVal = existing ? (existing.justificativa || "") : "";
    const justificada = existing ? !!existing.justificada : false;

    tr.innerHTML = `
      <td>${a.nome || ""}</td>
      <td>${a.turmaUpper || ""}</td>
      <td>${a.matricula || ""}</td>
      <td>${a.situacao || (a.ativo ? "ativo" : "inativo")}</td>
      <td><input type="checkbox" class="chkPresente"></td>
      <td><input type="number" class="inFaltas" min="0" max="10" value="0" style="width:80px"></td>
      <td>
        <input type="text" class="inJust" placeholder="Somente DOT/Admin (ex: atestado)" />
        <label class="check small">
          <input type="checkbox" class="chkJust" />
          Justificada
        </label>
      </td>
    `;

    const chkPres = tr.querySelector(".chkPresente");
    const inFaltas = tr.querySelector(".inFaltas");
    const inJust = tr.querySelector(".inJust");
    const chkJust = tr.querySelector(".chkJust");

    chkPres.checked = presenteVal;
    inFaltas.value = String(faltasVal);
    inJust.value = justVal;
    chkJust.checked = justificada;

    // Regras de UI:
    // - Monitor não pode justificar nem editar frequências existentes (na prática ele só cria).
    // - Justificativa só DOT/Admin
    const editable = canEdit(); // dot/admin
    inJust.disabled = !canJustify();
    chkJust.disabled = !canJustify();

    // Se não é dot/admin, não deixa mexer em data passada (já barramos no requireMonitorToday)
    // mas reforça:
    if (!editable && isMonitor()) {
      // monitor pode marcar presença/faltas só para criação (mesmo assim a regra impede update)
      // se já existir doc, deixa "travado" para evitar confusão
      if (existing) {
        chkPres.disabled = true;
        inFaltas.disabled = true;
      }
    }

    // se presente marcado, faltas vira 0
    chkPres.addEventListener("change", () => {
      if (chkPres.checked) inFaltas.value = "0";
    });

    // amarra inputs ao aluno (dataset)
    tr.dataset.alunoId = a.id;
    tbody.appendChild(tr);
  }
}

async function salvarTudo() {
  if (!me) return;

  ensureDateDefault();

  const turma = turmaUpper(selTurma.value);
  const data = inData.value;

  if (!turma) { setStatus("Selecione a turma.", "err"); return; }
  if (!canAccessTurma(turma)) { setStatus(`Turma ${turma} não permitida.`, "err"); return; }
  if (!requireMonitorToday()) return;

  if (!alunosCache.length) {
    setStatus("Nenhum aluno carregado.", "err");
    return;
  }

  setStatus("Salvando frequências…", "info");

  const u = auth.currentUser;
  const rows = [...tbody.querySelectorAll("tr")];

  let okCount = 0;
  for (const tr of rows) {
    const alunoId = tr.dataset.alunoId;
    if (!alunoId) continue;

    const a = alunosCache.find(x => x.id === alunoId);
    if (!a) continue;

    const chkPres = tr.querySelector(".chkPresente");
    const inFaltas = tr.querySelector(".inFaltas");
    const inJust = tr.querySelector(".inJust");
    const chkJust = tr.querySelector(".chkJust");

    const presente = !!chkPres?.checked;
    const faltasNoDia = Math.max(0, Math.min(10, Number(inFaltas?.value || 0)));

    // Justificativa: só dot/admin
    const justificada = canJustify() ? !!chkJust?.checked : false;
    const justificativa = canJustify() ? String(inJust?.value || "").trim() : "";

    const docId = `${data}_${turma}_${alunoId}`;
    const ref = fb.doc(db, "frequencias", docId);

    const payload = {
      alunoId,
      nome: a.nome || "",
      turma,
      turmaUpper: turma,
      data,
      presente,
      faltasNoDia: presente ? 0 : faltasNoDia,
      justificada,
      justificativa,
      editadoPor: u.uid,
      editadoEm: fb.serverTimestamp()
    };

    const snap = await fb.getDoc(ref);

    if (!snap.exists()) {
      // criação (monitor pode)
      payload.criadoPor = u.uid;
      payload.criadoEm = fb.serverTimestamp();
      await fb.setDoc(ref, payload);
      okCount++;
    } else {
      // update (só dot/admin — regra vai bloquear monitor)
      await fb.updateDoc(ref, payload);
      okCount++;
    }
  }

  setStatus(`OK — ${okCount} registro(s) salvo(s).`, "ok");
  await carregarAlunos(); // recarrega para refletir docs existentes
}

btnCarregar?.addEventListener("click", carregarAlunos);
btnSalvarTudo?.addEventListener("click", salvarTudo);

buscar?.addEventListener("input", () => {
  // só refiltra localmente sem reler banco:
  // mas como removemos por bn antes, recarrega para simplicidade
  carregarAlunos();
});

watchAuth(async (user) => {
  if (!user) { window.location.href="./index.html"; return; }
  me = await getMyProfile();
  if (!me) { setStatus("Perfil não encontrado.", "err"); return; }

  fillTurmasSelect();
  ensureDateDefault();

  // dica: se monitor, força data hoje
  if (isMonitor()) {
    inData.value = todayISO();
  }

  setStatus("Selecione turma/data e clique em Carregar alunos.", "info");
});
