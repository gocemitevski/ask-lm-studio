# Ask LM Studio — Local AI Sidebar for Firefox

Use LM Studio local models directly in the Firefox sidebar. Select **Ask LM Studio** from the sidebar controls and chat privately, offline, with no cloud.

This fills the gap in Firefox's built-in [AI chatbot sidebar](https://support.mozilla.org/en-US/kb/ai-chatbot?as=u&utm_source=inproduct) which only ships a few cloud providers (ChatGPT, Claude, Gemini, Copilot, Le Chat Mistral). Firefox WebExtensions cannot inject into that built-in provider dropdown, so this extension provides the standard WebExtensions way: a `sidebar_action` that lives in the same sidebar switcher.

## What you get

- 📎 **Sidebar entry “Ask LM Studio”** — View → Sidebar → Ask LM Studio, or click the sidebar launcher → Ask LM Studio, or toolbar button
- 💬 Full chat UI talking to LM Studio's OpenAI-compatible server (`/v1/models`, `/v1/chat/completions` with streaming)
- 🔄 Model picker auto-loaded from LM Studio
- 📄 “Attach page” in sidebar + right-click menus (on by default — if you install the enterprise policy, uncheck “Show Ask LM Studio in the right-click menu” in Options so you don't get a duplicate menu)
- ⚙️ Options page for Base URL, model, system prompt, temperature, thinking mode
- 🔒 Local-first — defaults to `http://localhost:1234`, no telemetry. If you set a custom Base URL (e.g. LAN `http://192.168.x.x:1234` or remote), page selections/context will go there — keep it local for full privacy. Note: the extension requests `http://*/*` + `https://*/*` host access (shown as one “Access your data for all websites” item) so 📄 Attach page can run on any page and so chat can reach LM Studio — the local server sends no CORS headers, so without host access the browser would block it. Chat still goes only to your configured Base URL.

## 1. LM Studio setup (5 min)

1. Install LM Studio from https://lmstudio.ai, download a model (e.g. Llama 3.2, Mistral, Qwen).
2. Go to **Developer tab → Start Server**, port `1234`.
   - Enable `Serve on local network` if needed, and **Enable CORS** (required for `fetch` from Firefox).
3. Load your model (or `lms load` on CLI).
4. Verify: `curl http://localhost:1234/v1/models` should list your model.

## 2. Install extension in Firefox

### Temporary (dev)
1. `about:debugging → This Firefox → Load Temporary Add-on → manifest.json`
2. Open sidebar launcher (View → Sidebar) → **Ask LM Studio**. Or click toolbar button.
3. Status bar shows `✓ Connected` (if not, ··· → Reload LM Studio).

### Permanent
- `web-ext build` → upload `.zip` to `about:addons` or sign via AMO, or use ESR policies.

## 3. Use it

- Select model from dropdown, type, Enter to send.
- **Quick prompts** — Summarize / Explain this / Quiz me / Proofread, same labels and prompt texts as the built-in chatbot (Summarize uses typed composer text first, otherwise the attached page).
- **Attach page** (footer) → asks about current tab.
- ··· menu: Reload LM Studio, New chat, Show shortcut when selecting text, Settings…
- Select text on any page → right-click → Ask LM Studio.

## 4. Show LM Studio in Firefox's *native* AI chatbot (alongside Gemini / ChatGPT)

No WebExtension — including this one — can inject into the built-in provider
dropdown. That list is controlled only by Firefox prefs / Enterprise Policy.
This repo now ships the official workaround:

- `policies/lm-studio.json` — ready-made `AIChatbot` policy that adds
  **“LM Studio (local)” next to the built-ins**. No hand-copy needed:
  - Linux: `sudo bash scripts/install-policy-linux.sh`
  - Windows (admin PowerShell): `scripts\install-policy-windows.ps1`
  - macOS: `bash scripts/print-policy-macos.sh` (prints MDM payload — macOS needs MDM/managed profile, no silent local install)
  - Requires Firefox 149+. Verify in `about:policies`.
- Manual `about:config` test (no policy file):
  - `browser.ml.chat.enabled = true`
  - `browser.ml.chat.sidebar = true`
  - `browser.ml.chat.hideLocalhost = false`
  - `browser.ml.chat.provider = http://localhost:3000/?temporary-chat=true`
  - The options page shows this extension's own `moz-extension://.../sidebar/sidebar.html`
    URL too — you can paste that as `browser.ml.chat.provider` to iframe this UI
    inside the native chatbot for a quick test. Experimental: Firefox may refuse
    to iframe `moz-extension://` pages from the chatbot (no
    `web_accessible_resources` is declared), so confirm it loads in your version
    before relying on it.

Important: the native chatbot just iframes a **web-chat URL**, not the raw
LM Studio API. Since `:1234` is API-only:

```
docker run -p 3000:8080 ghcr.io/open-webui/open-webui:main
# Open WebUI → Settings → Connections → OpenAI → http://host.docker.internal:1234/v1
```

Then the policy URL `http://localhost:3000/?temporary-chat=true` gives you
LM Studio models inside the native dropdown. Full guide:
https://docs.openwebui.com/tutorials/integrations/dev-tools/firefox-sidebar

This extension remains the zero-dependency way — no Docker / Open WebUI needed,
talks straight to `localhost:1234` from its own sidebar entry.

## Troubleshooting

- **Can't reach LM Studio**: Server not started? Wrong port? Check options Base URL ends with `/v1`.
- **CORS / empty response**: In LM Studio Server settings enable CORS, restart server.
- **No model**: Load model in LM Studio first, then ··· → Reload LM Studio.
- **Sidebar not showing**: Firefox 109+. View → Sidebar → LM Studio. `browser.ml.chat` prefs are for native chatbot only, not needed for this extension.

## Files

```
manifest.json
sidebar/sidebar.html|css|js
background/background.js
options/options.html|js|css
shared/config.js
shared/base.css
shared/firefox-tokens.css
icons/
```

The sidebar and options page are styled with Firefox's own design tokens:
`shared/firefox-tokens.css`
is the chrome design-system (`tokens-shared.css` + `tokens-brand.css`) bundled
from Firefox 157, because extension pages can't load `chrome://global/skin/…`.
Both pages load `shared/base.css`, which sets `color-scheme: light dark`,
and use `light-dark()` tokens, so they follow Firefox's light/dark theme.

License: [GPL-2.0](LICENSE) — local-first. By default no data leaves your machine; a custom Base URL sends prompts there.
Exception: `shared/firefox-tokens.css` is bundled Mozilla code under [MPL-2.0](https://www.mozilla.org/MPL/2.0/).
