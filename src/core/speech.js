/* Leitura em voz alta (Web Speech API) */
import { toast } from "./toast.js";

export function speak(text) {
  if (!("speechSynthesis" in window)) {
    toast("Seu navegador não tem leitura em voz alta.");
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "pt-BR";
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

export const stopSpeaking = () => {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
};
