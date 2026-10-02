/* Shared defaults + validation (loaded by sidebar and options pages). */
var LMStudioShared = (() => {
  const DEFAULTS = {
    baseUrl: "http://localhost:1234/v1",
    model: "",
    systemPrompt: "You are a helpful local assistant running in LM Studio. Answer concisely.",
    temperature: 0.85,
    stream: true,
    thinking: true,
  };

  function normalizeBase(u, fallback = DEFAULTS.baseUrl) {
    const t = (u || "").trim().replace(/\/+$/, "");
    if (!t) return fallback;
    return t;
  }

  function parseTemperature(v, fallback = 0.85) {
    const n = typeof v === "number" ? v : parseFloat(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(2, Math.max(0, n));
  }

  function isValidHttpUrl(u) {
    return /^https?:\/\/[^/\s]+(\/.*)?$/i.test((u || "").trim());
  }

  // Returns { ok, base, error }. Never returns "" — falls back to default.
  function resolveBaseUrl(input) {
    const raw = (input || "").trim().replace(/\/+$/, "");
    const base = raw || DEFAULTS.baseUrl;
    if (!isValidHttpUrl(base)) {
      return { ok: false, base: DEFAULTS.baseUrl, error: "Base URL must start with http:// or https:// (e.g. http://localhost:1234/v1)" };
    }
    return { ok: true, base, error: "" };
  }

  return { DEFAULTS, normalizeBase, parseTemperature, isValidHttpUrl, resolveBaseUrl };
})();
