// app.js - helpers de UI e operações

window.$ = (sel) => document.querySelector(sel);

window.renderTopbar = function renderTopbar(active) {
  const el = $("#topbar");
  if (!el) return;

  el.innerHTML = `
    <div class="topbar">
      <div class="brand">Sistema DOT Moreira</div>
      <div class="links">
        <a class="${active === "dashboard" ? "active" : ""}" href="dashboard.html">Painel</a>
        <a class="${active === "alunos" ? "active" : ""}" href="alunos.html">Alunos</a>
        <a class="${active === "frequencia" ? "active" : ""}" href="frequencia.html">Frequência</a>
        <a class="${active === "notas" ? "active" : ""}" href="notas.html">Notas/PDF</a>
        <a class="${active === "avisos" ? "active" : ""}" href="avisos.html">Avisos</a>
        <a class="${active === "pais" ? "active" : ""}" href="pais.html">Pais</a>
        <a class="${active === "admin" ? "active" : ""}" href="admin.html">Admin</a>
      </div>
      <div class="actions">
        <button class="btn ghost" onclick="logout()">Sair</button>
      </div>
    </div>
  `;
};

window.formatDate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

// ====== Alunos ======
// Coleção: students
// doc: { name, turma, ra, monitorUid?, createdByUid, createdAt }
window.createStudent = async function createStudent(data, me) {
  const payload = {
    name: (data.name || "").trim(),
    turma: (data.turma || "").trim(),
    ra: (data.ra || "").trim(),
    parentEmails: (data.parentEmails || "").split(",").map(s => s.trim()).filter(Boolean),
    createdByUid: me.uid,
    createdAt: serverTs(),
    updatedAt: serverTs()
  };
  if (!payload.name || !payload.turma) throw new Error("Nome e turma são obrigatórios.");
  await db.collection("students").add(payload);
};

window.listStudents = async function listStudents() {
  const snap = await db.collection("students").orderBy("turma").orderBy("name").limit(300).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Importar por texto (copiado do Keep): cada linha = "NOME - TURMA - RA - emailsPais"
window.importStudentsFromText = async function importStudentsFromText(text, me) {
  const lines = String(text || "").split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error("Cole um texto com alunos, 1 por linha.");

  const batch = db.batch();
  const col = db.collection("students");

  lines.forEach(line => {
    // formatos aceitos:
    // "João da Silva - 1A - 123 - pai@x.com, mae@y.com"
    // "Maria - 2B"
    const parts = line.split(" - ").map(p => p.trim());
    const name = parts[0] || "";
    const turma = parts[1] || "";
    const ra = parts[2] || "";
    const parentEmails = (parts[3] || "").split(",").map(s => s.trim()).filter(Boolean);

    if (!name || !turma) return;

    const ref = col.doc();
    batch.set(ref, {
      name, turma, ra, parentEmails,
      createdByUid: me.uid,
      createdAt: serverTs(),
      updatedAt: serverTs()
    });
  });

  await batch.commit();
};

// ====== Frequência ======
// Coleção: attendance
// doc id: `${studentId}_${YYYY-MM-DD}`
// { studentId, date, status: "present"|"absent", faltasAulas: number, updatedByUid, updatedAt }
window.saveAttendance = async function saveAttendance(studentId, dateISO, status, faltasAulas, me) {
  const id = `${studentId}_${dateISO}`;
  await db.collection("attendance").doc(id).set({
    studentId,
    date: dateISO,
    status,
    faltasAulas: Number(faltasAulas || 0),
    updatedByUid: me.uid,
    updatedAt: serverTs()
  }, { merge: true });
};

window.listAttendanceByDate = async function listAttendanceByDate(dateISO) {
  const snap = await db.collection("attendance").where("date", "==", dateISO).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ====== Notas/PDF ======
// Coleção: grades
// doc id: `${studentId}_${bimestre}`
// { studentId, bimestre, nota1, nota2, media, updatedByUid, updatedAt, pdfUrl?, pdfPath? }
window.saveGrades = async function saveGrades(studentId, bimestre, nota1, nota2, media, me) {
  const id = `${studentId}_${bimestre}`;
  await db.collection("grades").doc(id).set({
    studentId,
    bimestre,
    nota1: Number(nota1 || 0),
    nota2: Number(nota2 || 0),
    media: Number(media || 0),
    updatedByUid: me.uid,
    updatedAt: serverTs()
  }, { merge: true });
};

window.uploadReportPdf = async function uploadReportPdf(studentId, bimestre, file, me) {
  if (!file) throw new Error("Escolha um PDF.");
  const path = `reports/${studentId}/${bimestre}/${Date.now()}_${file.name}`;
  const ref = storage.ref().child(path);
  await ref.put(file);
  const url = await ref.getDownloadURL();

  const id = `${studentId}_${bimestre}`;
  await db.collection("grades").doc(id).set({
    studentId,
    bimestre,
    pdfUrl: url,
    pdfPath: path,
    updatedByUid: me.uid,
    updatedAt: serverTs()
  }, { merge: true });

  return url;
};

// ====== Avisos ======
// Coleção: notices
// doc: { title, message, createdByUid, createdAt }
window.createNotice = async function createNotice(title, message, me) {
  const payload = {
    title: (title || "").trim(),
    message: (message || "").trim(),
    createdByUid: me.uid,
    createdAt: serverTs()
  };
  if (!payload.title || !payload.message) throw new Error("Título e mensagem obrigatórios.");
  await db.collection("notices").add(payload);
};

window.listNotices = async function listNotices() {
  const snap = await db.collection("notices").orderBy("createdAt", "desc").limit(50).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ====== Pais ======
// Regra simples: pais entram com Google e são "parent"
// Eles veem alunos que têm o email deles dentro de parentEmails
window.listMyChildren = async function listMyChildren(parentEmail) {
  const snap = await db.collection("students").where("parentEmails", "array-contains", parentEmail).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

window.listGradesForStudent = async function listGradesForStudent(studentId) {
  const snap = await db.collection("grades").where("studentId", "==", studentId).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ====== Admin ======
// Admin pode mudar roles de um usuário existente por UID (ou criar "convite" por email)
window.setUserRoles = async function setUserRoles(targetUid, roles, me) {
  if (!hasRole(me.roles, "admin")) throw new Error("Você não é admin.");
  await db.collection("users").doc(targetUid).set({
    roles: roles,
    updatedAt: serverTs(),
    updatedByUid: me.uid
  }, { merge: true });
};

// Admin pode cadastrar "convites" por email (quando a pessoa logar, você ajusta o UID)
window.createAdminInvite = async function createAdminInvite(email, role, me) {
  if (!hasRole(me.roles, "admin")) throw new Error("Você não é admin.");
  const clean = (email || "").trim().toLowerCase();
  if (!clean) throw new Error("Email obrigatório.");
  await db.collection("invites").doc(clean).set({
    email: clean,
    role: role, // "admin" | "dot" | "monitor" | "parent"
    createdAt: serverTs(),
    createdByUid: me.uid
  });
};

window.applyInviteIfExists = async function applyInviteIfExists(me) {
  const email = (me.email || "").trim().toLowerCase();
  if (!email) return;

  const inv = await db.collection("invites").doc(email).get();
  if (!inv.exists) return;

  const role = inv.data().role;
  const newRoles = Array.from(new Set([...(me.roles || ["dot"]), role]));
  await db.collection("users").doc(me.uid).set({ roles: newRoles, updatedAt: serverTs() }, { merge: true });

  // opcional: apagar convite depois de aplicado
  // await db.collection("invites").doc(email).delete();
};
