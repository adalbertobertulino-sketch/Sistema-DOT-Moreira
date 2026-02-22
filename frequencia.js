import { auth, db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const statusEl = document.getElementById("status");
const listaEl = document.getElementById("listaAlunos");
const turmaSelect = document.getElementById("turma");
const dataInput = document.getElementById("data");
const btnCarregar = document.getElementById("btnCarregar");

let usuarioAtual = null;

function setStatus(msg, tipo = "info") {
  statusEl.innerText = msg;
  statusEl.className = tipo;
}

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  usuarioAtual = user;
});

btnCarregar.addEventListener("click", carregarAlunos);

async function carregarAlunos() {
  listaEl.innerHTML = "";
  setStatus("Carregando alunos...", "info");

  const turmaRaw = turmaSelect.value;
  const data = dataInput.value;

  if (!turmaRaw || !data) {
    setStatus("Selecione turma e data.", "erro");
    return;
  }

  // 🔥 NORMALIZAÇÃO DEFINITIVA
  const turma = turmaRaw
    .toUpperCase()
    .replace("°", "")
    .replace("º", "")
    .trim();

  try {
    const q = query(
      collection(db, "alunos"),
      where("turmaUpper", "==", turma),
      where("situacao", "==", "ativo")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      setStatus("Nenhum aluno encontrado para essa turma.", "alerta");
      return;
    }

    setStatus(`Alunos carregados: ${snap.size}`, "ok");

    snap.forEach(docSnap => {
      const aluno = docSnap.data();

      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${aluno.nome}</strong> — ${aluno.turma}
        <button data-id="${docSnap.id}">Presente</button>
      `;

      li.querySelector("button").addEventListener("click", () => {
        salvarFrequencia(docSnap.id, aluno);
      });

      listaEl.appendChild(li);
    });

  } catch (e) {
    console.error(e);
    setStatus("Erro ao carregar alunos.", "erro");
  }
}

async function salvarFrequencia(alunoId, aluno) {
  const data = dataInput.value;

  const ref = doc(db, "frequencias", `${alunoId}_${data}`);

  await setDoc(ref, {
    alunoId,
    nome: aluno.nome,
    turma: aluno.turma,
    data,
    presente: true,
    criadoPor: usuarioAtual.uid,
    criadoEm: serverTimestamp()
  });

  alert("Frequência salva!");
}
