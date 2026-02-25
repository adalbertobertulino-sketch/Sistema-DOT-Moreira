import { supabase } from "./supabase.js";

const btnLogin = document.getElementById("btnLogin");
const status = document.getElementById("status");

btnLogin.addEventListener("click", async () => {
  status.innerText = "Abrindo login do Google...";

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/dashboard.html"
    }
  });

  if (error) {
    console.error(error);
    status.innerText = "Erro ao abrir login. Veja o console.";
  }
});
