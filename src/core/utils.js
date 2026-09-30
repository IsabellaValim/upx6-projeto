/* Utilidades puras (sem acesso a estado ou DOM) */
export const LETTERS = ["A", "B", "C", "D"];

export const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
export const go = (hash) => {
  location.hash = hash;
};
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function initials(name) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "E"
  );
}

export function formatDay(ts) {
  const d = new Date(ts);
  const today = new Date();
  const diff = Math.round(
    (new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000,
  );
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
