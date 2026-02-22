import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id) { return document.getElementById(id); }

function setStatus(msg, kind = "info") {
  const el = $("status");
  if (!el) return;
  el.textContent = msg;
  el.className = `msg ${kind}`;
  console.log(msg);
}

function renderRows(docs) {
  const tbody = $("lista");
  if (!tbody) return;

  if (!docs.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Nenhum aluno encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = docs.map(d => {
    const a = d.data();
    return `
      <tr>
        <td>${(a.nome || "").toString()}</td>
        <td>${(a.turma || "").toString()}</td>
        <td>${(a.matricula || "").toString()}</td>
        <td>${a.ativo === false ? "Não" : "Sim"}</td>
      </tr>
    `;
  }).join("");
}

let unsub = null;

async function getMyRoles(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() || {};
  return Array.isArray(data.roles) ? data.roles : [];
}

function startList(turmaFiltro = "") {
  // limpa listener anterior
  if (unsub) unsub();

  const base = collection(db, "alunos");

  // Lista por turma se filtro preenchido, senão lista geral
  const q = turmaFiltro.trim()
    ? query(base, where("turma", "==", turmaFiltro.trim()), orderBy("nome"))
    : query(base, orderBy("nome"));

  unsub = onSnapshot(
    q,
    (snap) => {
      renderRows(snap.docs);
    },
    (err) => {
      console.error(err);
      renderRows([]);
      setStatus("Erro ao carregar alunos: " + (err.code || err.message), "err");
    }
  );
}

window.addEventListener("DOMContentLoaded", () => {
  $("btnSair")?.addEventListener("click", async () => {
    await signOut(auth);
    location.href = "./index.html";
  });

  $("btnRecarregar")?.addEventListener("click", () => {
    const turma = $("filtroTurma")?.value || "";
    startList(turma);
    setStatus("Recarregando...", "info");
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.href = "./index.html";
      return;
    }

    // valida roles
    const roles = await getMyRoles(user.uid);
    const canWrite = roles.includes("admin") || roles.includes("dot");

    // começa listagem
    startList("");

    $("btnSalvar")?.addEventListener("click", async () => {
      if (!canWrite) {
        setStatus("Seu perfil não pode cadastrar alunos. Roles: " + roles.join(", "), "err");
        return;
      }

      const nome = ($("nome")?.value || "").trim();
      const turma = ($("turma")?.value || "").trim();
      const matricula = ($("matricula")?.value || "").trim();

      if (!nome || !turma) {
        setStatus("Preencha NOME e TURMA.", "err");
        return;
      }

      setStatus("Salvando aluno...", "info");
      try {
        await addDoc(collection(db, "alunos"), {
          nome,
          turma,
          matricula: matricula || "",
          ativo: true,
          criadoPor: user.uid,
          criadoEm: serverTimestamp(),
        });

        setStatus("Aluno salvo ✅", "ok");
        $("nome").value = "";
        $("turma").value = "";
        $("matricula").value = "";
      } catch (e) {
        console.error(e);
        setStatus("Erro ao salvar: " + (e.code || e.message), "err");
      }
    });
  });
});
