/* ==========================================================
   Enunciado da questão (lição e simulado) e imagem em tela cheia.

   Ordem pensada para o celular: ouvir primeiro (sem precisar rolar), a imagem
   em largura total, o texto de apoio num cartão próprio (com as quebras de linha
   da prova), a pergunta em destaque e a fonte por último.
   ========================================================== */
import { fonte } from "../data.js";
import { icon } from "../icons.js";
import { esc } from "../core/utils.js";

export function enunciado(item) {
  const img = item.imagem?.url
    ? `<figure class="q-figure">
        <button type="button" class="q-figure__abrir" data-ampliar
          aria-label="Ampliar imagem em tela cheia. ${esc(item.imagem.descricao || "")}">
          <img src="${esc(item.imagem.url)}" alt="" loading="lazy">
          <span class="q-figure__dica" aria-hidden="true">${icon("search")}Toque para ampliar</span>
        </button>
        <figcaption class="sr-only">${esc(item.imagem.descricao || "Imagem da questão")}</figcaption>
      </figure>`
    : "";
  return `
      <button type="button" class="btn btn--soft q-ouvir" id="listen">${icon("volume")}Ouvir questão</button>
      ${img}
      ${item.text ? `<section class="q-apoio" aria-label="Texto de apoio"><p>${esc(item.text)}</p></section>` : ""}
      <p class="q-pergunta" id="ask">${esc(item.ask)}</p>
      <p class="q-fonte">${esc(fonte(item.prova))}</p>`;
}

/* ---------- Imagem em tela cheia ----------
   <dialog> nativo: prende o foco, fecha com Esc, é anunciado como janela pelo
   leitor de tela e devolve o foco a quem abriu. O voltar do celular também fecha
   (a abertura empilha uma entrada no histórico, sem mudar a rota). */
const ZOOM = [1, 1.5, 2, 3];
let dialogo;

function criarDialogo() {
  dialogo = document.createElement("dialog");
  dialogo.className = "visualizador";
  dialogo.setAttribute("aria-label", "Imagem da questão em tela cheia");
  dialogo.innerHTML = `
      <div class="visualizador__barra">
        <button type="button" class="visualizador__btn" data-zoom="-1" aria-label="Diminuir">${icon("minus")}</button>
        <span class="visualizador__nivel" aria-live="polite">100%</span>
        <button type="button" class="visualizador__btn" data-zoom="1" aria-label="Aumentar">${icon("plus")}</button>
        <button type="button" class="visualizador__fechar" data-fechar>${icon("x")}Fechar</button>
      </div>
      <div class="visualizador__area" tabindex="0" role="region" aria-label="Imagem ampliada. Use as setas para mover."><img alt=""></div>
      <p class="visualizador__dica">Use dois dedos para aproximar e arrastar, ou os botões + e −.</p>`;
  document.body.appendChild(dialogo);

  let nivel = 0;
  const img = dialogo.querySelector("img");
  const rotulo = dialogo.querySelector(".visualizador__nivel");
  const aplicar = () => {
    img.style.width = ZOOM[nivel] * 100 + "%";
    rotulo.textContent = ZOOM[nivel] * 100 + "%";
    dialogo.querySelector('[data-zoom="-1"]').disabled = nivel === 0;
    dialogo.querySelector('[data-zoom="1"]').disabled = nivel === ZOOM.length - 1;
  };
  dialogo.querySelectorAll("[data-zoom]").forEach((b) =>
    b.addEventListener("click", () => {
      nivel = Math.min(ZOOM.length - 1, Math.max(0, nivel + +b.dataset.zoom));
      aplicar();
    }),
  );
  // Tocar duas vezes na imagem alterna entre tamanho normal e 2x.
  img.addEventListener("dblclick", () => {
    nivel = nivel === 0 ? 2 : 0;
    aplicar();
  });
  dialogo.querySelector("[data-fechar]").addEventListener("click", () => fechar());
  dialogo.addEventListener("close", () => {
    if (history.state?.visualizador) history.back(); // tira a entrada que a abertura empilhou
  });
  window.addEventListener("popstate", () => {
    if (dialogo.open) dialogo.close();
  });
  dialogo.abrir = (url, descricao) => {
    img.src = url;
    img.alt = descricao || "Imagem da questão";
    nivel = 0;
    aplicar();
    history.pushState({ visualizador: true }, "");
    dialogo.showModal();
    dialogo.querySelector("[data-fechar]").focus();
  };
}

function fechar() {
  if (dialogo?.open) dialogo.close();
}

// Liga o toque na imagem (chamar depois de inserir o enunciado no DOM).
export function ligarImagem(raiz, item) {
  const botao = raiz.querySelector("[data-ampliar]");
  if (!botao) return;
  botao.addEventListener("click", () => {
    if (!dialogo) criarDialogo();
    dialogo.abrir(item.imagem.url, item.imagem.descricao);
  });
}

// Ao trocar de tela, a imagem aberta fecha junto.
export const fecharImagem = fechar;
