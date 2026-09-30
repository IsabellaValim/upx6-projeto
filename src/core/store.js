/* ---------- Armazenamento local ---------- */
export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem("estudae:" + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("estudae:" + key, JSON.stringify(value));
    } catch {
      /* sem armazenamento */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem("estudae:" + key);
    } catch {}
  },
};
