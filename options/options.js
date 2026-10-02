/* Depends on ../shared/config.js (LMStudioShared). */
const { DEFAULTS, parseTemperature, resolveBaseUrl } = LMStudioShared;

async function init() {
  try {
    const keys = [...Object.keys(DEFAULTS), "showOwnMenu"];
    const s = { ...DEFAULTS, showOwnMenu: true, ...(await browser.storage.local.get(keys)) };
    document.getElementById("baseUrl").value = s.baseUrl;
    document.getElementById("model").value = s.model || "";
    document.getElementById("systemPrompt").value = s.systemPrompt;
    document.getElementById("temperature").value = s.temperature;
    document.getElementById("stream").checked = !!s.stream;
    document.getElementById("thinking").checked = !!s.thinking;
    document.getElementById("showOwnMenu").checked = s.showOwnMenu !== false;
  } catch (e) {
    document.getElementById("status").textContent = `Could not load settings: ${e.message}`;
  }
  try {
    document.getElementById("extUrl").value = browser.runtime.getURL("sidebar/sidebar.html");
  } catch (_) {}
}

document.getElementById("copyExtUrl")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById("extUrl").value);
    document.getElementById("status").textContent = "Extension URL copied.";
  } catch (e) {
    document.getElementById("status").textContent = `Copy failed: ${e.message}`;
  }
});

document.getElementById("save").addEventListener("click", async () => {
  const resolved = resolveBaseUrl(document.getElementById("baseUrl").value);
  const st = document.getElementById("status");
  if (!resolved.ok) {
    st.textContent = resolved.error;
    return;
  }
  const data = {
    baseUrl: resolved.base,
    model: document.getElementById("model").value.trim(),
    systemPrompt: document.getElementById("systemPrompt").value,
    temperature: parseTemperature(document.getElementById("temperature").value),
    stream: document.getElementById("stream").checked,
    thinking: document.getElementById("thinking").checked,
    showOwnMenu: document.getElementById("showOwnMenu").checked,
  };
  await browser.storage.local.set(data);
  st.textContent = "Saved.";
  browser.runtime.sendMessage({ type: "settings-changed" }).catch(() => {});
});

document.getElementById("test").addEventListener("click", async () => {
  const resolved = resolveBaseUrl(document.getElementById("baseUrl").value);
  const st = document.getElementById("status");
  if (!resolved.ok) {
    st.textContent = resolved.error;
    return;
  }
  const base = resolved.base;
  st.textContent = "Testing…";
  try {
    const r = await fetch(`${base}/models`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const n = (j.data || []).length;
    st.textContent = `OK — found ${n} model(s): ${(j.data || []).map(m=>m.id).join(", ") || "none loaded"}`;
  } catch (e) {
    st.textContent = `Failed: ${e.message} — Is LM Studio Server running with CORS enabled?`;
  }
});

init();
