// js/index.js
import { bindGoogleLogin } from "./auth.js";

// Liga o botão ao login e manda para o dashboard
bindGoogleLogin("btnLogin", "status", "dashboard.html");
