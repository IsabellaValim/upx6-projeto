/* Leitura em voz alta (Web Speech API) */
import { toast } from './toast'
import { stripTex } from './tex'

export function speak(text: string): void {
  if (!('speechSynthesis' in window)) {
    toast('Seu navegador não tem leitura em voz alta.')
    return
  }
  speechSynthesis.cancel()
  // stripTex: o sintetizador soletraria o LaTeX cru ("barra dfrac...").
  const u = new SpeechSynthesisUtterance(stripTex(text))
  u.lang = 'pt-BR'
  u.rate = 0.9
  speechSynthesis.speak(u)
}

export const stopSpeaking = (): void => {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}
