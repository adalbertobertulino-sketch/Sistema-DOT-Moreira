<script type="module">
  import { db } from "./firebase.js";
  import { guardAuth } from "./auth.js";
  import {
    doc, getDoc,
    collection, getDocs, query, where, orderBy
  } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

  let profile = null;

  async function loadProfile(user){
    const ref = doc(db,"users",user.uid);
    const snap = await getDoc(ref);
    if(!snap.exists()) throw new Error("Perfil não encontrado em users/{uid}.");
    return snap.data();
  }

  async function fetchAll(){
    const schoolId = profile.schoolId;

    const turmasSnap = await getDocs(query(collection(db,"turmas"), where("schoolId","==",schoolId)));
    const alunosSnap = await getDocs(query(collection(db,"alunos"), where("schoolId","==",schoolId)));
    const notasSnap  = await getDocs(query(collection(db,"notas"),  where("schoolId","==",schoolId), orderBy("createdAt","desc")));
    const faltasSnap = await getDocs(query(collection(db,"faltasAula"), where("schoolId","==",schoolId), orderBy("createdAt","desc")));

    const turmas=[], alunos=[], notas=[], faltas=[];
    turmasSnap.forEach(d=>turmas.push({id:d.id,...d.data()}));
    alunosSnap.forEach(d=>alunos.push({id:d.id,...d.data()}));
    notasSnap.forEach(d=>notas.push({id:d.id,...d.data()}));
    faltasSnap.forEach(d=>faltas.push({id:d.id,...d.data()}));

    return {turmas, alunos, notas, faltas};
  }

  function line(doc, text, y){
    doc.text(text, 14, y);
    return y + 7;
  }

  window.gerarPDF = async function(){
    const status = document.getElementById("status");
    try{
      status.innerText = "Gerando PDF...";
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF();

      const data = await fetchAll();

      let y = 14;
      pdf.setFontSize(14);
      y = line(pdf, `Sistema DOT Moreira — Relatório`, y);
      pdf.setFontSize(10);
      y = line(pdf, `Escola: ${profile.schoolId}`, y);
      y = line(pdf, `Gerado em: ${new Date().toLocaleString()}`, y);
      y += 4;

      pdf.setFontSize(12);
      y = line(pdf, `Turmas (${data.turmas.length})`, y);
      pdf.setFontSize(10);
      data.turmas.forEach(t=>{
        y = line(pdf, `- ${t.nome} (${t.ano}) [${t.id}]`, y);
        if(y > 280){ pdf.addPage(); y = 14; }
      });

      y += 6;
      pdf.setFontSize(12);
      y = line(pdf, `Alunos (${data.alunos.length})`, y);
      pdf.setFontSize(10);
      data.alunos.forEach(a=>{
        y = line(pdf, `- ${a.nome} (turmaId: ${a.turmaId})`, y);
        if(y > 280){ pdf.addPage(); y = 14; }
      });

      y += 6;
      pdf.setFontSize(12);
      y = line(pdf, `Notas (${data.notas.length})`, y);
      pdf.setFontSize(10);
      data.notas.slice(0,80).forEach(n=>{
        y = line(pdf, `- ${n.tipo}: ${n.valor} (alunoId: ${n.alunoId})`, y);
        if(y > 280){ pdf.addPage(); y = 14; }
      });

      y += 6;
      pdf.setFontSize(12);
      y = line(pdf, `Faltas por aula (${data.faltas.length})`, y);
      pdf.setFontSize(10);
      data.faltas.slice(0,80).forEach(f=>{
        y = line(pdf, `- ${f.data}: faltas ${f.faltas} (alunoId: ${f.alunoId})`, y);
        if(y > 280){ pdf.addPage(); y = 14; }
      });

      pdf.save("relatorio-sistema-dot-moreira.pdf");
      status.innerText = "PDF gerado com sucesso!";
    }catch(e){
      status.innerText = "Erro ao gerar PDF.";
      alert("Erro: " + (e?.message || e));
    }
  };

  guardAuth(async (user)=>{
    profile = await loadProfile(user);
  });
</script>
