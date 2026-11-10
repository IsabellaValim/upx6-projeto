/* ==========================================================
   App — roteador (BrowserRouter, URLs limpas), catálogo no boot,
   guardas de usuário/nível e regras de sessão.
   Equivale ao antigo router.js: PUBLIC, legados, "sair de um
   quiz/simulado em andamento descarta a sessão" (a Acessibilidade
   preserva — dá para ir e voltar sem perder o simulado).
   ========================================================== */
import { useEffect } from 'react'
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom'
import { carregarCatalogo } from './core/catalogo'
import { applyA11y, useApp } from './core/store'
import { urls } from './core/urls'
import { Toaster } from './components/Toaster'
import Loading from './screens/Loading'
import BoasVindas from './screens/BoasVindas'
import Login from './screens/Login'
import Cadastro from './screens/Cadastro'
import Nivel from './screens/Nivel'
import Home from './screens/Home'
import Area from './screens/Area'
import Video from './screens/Video'
import Quiz from './screens/Quiz'
import Simulado from './screens/Simulado'
import Resultado from './screens/Resultado'
import Progresso from './screens/Progresso'
import Perfil from './screens/Perfil'
import Acessibilidade from './screens/Acessibilidade'

/* Reflete estudae:a11y no <html> (data-font/-contrast/-motion/-subs). */
function A11ySync() {
  const a11y = useApp((s) => s.a11y)
  useEffect(() => applyA11y(a11y), [a11y])
  return null
}

/* Sair de um quiz/simulado em andamento descarta a sessão
   (ida à Acessibilidade preserva, como no router.js antigo). */
function SessionWatcher() {
  const { pathname } = useLocation()
  useEffect(() => {
    const { quiz, simulado, setQuiz, setSimulado } = useApp.getState()
    if (
      quiz &&
      !quiz.finished &&
      !pathname.startsWith('/quiz') &&
      pathname !== urls.acessibilidade
    )
      setQuiz(null)
    if (
      simulado &&
      !simulado.finished &&
      !pathname.startsWith('/simulado') &&
      pathname !== urls.acessibilidade
    )
      setSimulado(null)
  }, [pathname])
  return null
}

/* O front só renderiza depois do catálogo (as telas leem subjects). */
function CatalogoGate() {
  const status = useApp((s) => s.catalogoStatus)
  useEffect(() => {
    // 'loading' = ainda não carregou neste boot; 'ready'/'error' já têm dono
    // (o retry da tela de erro chama carregarCatalogo direto).
    if (status === 'loading') carregarCatalogo().catch(() => {})
  }, [status])
  if (status === 'error')
    return (
      <main className="screen screen--center" id="main">
        <h1 className="title">Não foi possível carregar o conteúdo</h1>
        <p className="lede">
          Confira sua conexão com a internet e tente de novo.
        </p>
        <button
          className="btn btn--primary"
          style={{ marginTop: '1.5rem' }}
          id="retry"
          onClick={() => carregarCatalogo().catch(() => {})}
        >
          Tentar de novo
        </button>
      </main>
    )
  if (status !== 'ready') return <Loading />
  return <AppRoutes />
}

/* Rotas que não são públicas exigem usuário (visitante conta). */
function RequireUser() {
  const user = useApp((s) => s.user)
  if (!user) return <Navigate to={urls.boasVindas} replace />
  return <Outlet />
}

/* Antes de estudar, a pessoa escolhe a prova (Fundamental ou Médio),
   uma vez só. Nivel e Acessibilidade ficam de fora desta guarda. */
function RequireNivel() {
  const nivel = useApp((s) => s.nivel)
  if (!nivel) return <Navigate to={urls.nivel} replace />
  return <Outlet />
}

/* Links do app antigo: a lista de vídeo-aulas virou a própria área,
   e o quiz agora é por tema. Os dois levam para a área da matéria. */
function LegadoArea() {
  const { id = '' } = useParams()
  return <Navigate to={urls.area(id)} replace />
}

function Redirecionar() {
  const user = useApp((s) => s.user)
  return <Navigate to={user ? urls.home : urls.boasVindas} replace />
}

function AppRoutes() {
  return (
    <>
      <SessionWatcher />
      <Routes>
        {/* Públicas */}
        <Route path="/boas-vindas" element={<BoasVindas />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />

        {/* Legados */}
        <Route path="/videos/:id" element={<LegadoArea />} />
        <Route path="/quiz/:id" element={<LegadoArea />} />

        <Route element={<RequireUser />}>
          {/* Exigem usuário, mas não a prova escolhida */}
          <Route path="/nivel" element={<Nivel />} />
          <Route path="/acessibilidade" element={<Acessibilidade />} />

          <Route element={<RequireNivel />}>
            <Route path="/home" element={<Home />} />
            <Route path="/area/:id" element={<Area />} />
            <Route path="/video/:id/:ti/:li" element={<Video />} />
            <Route path="/quiz/:id/:ti" element={<Quiz />} />
            <Route path="/simulado" element={<Simulado />} />
            <Route path="/simulado/:id" element={<Simulado />} />
            <Route path="/resultado/:idx" element={<Resultado />} />
            <Route path="/progresso" element={<Progresso />} />
            <Route path="/perfil" element={<Perfil />} />
          </Route>
        </Route>

        {/* Raiz e qualquer coisa desconhecida */}
        <Route path="*" element={<Redirecionar />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <A11ySync />
      <CatalogoGate />
    </BrowserRouter>
  )
}
