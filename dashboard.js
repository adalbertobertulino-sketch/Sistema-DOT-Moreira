<script type="module">
  import { db } from "./firebase.js";
  import { guardAuth } from "./auth.js";

  import {
    doc, getDoc,
    collection, addDoc, getDocs, query, where, orderBy, limit,
    serverTimestamp
  } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

  let currentUser = null;
  let currentProfile = null; // {role, schoolId, ...}

  // Tabs
  function initTabs(){
    const btns = document.querySelectorAll(".tabbtn");
    btns.forEach(b=>{
      b.addEventListener("click", ()=>{
        btns.forEach(x=>x.classList.remove("active"));
        b.classList.add("active");
        const tab = b.dataset.tab;
        document.querySelectorAll(".tabcontent").forEach(c=>c.classList.add("hidden"));
        document.getElementById(tab).classList.remove("hidden");
      });
    });
  }

  function setAdminUI(isAdmin){
    document.querySelectorAll(".adminOnly").forEach(el=>{
      el.style.display = isAdmin ? "" : "none";
    });
  }

  async function loadProfile(user){
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if(!snap.exists()){
      // se não existe, travamos aqui (não era pra acontecer se auth.js criou)
      throw new Error("Usuário não encontrado no Firestore (users/{uid}).");
    }
    return snap.data();
  }

  // ======== Passo 4: multi-escola (schoolId) ========
  // Todas as consultas e gravações usam schoolId
  function schoolFilter(qbase){
    return query(qbase, where("schoolId","==", currentProfile.schoolId));
  }

  // ======== Turmas ========
  window.saveTurma = async function(){
    if(currentProfile.role !== "admin"){
      alert("Apenas admin cadastra turma.");
      return;
    }
    const nome = document.getElementById("turmaNome").value.trim();
    const ano = document.getElementById("turmaAno").value.trim();
    if(!nome || !ano){ alert("Preencha nome e ano."); return; }

    await addDoc(collection(db,"turmas"),{
      nome, ano,
      schoolId: currentProfile.schoolId,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });

    document.getElementById("turmaNome").value="";
    document.getElementById("turmaAno").value="";
    await refreshAll();
  };

  async function listTurmas(){
    const ul = document.getElementById("listaTurmas");
    ul.innerHTML = "";
    const q = schoolFilter(collection(db,"turmas"));
    const snap = await getDocs(q);
    const turmas = [];
    snap.forEach(d=> turmas.push({id:d.id, ...d.data()}));

    turmas.sort((a,b)=> (a.nome||"").localeCompare(b.nome||""));

    turmas.forEach(t=>{
      const li = document.createElement("li");
      li.className="item";
      li.innerHTML = `<div>
        <div><b>${t.nome}</b> — ${t.ano}</div>
        <div class="meta">id: ${t.id}</div>
      </div>`;
      ul.appendChild(li);
    });

    // popular selects (turma)
    const turmaSelects = ["alunoTurma","aulaTurma","notaTurma"].map(id=>document.getElementById(id));
    turmaSelects.forEach(sel=>{
      sel.innerHTML = `<option value="">Selecione a turma</option>`;
      turmas.forEach(t=>{
        const opt=document.createElement("option");
        opt.value=t.id; opt.textContent=`${t.nome} (${t.ano})`;
        sel.appendChild(opt);
      });
    });

    return turmas;
  }

  // ======== Alunos ========
  window.saveAluno = async function(){
    if(currentProfile.role !== "admin"){
      alert("Apenas admin cadastra aluno.");
      return;
    }
    const nome = document.getElementById("alunoNome").value.trim();
    const turmaId = document.getElementById("alunoTurma").value;
    if(!nome || !turmaId){ alert("Informe nome e turma."); return; }

    await addDoc(collection(db,"alunos"),{
      nome,
      turmaId,
      schoolId: currentProfile.schoolId,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });

    document.getElementById("alunoNome").value="";
    await refreshAll();
  };

  async function listAlunos(){
    const ul = document.getElementById("listaAlunos");
    ul.innerHTML="";
    const q = schoolFilter(collection(db,"alunos"));
    const snap = await getDocs(q);
    const alunos=[];
    snap.forEach(d=> alunos.push({id:d.id, ...d.data()}));
    alunos.sort((a,b)=> (a.nome||"").localeCompare(b.nome||""));
    alunos.forEach(a=>{
      const li=document.createElement("li");
      li.className="item";
      li.innerHTML=`<div>
        <div><b>${a.nome}</b></div>
        <div class="meta">turmaId: ${a.turmaId}</div>
      </div>`;
      ul.appendChild(li);
    });

    // popular selects (aluno) depende da turma selecionada
    function fillAlunoSelect(selectId, turmaSelId){
      const sel = document.getElementById(selectId);
      const turmaSel = document.getElementById(turmaSelId);
      const turmaId = turmaSel.value;
      sel.innerHTML = `<option value="">Selecione o aluno</option>`;
      alunos.filter(a=>a.turmaId===turmaId).forEach(a=>{
        const opt=document.createElement("option");
        opt.value=a.id; opt.textContent=a.nome;
        sel.appendChild(opt);
      });
    }

    // listeners (se ainda não foram)
    document.getElementById("aulaTurma").onchange = ()=>fillAlunoSelect("aulaAluno","aulaTurma");
    document.getElementById("notaTurma").onchange = ()=>fillAlunoSelect("notaAluno","notaTurma");

    // inicia vazios
    fillAlunoSelect("aulaAluno","aulaTurma");
    fillAlunoSelect("notaAluno","notaTurma");

    return alunos;
  }

  // ======== Passo 2: Faltas por aula ========
  window.saveFaltaAula = async function(){
    const turmaId = document.getElementById("aulaTurma").value;
    const alunoId = document.getElementById("aulaAluno").value;
    const data = document.getElementById("aulaData").value;
    const faltas = Number(document.getElementById("aulaFaltas").value || 0);

    if(!turmaId || !alunoId || !data){ alert("Selecione turma, aluno e data."); return; }

    await addDoc(collection(db,"faltasAula"),{
      turmaId, alunoId, data,
      faltas,
      schoolId: currentProfile.schoolId,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });

    document.getElementById("aulaFaltas").value="";
    await refreshAll();
  };

  async function listFaltasAula(){
    const ul=document.getElementById("listaAulas");
    ul.innerHTML="";
    const q = query(
      collection(db,"faltasAula"),
      where("schoolId","==", currentProfile.schoolId),
      orderBy("createdAt","desc"),
      limit(20)
    );
    const snap=await getDocs(q);
    snap.forEach(d=>{
      const x=d.data();
      const li=document.createElement("li");
      li.className="item";
      li.innerHTML=`<div>
        <div><b>${x.data}</b> — faltas: <b>${x.faltas}</b></div>
        <div class="meta">turmaId: ${x.turmaId} | alunoId: ${x.alunoId}</div>
      </div>`;
      ul.appendChild(li);
    });
  }

  // ======== Passo 2: Notas ========
  window.saveNota = async function(){
    const turmaId = document.getElementById("notaTurma").value;
    const alunoId = document.getElementById("notaAluno").value;
    const tipo = document.getElementById("notaTipo").value;
    const valor = Number(document.getElementById("notaValor").value);

    if(!turmaId || !alunoId || !tipo || Number.isNaN(valor)){
      alert("Preencha turma, aluno, tipo e nota.");
      return;
    }

    await addDoc(collection(db,"notas"),{
      turmaId, alunoId, tipo, valor,
      schoolId: currentProfile.schoolId,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });

    document.getElementById("notaValor").value="";
    await refreshAll();
  };

  async function listNotas(){
    const ul=document.getElementById("listaNotas");
    ul.innerHTML="";
    const q = query(
      collection(db,"notas"),
      where("schoolId","==", currentProfile.schoolId),
      orderBy("createdAt","desc"),
      limit(30)
    );
    const snap=await getDocs(q);
    snap.forEach(d=>{
      const x=d.data();
      const li=document.createElement("li");
      li.className="item";
      li.innerHTML=`<div>
        <div><b>${x.tipo}</b> — nota: <b>${x.valor}</b></div>
        <div class="meta">turmaId: ${x.turmaId} | alunoId: ${x.alunoId}</div>
      </div>`;
      ul.appendChild(li);
    });
  }

  // ======== Avisos ========
  window.saveAviso = async function(){
    if(currentProfile.role !== "admin"){
      alert("Apenas admin publica aviso.");
      return;
    }
    const titulo = document.getElementById("avisoTitulo").value.trim();
    const data = document.getElementById("avisoData").value;
    const texto = document.getElementById("avisoTexto").value.trim();
    if(!titulo || !data || !texto){ alert("Preencha título, data e texto."); return; }

    await addDoc(collection(db,"avisos"),{
      titulo, data, texto,
      schoolId: currentProfile.schoolId,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });

    document.getElementById("avisoTitulo").value="";
    document.getElementById("avisoData").value="";
    document.getElementById("avisoTexto").value="";
    await refreshAll();
  };

  async function listAvisos(){
    const ul=document.getElementById("listaAvisos");
    ul.innerHTML="";
    const q = query(
      collection(db,"avisos"),
      where("schoolId","==", currentProfile.schoolId),
      orderBy("createdAt","desc"),
      limit(20)
    );
    const snap=await getDocs(q);
    snap.forEach(d=>{
      const x=d.data();
      const li=document.createElement("li");
      li.className="item";
      li.innerHTML=`<div>
        <div><b>${x.titulo}</b> — ${x.data}</div>
        <div class="meta">${x.texto}</div>
      </div>`;
      ul.appendChild(li);
    });
  }

  // ======== KPIs ========
  async function updateKPIs(){
    const t = await getDocs(schoolFilter(collection(db,"turmas")));
    const a = await getDocs(schoolFilter(collection(db,"alunos")));
    const v = await getDocs(query(collection(db,"avisos"), where("schoolId","==", currentProfile.schoolId)));
    document.getElementById("kTurmas").innerText = t.size;
    document.getElementById("kAlunos").innerText = a.size;
    document.getElementById("kAvisos").innerText = v.size;
  }

  async function refreshAll(){
    await listTurmas();
    await listAlunos();
    await listFaltasAula();
    await listNotas();
    await listAvisos();
    await updateKPIs();
  }

  // Boot
  initTabs();

  guardAuth(async (user)=>{
    currentUser = user;

    try{
      currentProfile = await loadProfile(user);

      document.getElementById("pNome").innerText = currentProfile.nome || user.displayName || "";
      document.getElementById("pEmail").innerText = currentProfile.email || user.email || "";
      document.getElementById("pRole").innerText = currentProfile.role || "dot";
      document.getElementById("pSchool").innerText = currentProfile.schoolId || "moreira";

      setAdminUI((currentProfile.role||"dot")==="admin");

      // debug leve
      document.getElementById("debug").innerText =
        `UID: ${user.uid}`;

      await refreshAll();
    }catch(e){
      alert("Erro ao carregar perfil: " + (e?.message || e));
    }
  });
</script>
