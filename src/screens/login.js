/* Login */
import { icon } from "../icons.js";
import { backBtn } from "../components/nav.js";
import { state, save } from "../core/state.js";
import { toast } from "../core/toast.js";
import { go } from "../core/utils.js";

export default function login() {
  return {
    cls: "screen--lilac",
    html: `
      <div class="topbar">${backBtn("#/boas-vindas")}</div>
      <div style="margin-top:2rem">
        <h1 class="display">Entrar</h1>
        <p class="lede">Acesse sua conta para continuar estudando.</p>
      </div>
      <form id="login-form" novalidate style="margin-top:1rem">
        <label class="field"><span>E-mail ou CPF</span>
          <div class="input-wrap">${icon("mail")}<input class="input" id="login-id" autocomplete="username" placeholder="Digite seu e-mail ou CPF" required></div>
        </label>
        <label class="field"><span>Senha</span>
          <div class="input-wrap">${icon("lock")}
            <input class="input" id="login-pass" type="password" autocomplete="current-password" placeholder="Digite sua senha" required>
            <button type="button" class="icon-btn" id="toggle-pass" aria-label="Mostrar senha">${icon("eye")}</button>
          </div>
        </label>
        <p class="error" id="login-error" hidden></p>
        <div class="row-end"><button type="button" class="link" id="forgot">Esqueci minha senha</button></div>
        <button class="btn btn--primary" style="margin-top:1.5rem">Entrar</button>
      </form>
      <div class="divider">ou</div>
      <p class="small center">Ainda não tem conta? <a class="link" href="#/cadastro">Criar conta</a></p>`,
    after() {
      const pass = document.getElementById("login-pass");
      const toggle = document.getElementById("toggle-pass");
      toggle.addEventListener("click", () => {
        const show = pass.type === "password";
        pass.type = show ? "text" : "password";
        toggle.innerHTML = icon(show ? "eyeOff" : "eye");
        toggle.setAttribute(
          "aria-label",
          show ? "Esconder senha" : "Mostrar senha",
        );
      });
      document
        .getElementById("forgot")
        .addEventListener("click", () =>
          toast("Enviamos um link de recuperação para o seu e-mail."),
        );
      document.getElementById("login-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const id = document.getElementById("login-id");
        const err = document.getElementById("login-error");
        id.removeAttribute("aria-invalid");
        pass.removeAttribute("aria-invalid");
        if (!id.value.trim() || pass.value.length < 4) {
          err.hidden = false;
          err.textContent = !id.value.trim()
            ? "Digite seu e-mail ou CPF para entrar."
            : "A senha precisa ter pelo menos 4 caracteres.";
          (!id.value.trim() ? id : pass).setAttribute("aria-invalid", "true");
          (!id.value.trim() ? id : pass).focus();
          return;
        }
        const raw = id.value.trim();
        const name = raw.includes("@")
          ? raw
              .split("@")[0]
              .replace(/[._-]+/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : "Estudante";
        state.user = {
          name: (state.user && !state.user.guest && state.user.name) || name,
          login: raw,
        };
        save.user();
        go("#/home");
      });
    },
  };
}
