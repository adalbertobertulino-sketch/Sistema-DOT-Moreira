<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Sistema DOT Moreira - Login</title>
  <style>
    body { font-family: Arial, sans-serif; background:#f6f7fb; margin:0; }
    .box { max-width:520px; margin:80px auto; background:#fff; padding:28px; border-radius:14px; box-shadow:0 10px 30px rgba(0,0,0,.08); }
    h1 { margin:0 0 12px; }
    button { width:100%; padding:14px 16px; border:0; border-radius:10px; background:#c7657a; color:#fff; font-size:16px; cursor:pointer; }
    button:disabled { opacity:.6; cursor:not-allowed; }
    #status { margin-top:12px; color:#555; white-space:pre-wrap; }
    .hint { margin-top:10px; font-size:12px; color:#888; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Sistema DOT Moreira</h1>

    <button id="btnLogin">Entrar com Google</button>
    <div id="status">Pronto para login.</div>

    <div class="hint">
      Se não abrir popup, permita pop-ups para este site.
      Se ainda assim não entrar, o sistema usa redirect automaticamente.
    </div>
  </div>

  <!-- IMPORTANTE: firebase.js e auth.js devem existir na raiz -->
  <script type="module" src="./auth.js"></script>
</body>
</html>
