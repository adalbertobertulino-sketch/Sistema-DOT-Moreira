import { auth, db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ELEMENTOS */
const turmaEl = document.getElementById("turma");
const dataEl = document.getElementById("data");
const btnCarregar = document.getElementById("btnCarregar");
const lista = document.getElementById("listaAlunos");
const statusEl = document.getElementById("status");

let usuarioAtual = null;
let roles = [];

/* STATUS */
function setStatus(msg, tipo = "info") {
  statusEl.className = tipo;
  statusEl.innerText = msg;
}

/* LOGIN + PERFIL */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  usuarioAtual = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  roles = snap.exists() ? snap.data().roles || [] : [];

  // data padrão = hoje
  if (!dataEl.value) {
    const hoje = new Date().toISOString().split("T")[0];
    dataEl.value = hoje;
  }

  setStatus("Selecione a turma e a data.", "info");
});

/* CARREGAR ALUNOS */
btnCarregar.addEventListener("click", carregarAlunos);

async function carregarAlunos() {
  const turma = turmaEl.value;
  const data = dataEl.value;

  if (!turma || !data) {
    setStatus("Selecione turma e data.", "alerta");
    return;
  }

  lista.innerHTML = "";
  setStatus("Carregando alunos…", "info");

  try {
    const q = query(
      collection(db, "alunos"),
      where("turmaUpper", "==", turma),
      where("situacao", "==", "ativo")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      setStatus("Nenhum aluno encontrado para a turma " + turma, "alerta");
      return;
    }

    for (const alunoDoc of snap.docs) {
      const aluno = alunoDoc.data();
      const alunoId = alunoDoc.id;

      const freqId = `${alunoId}_${data}`;
      const freqRef = doc(db, "frequencias", freqId);
      const freqSnap = await getDoc(freqRef);

      const freq = freqSnap.exists()
        ? freqSnap.data()
        : {
            presente: true,
            faltas: 0,
            justificativa: ""
          };

      const li = document.createElement("li");

      li.innerHTML = `
        <div>
          <b>${aluno.nome}</b><br/>
          <small>Turma: ${aluno.turmaUpper}</small>
        </div>

        <div>
          <label>
            <input type="checkbox" class="chkPresente" ${
              freq.presente ? "checked" : ""
            }>
            Presente
          </label>
          <br/>
          <input 
            type="number" 
            min="0" 
            max="10" 
            value="${freq.faltas || 0}" 
            class="faltas"
            ${freq.presente ? "disabled" : ""}
          >
        </div>

        <div>
          ${
            roles.includes("admin") || roles.includes("dot")
              ? `<input 
                   type="text" 
                   placeholder="Justificativa"
                   value="${freq.justificativa || ""}"
                   class="justificativa"
                 >`
              : `<small>Justificativa: somente DOT/Admin</small>`
          }
        </div>

        <div>
          <button class="btnSalvar">Salvar</button>
        </div>
      `;

      /* CONTROLES */
      const chk = li.querySelector(".chkPresente");
      const faltasEl = li.querySelector(".faltas");
      const justEl = li.querySelector(".justificativa");
      const btnSalvar = li.querySelector(".btnSalvar");

      chk.addEventListener("change", () => {
        faltasEl.disabled = chk.checked;
        if (chk.checked) faltasEl.value = 0;
      });

      btnSalvar.addEventListener("click", async () => {
        const presente = chk.checked;
        const faltas = Number(faltasEl.value) || 0;

        let justificativa = "";
        if (justEl && (roles.includes("admin") || roles.includes("dot"))) {
          justificativa = justEl.value.trim();
        }

        await setDoc(freqRef, {
          alunoId,
          nome: aluno.nome,
          turma: aluno.turmaUpper,
          data,
          presente,
          faltas,
          justificativa,
          criadoOuEditadoPor: usuarioAtual.uid,
          atualizadoEm: serverTimestamp()
        });

        setStatus("Frequência salva com sucesso.", "ok");
      });

      lista.appendChild(li);
    }

    setStatus("Alunos carregados.", "ok");
  } catch (e) {
    console.error(e);
    setStatus("Erro ao carregar alunos.", "erro");
  }
}
