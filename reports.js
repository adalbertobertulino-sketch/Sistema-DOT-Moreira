<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Sistema DOT Moreira - Relatórios</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="topbar">
    <div class="brand">Sistema DOT Moreira — Relatórios</div>
    <div class="top-actions">
      <a class="btn btn-secondary" href="dashboard.html">Voltar</a>
      <button class="btn btn-danger" onclick="logout()">Sair</button>
    </div>
  </header>

  <main class="container">
    <section class="box">
      <h2>Gerar PDF</h2>
      <p class="small">Gera um PDF simples com turmas, alunos, notas e faltas.</p>

      <button class="btn" onclick="gerarPDF()">Baixar relatório (PDF)</button>
      <div id="status" class="status"></div>
    </section>
  </main>

  <!-- jsPDF CDN -->
  <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>

  <script type="module" src="./firebase.js"></script>
  <script type="module" src="./auth.js"></script>
  <script type="module" src="./reports.js"></script>
</body>
</html>
