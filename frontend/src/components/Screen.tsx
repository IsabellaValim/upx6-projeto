/* ==========================================================
   Screen — casca de cada tela (equivale ao mount() do front antigo):
   <main class="screen cls"> + bottom-nav quando `nav` definido,
   rola para o topo, para a leitura em voz alta, foca o <h1> e
   ajusta o document.title ("Título — Estudaê").
   ========================================================== */
import { useEffect, useRef, type ReactNode } from 'react'
import { stopSpeaking } from '../core/speech'
import { BottomNav } from './Nav'

export type NavId = 'inicio' | 'progresso' | 'preparacao' | 'perfil'

interface ScreenProps {
  cls?: string
  nav?: NavId
  children: ReactNode
  focus?: boolean // focar o h1 ao montar (padrão true; igual ao mount)
}

export function Screen({ cls = '', nav, children, focus = true }: ScreenProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    stopSpeaking()
    window.scrollTo(0, 0)
    const app = document.getElementById('app')
    if (app) app.scrollTop = 0
    const h1 = ref.current?.querySelector('h1')
    document.title =
      (h1?.textContent?.trim() ? h1.textContent.trim() + ' — ' : '') + 'Estudaê'
    if (h1 && focus) {
      h1.tabIndex = -1
      h1.focus({ preventScroll: true })
    }
    // Mount do front antigo = tela nova: este efeito roda uma vez por montagem
    // (a prop focus não muda durante a vida da tela).
  }, [focus])

  return (
    <>
      <main className={`screen ${cls}`} id="main" ref={ref}>
        {children}
      </main>
      {nav && <BottomNav active={nav} />}
    </>
  )
}
