/* Estado global do app + persistência */
import { store } from "./store.js";

export const state = {
  user: store.get("user", null),
  a11y: Object.assign(
    {
      font: "padrao",
      contrast: false,
      speak: false,
      motion: false,
      subs: false,
      slow: false,
    },
    store.get("a11y", {}),
  ),
  results: store.get("results", []),
  watched: store.get("watched", {}),
  quiz: null,
};

export const save = {
  user() {
    store.set("user", state.user);
  },
  a11y() {
    store.set("a11y", state.a11y);
    applyA11y();
  },
  results() {
    store.set("results", state.results);
  },
  watched() {
    store.set("watched", state.watched);
  },
};

export function applyA11y() {
  const el = document.documentElement;
  el.dataset.font = state.a11y.font;
  el.dataset.contrast = state.a11y.contrast ? "alto" : "";
  el.dataset.motion = state.a11y.motion ? "reduce" : "";
  el.dataset.subs = state.a11y.subs ? "grande" : "";
}
