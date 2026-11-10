/* ==========================================================
   API do Estudaê — chamadas HTTP (contrato em docs/api.md)
   ========================================================== */

// Padrão: mesma origem (produção e docker compose). Em desenvolvimento, com o
// front em outra porta: localStorage.setItem("estudae:api", "http://localhost:5151")
let BASE = "";
try {
  BASE = (localStorage.getItem("estudae:api") || "").replace(/\/+$/, "");
} catch {
  /* sem armazenamento: mesma origem */
}

async function pedir(caminho, opcoes) {
  const r = await fetch(BASE + "/api" + caminho, opcoes);
  if (!r.ok) {
    const erro = new Error("Falha ao falar com a API (" + r.status + ")");
    erro.status = r.status;
    throw erro;
  }
  return r.json();
}

const seg = encodeURIComponent;

export const api = {
  disciplinas: () => pedir("/disciplinas"),
  temas: (disciplina) => pedir(`/disciplinas/${seg(disciplina)}/temas`),
  // A imagem vem do banco, servida pela API ("conteudo/imagens/..."). Com o
  // front em outra porta, a URL relativa cairia no servidor estático: aponta para a API.
  questoes: (disciplina, tema) =>
    pedir(`/disciplinas/${seg(disciplina)}/temas/${seg(tema)}/questoes`).then((lista) => {
      if (BASE) for (const q of lista) if (q.imagem) q.imagem.url = BASE + "/" + q.imagem.url;
      return lista;
    }),
  // Envia o TEXTO exato da alternativa, nunca a letra nem a posição.
  resposta: (id, alternativa) =>
    pedir(`/questoes/${seg(id)}/resposta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alternativa }),
    }),
};
