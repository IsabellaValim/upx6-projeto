/* ==========================================================
   URLs — mapa central de rotas/links do app
   ========================================================== */
export const urls = {
  loading: "#/loading",
  boasVindas: "#/boas-vindas",
  login: "#/login",
  cadastro: "#/cadastro",
  home: "#/home",
  progresso: "#/progresso",
  perfil: "#/perfil",
  acessibilidade: "#/acessibilidade",
  area: (id) => `#/area/${id}`,
  videos: (id) => `#/videos/${id}`,
  video: (id, ti, li) => `#/video/${id}/${ti}/${li}`,
  quiz: (id) => `#/quiz/${id}`,
  resultado: (i) => `#/resultado/${i}`,
};
