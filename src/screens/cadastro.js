/* Criar conta / entrar com código */
import { backBtn } from "../components/nav.js";
import { state, save } from "../core/state.js";
import { toast } from "../core/toast.js";
import { go } from "../core/utils.js";

export default function cadastro() {
  return {
    html: `
      <div class="topbar">${backBtn("#/boas-vindas")}</div>
      <h1 class="title">Entrar ou criar conta</h1>
      <p class="lede">Escolha como prefere continuar. Vamos enviar um código de verificação.</p>
      <div style="text-align:center"><div class="segmented" role="group" aria-label="Receber código por">
        <button type="button" data-mode="tel" aria-pressed="true">Telefone</button>
        <button type="button" data-mode="mail" aria-pressed="false">E-mail</button>
      </div></div>
      <form id="signup" novalidate>
        <label class="field"><span id="contact-label">Número de telefone</span>
          <input class="input" id="contact" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000">
        </label>
        <button type="button" class="btn btn--soft btn--sm" id="send-code" style="margin-top:.75rem">Enviar código de verificação</button>
        <label class="field"><span>Código recebido por SMS ou e-mail</span>
          <input class="input" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">
        </label>
        <label class="field"><span>Como você quer ser chamado(a)?</span>
          <input class="input" id="name" autocomplete="given-name" placeholder="Seu nome">
        </label>
        <label class="checkbox">
          <input type="checkbox" id="has-guardian">
          <span><strong>Cadastrar uma pessoa responsável (opcional)</strong>
          <span class="small">A pessoa responsável receberá um código e informações sobre o acesso.</span></span>
        </label>
        <label class="field" id="guardian-field" hidden><span>E-mail ou telefone da pessoa responsável</span>
          <input class="input" id="guardian" placeholder="E-mail ou telefone">
        </label>
        <p class="error" id="signup-error" hidden></p>
        <button class="btn btn--primary" style="margin-top:1.5rem">Continuar</button>
      </form>`,
    after() {
      let mode = "tel";
      const contact = document.getElementById("contact");
      const label = document.getElementById("contact-label");
      document.querySelectorAll("[data-mode]").forEach((b) =>
        b.addEventListener("click", () => {
          mode = b.dataset.mode;
          document
            .querySelectorAll("[data-mode]")
            .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          label.textContent = mode === "tel" ? "Número de telefone" : "E-mail";
          contact.inputMode = mode === "tel" ? "tel" : "email";
          contact.type = mode === "tel" ? "text" : "email";
          contact.placeholder =
            mode === "tel" ? "(00) 00000-0000" : "seuemail@exemplo.com";
          contact.value = "";
          contact.focus();
        }),
      );
      contact.addEventListener("input", () => {
        if (mode !== "tel") return;
        const d = contact.value.replace(/\D/g, "").slice(0, 11);
        contact.value =
          d.length > 6
            ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
            : d.length > 2
              ? `(${d.slice(0, 2)}) ${d.slice(2)}`
              : d;
      });
      document.getElementById("send-code").addEventListener("click", () => {
        if (!contact.value.trim()) {
          contact.setAttribute("aria-invalid", "true");
          contact.focus();
          toast(
            mode === "tel"
              ? "Digite seu telefone primeiro."
              : "Digite seu e-mail primeiro.",
          );
          return;
        }
        contact.removeAttribute("aria-invalid");
        toast("Código enviado! Para testar, use 123456.");
        document.getElementById("code").focus();
      });
      const guardianField = document.getElementById("guardian-field");
      document
        .getElementById("has-guardian")
        .addEventListener("change", (e) => {
          guardianField.hidden = !e.target.checked;
          if (e.target.checked) document.getElementById("guardian").focus();
        });
      document.getElementById("signup").addEventListener("submit", (e) => {
        e.preventDefault();
        const err = document.getElementById("signup-error");
        const code = document.getElementById("code").value.trim();
        const name = document.getElementById("name").value.trim();
        const fail = (msg, el) => {
          err.hidden = false;
          err.textContent = msg;
          el.setAttribute("aria-invalid", "true");
          el.focus();
        };
        if (!contact.value.trim())
          return fail("Informe seu telefone ou e-mail.", contact);
        if (!/^\d{6}$/.test(code))
          return fail(
            "O código tem 6 números. Confira a mensagem que você recebeu.",
            document.getElementById("code"),
          );
        if (!name)
          return fail(
            "Diga como quer ser chamado(a).",
            document.getElementById("name"),
          );
        state.user = {
          name,
          login: contact.value.trim(),
          guardian: document.getElementById("guardian").value.trim() || null,
        };
        save.user();
        toast(`Conta criada. Bons estudos, ${name.split(" ")[0]}!`);
        go("#/home");
      });
    },
  };
}
