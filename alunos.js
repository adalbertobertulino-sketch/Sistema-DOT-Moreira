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
  deleteDoc,
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

function renderRows(docs, canWrite) {
  const tbody = $("lista");
  if (!tbody) return;

  if (!docs.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Nenhum aluno encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = docs.map(d => {
    const a = d.data();
    const ativoTxt = (a.ativo === false) ? "Não" : "Sim";

    const btnExcluir = canWrite
      ? `<button class="btn" data-action="del" data-id="${esc(d.id)}">Excluir</button>`
      : `<span class="muted">-</span>`;

    return `
      <tr>
        <td>${esc(a.nome)}</td>
        <td>${esc(a.turma)}</td>
        <td>${esc(a.matricula)}</td>
        <td>${esc(ativoTxt)}</td>
        <td>${btnExcluir}</td>
      </tr>
    `;
  }).join("");
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

function startList(turmaFiltro = "") {
  if (unsub) unsub();

  const base = collection(db, "alunos");
  const turma = turmaFiltro.trim();

  const q = turma
    ? query(base, where("turma", "==", turma), orderBy("nome"))
    : query(base, orderBy("nome"));

  unsub = onSnapshot(
    q,
    (snap) => {
      renderRows(snap.docs, canWrite);
    },
    (err) => {
      console.error(err);
      renderRows([], canWrite);
      setStatus("Erro ao carregar alunos: " + (err.code || err.message), "err");
    }
  );
}

async function excluirAluno(id) {
  if (!canWrite) {
    setStatus("Sem permissão para excluir.", "err");
    return;
  }
  const ok = confirm("Tem certeza que deseja EXCLUIR este aluno?\n\nIsso apaga do banco.");
  if (!ok) return;

  setStatus("Excluindo...", "info");
  try {
    await deleteDoc(doc(db, "alunos", id));
    setStatus("Aluno excluído ✅", "ok");
  } catch (e) {
    console.error(e);
    setStatus("Erro ao excluir: " + (e.code || e.message), "err");
  }
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

  // Delegação de eventos para botões "Excluir"
  $("lista")?.addEventListener("click", async (ev) => {
    const btn = ev.target?.closest?.("button[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (action === "del" && id) {
      await excluirAluno(id);
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
          criadoPor: currentUser.uid,
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
