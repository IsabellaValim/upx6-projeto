/* <Toaster/> — o antigo #toast: mesma posição e mesma classe .show. */
import { useToast } from '../core/toast'

export function Toaster() {
  const msg = useToast((s) => s.msg)
  const seq = useToast((s) => s.seq)
  return (
    <div
      id="toast"
      role="status"
      aria-live="polite"
      className={msg ? 'show' : ''}
      key={seq} // reinicia a animação se outro toast chegar rápido
    >
      {msg ?? ''}
    </div>
  )
}
