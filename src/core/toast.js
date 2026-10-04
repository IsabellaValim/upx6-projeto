/* Aviso temporário exibido no rodapé */
import { $toast } from "./dom.js";

export function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $toast.classList.remove("show"), 2600);
}
