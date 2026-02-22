import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/** ✅ COLOQUE AQUI OS 3 ADMINS */
const ADMIN_EMAILS = [
  // "diretor1@souprof.al.gov.br",
  // "diretor2@souprof.al.gov.br",
  // "coordenacao@souprof.al.gov.br",
];

const $ = (id) => document.getElementById(id);

export function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
}

export function setUserBox({ name, email, roles, uid }) {
  if ($("nome")) $("nome").textContent = name || "-";
  if ($("email")) $("email").textContent = email || "-";
  if ($("role")) $("role").textContent = (roles && roles.length) ? roles.join(", ") : "-";
  if ($("uid")) $("uid").textContent = uid || "-";
}

function normalizeRoles(data) {
  if (!data) return [];
  if (Array.isArray(data.roles)) return data.roles.filter(Boolean);
  if (typeof data.role === "string" && data.role.trim()) return [data.role.trim()];
  return [];
}

function hasAnyRole(userRoles, allowedRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return userRoles.some(r => allowedRoles.includes(r));
}

async function getMonitorByEmail(email) {
  if (!email) return null;
  const id = email.toLowerCase();
  const ref = doc(db, "monitorsByEmail", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** ✅ Usuario pode ser admin + dot + monitor */
export async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  const base = {
    email: user.email || "",
    name: user.displayName || "",
    updatedAt: serverTimestamp()
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      ...base,
      roles: ["dot"], // padrão: dot
      createdAt: serverTimestamp()
    }, { merge: true });
  } else {
    await setDoc(ref, base, { merge: true });
  }

  const snap2 = await getDoc(ref);
  const data = snap2.data() || {};
  let roles = normalizeRoles(data);

  // auto-admin por e-mail
  const emailLower = (user.email || "").toLowerCase();
  const adminEmailsLower = ADMIN_EMAILS.map(e => e.toLowerCase());
  if (adminEmailsLower.includes(emailLower) && !roles.includes("admin")) {
    roles.push("admin");
  }

  // auto-monitor por e-mail
  const monitor = await getMonitorByEmail(user.email || "");
  if (monitor && !roles.includes("monitor")) {
    roles.push("monitor");
    await setDoc(ref, { turmaIdMonitor: monitor.turmaId || null }, { merge: true });
  }

  // ✅ todo usuário pode ser "parent" também (não dá permissão extra sozinho;
  // quem define o acesso do pai é o vínculo parentEmails dentro do student)
  if (!roles.includes("parent")) roles.push("parent");

  await setDoc(ref, { roles }, { merge: true });

  const finalSnap = await getDoc(ref);
  return { id: finalSnap.id, ...finalSnap.data() };
}

export function protectPage({ allowedRoles = [] } = {}) {
  setStatus("Carregando...");

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      const userDoc = await ensureUserDoc(user);
      const roles = normalizeRoles(userDoc);

      setUserBox({
        name: userDoc.name || user.displayName || "",
        email: user.email || "",
        roles,
        uid: user.uid
      });

      if (!hasAnyRole(roles, allowedRoles)) {
        alert("Acesso negado.");
        await signOut(auth);
        window.location.href = "index.html";
        return;
      }

      setStatus("OK.");
      const content = $("content");
      if (content) content.style.display = "block";
      const loading = $("loading");
      if (loading) loading.style.display = "none";
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar usuário: " + (err?.message || err));
      await signOut(auth);
      window.location.href = "index.html";
    }
  });
}

export function wireLogoutButton() {
  const btn = $("btnSair");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}

export function renderMenu() {
  const menu = $("menu");
  if (!menu) return;

  menu.innerHTML = `
    <a href="dashboard.html">Painel</a>
    <a href="turmas.html">Turmas</a>
    <a href="frequencia.html">Frequência</a>
    <a href="notas.html">Notas</a>
    <a href="monitores.html">Monitores</a>
    <a href="vinculos.html">Vínculos Pais</a>
    <a href="pais.html">Área dos Pais</a>
  `;
}
