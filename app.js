// app.js (ESM) - proteção, menu e utilitários
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

export function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
}

export function setUserBox({ name, email, role, uid }) {
  if ($("nome")) $("nome").textContent = name || "-";
  if ($("email")) $("email").textContent = email || "-";
  if ($("role")) $("role").textContent = role || "-";
  if ($("uid")) $("uid").textContent = uid || "-";
}

export async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Se não existir, cria como "dot" (não-admin).
    await setDoc(ref, {
      email: user.email || "",
      name: user.displayName || "",
      role: "dot",
      createdAt: serverTimestamp()
    }, { merge: true });
  } else {
    // garante nome/email atualizados
    await setDoc(ref, {
      email: user.email || "",
      name: user.displayName || ""
    }, { merge: true });
  }

  const snap2 = await getDoc(ref);
  return { id: snap2.id, ...snap2.data() };
}

// ✅ Protege páginas: exige login, lê role e (se quiser) exige admin
export function protectPage({ requireAdmin = false } = {}) {
  setStatus("Carregando...");

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      const userDoc = await ensureUserDoc(user);
      const role = userDoc.role || "dot";

      setUserBox({
        name: userDoc.name || user.displayName || "",
        email: user.email || "",
        role,
        uid: user.uid
      });

      if (requireAdmin && role !== "admin") {
        alert("Você não é admin.");
        await signOut(auth);
        window.location.href = "index.html";
        return;
      }

      setStatus("OK: Usuário carregado.");
      // libera a página
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

// menu simples
export function renderMenu() {
  const menu = $("menu");
  if (!menu) return;

  menu.innerHTML = `
    <a href="dashboard.html">Painel</a>
    <a href="turmas.html">Turmas</a>
    <a href="frequencia.html">Frequência</a>
    <a href="notas.html">Notas</a>
    <a href="pais.html">Área dos Pais</a>
  `;
}
