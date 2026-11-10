/* ==========================================================
   URLs — mapa central de rotas/links do app (paths limpos, sem hash)
   ========================================================== */
export const urls = {
  boasVindas: '/boas-vindas',
  login: '/login',
  cadastro: '/cadastro',
  home: '/home',
  nivel: '/nivel', // escolha da prova (Fundamental ou Médio)
  progresso: '/progresso',
  perfil: '/perfil',
  acessibilidade: '/acessibilidade',
  // Área = lista de temas da matéria, cada um com "Assistir aula" e "Praticar".
  area: (id: string) => `/area/${id}`,
  video: (id: string, ti: number, li: number) => `/video/${id}/${ti}/${li}`,
  // Lição curta de um tema (até 5 questões).
  quiz: (id: string, ti: number) => `/quiz/${id}/${ti}`,
  // Simulado: sem matéria = tela de instruções; com matéria = a prova.
  simulado: (id?: string) => (id ? `/simulado/${id}` : '/simulado'),
  resultado: (i: number) => `/resultado/${i}`,
}
