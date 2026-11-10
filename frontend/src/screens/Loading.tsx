/* Carregando — tela interna do CatalogoGate (não tem rota) */
import { Screen } from '../components/Screen'

export default function Loading() {
  return (
    <Screen cls="screen--center" focus={false}>
      <img className="brand-symbol" src="/branding/icon.svg" alt="" />
      <h1 className="display">Carregando…</h1>
      <div className="spinner" role="progressbar" aria-label="Carregando o Estudaê" />
      <p className="kicker">Aguarde!</p>
    </Screen>
  )
}
