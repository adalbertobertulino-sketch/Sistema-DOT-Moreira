import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { auth } from "./firebase.js";
import { db } from "./firestore.js";

function $(id) { return document.getElementById(id); }

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

async function carregarPerfil(uid) {
  // Ajuste aqui se sua coleção de usuários tiver outro nome:
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    setText("perfilStatus", "Perfil não encontrado no Firestore (coleção users).");
    return;
  }

  const data = snap.data();

  setText("nomeUser", data.nome || data.name || "(sem nome)");
  setText("uidUser", uid);
  setText("emailUser", data.email || auth.currentUser?.email || "(sem email)");

  // turmas permitidas pode ser array ou string
  const turmas = Array.isArray(data.turmasPermitidas) ? data.turmasPermitidas.join(", ") : (data.turmasPermitidas || data.turma || "-");
  setText("turmasPermitidas", turmas);

  const perfis = Array.isArray(data.perfis) ? data.perfis.join(", ") : (data.perfis || data.perfil || "-");
  setText("perfisUser", perfis);

  setText("perfilStatus", "Perfil carregado.");
}

function ligarBotoes() {
  const btnSair = $("btnSair");
  if (btnSair) {
    btnSair.addEventListener("click", async () => {
      try {
        await signOut(auth);
        window.location.href = "index.html";
      } catch (e) {
        console.error(e);
        alert("Falha ao sair: " + (e.code || e.message));
      }
    });
  }

  const btnFreq = $("btnIrFrequencia");
  if (btnFreq) {
    btnFreq.addEventListener("click", () => {
      window.location.href = "frequencia.html";
    });
  }
}

ligarBotoes();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  setText("perfilStatus", "Carregando...");
  setText("uidUser", user.uid);
  setText("emailUser", user.email || "(sem email)");

  try {
    await carregarPerfil(user.uid);
  } catch (e) {
    console.error(e);
    setText("perfilStatus", "Erro ao carregar perfil: " + (e.code || e.message));
  }
});
