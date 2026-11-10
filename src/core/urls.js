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
  // Área = lista de temas da matéria, cada um com "Assistir aula" e "Praticar".
  area: (id) => `#/area/${id}`,
  video: (id, ti, li) => `#/video/${id}/${ti}/${li}`,
  // Lição curta de um tema (até 5 questões).
  quiz: (id, ti) => `#/quiz/${id}/${ti}`,
  resultado: (i) => `#/resultado/${i}`,
};
