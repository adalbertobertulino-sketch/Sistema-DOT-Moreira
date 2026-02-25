// js/auth.js
import { supabase } from "./supabase.js";

function byId(id) {
  return document.getElementById(id);
}

function getRedirectTo() {
  // Vai sempre mandar para dashboard.html após login
  return `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "")}/dashboard.html`;
}

async function signInWithGoogle() {
  try {
    console.log("Clique no botão: iniciar login Google...");

    const redirectTo = getRedirectTo();
    console.log("redirectTo:", redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        // Evita popup (mais confiável em hosting)
        skipBrowserRedirect: false,
      },
    });

    if (error) throw error;

    console.log("OAuth iniciado:", data);
  } catch (err) {
    console.error("Erro no login Google:", err);
    alert("Erro ao entrar com Google. Veja o Console (F12).");
  }
}

async function main() {
  const btn = byId("btnGoogle");

  if (!btn) {
    console.error('Botão #btnGoogle não encontrado no HTML.');
    return;
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    signInWithGoogle();
  });

  console.log("auth.js carregado e listener do botão ativado.");
}

main();
