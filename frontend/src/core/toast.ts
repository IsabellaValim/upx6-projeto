/* Toast: mensagem no rodapé por ~2,6s. <Toaster/> renderiza
   (role="status" aria-live="polite"), igual ao #toast do front antigo. */
import { create } from 'zustand'

interface ToastState {
  msg: string | null
  seq: number // muda a cada toast (re-render da animação .show)
  toast: (msg: string) => void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useToast = create<ToastState>()((set, get) => ({
  msg: null,
  seq: 0,
  toast: (msg) => {
    clearTimeout(timer)
    set({ msg, seq: get().seq + 1 })
    timer = setTimeout(() => set({ msg: null }), 2600)
  },
}))

export const toast = (msg: string): void => useToast.getState().toast(msg)
