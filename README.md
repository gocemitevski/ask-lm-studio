# Ask LM Studio — Local AI Sidebar for Firefox

Use LM Studio local models directly in the Firefox sidebar. Select **Ask LM Studio** from the sidebar controls and chat privately, offline, with no cloud.

This fills the gap in Firefox's built-in [AI chatbot sidebar](https://support.mozilla.org/en-US/kb/ai-chatbot?as=u&utm_source=inproduct) which only ships a few cloud providers (ChatGPT, Claude, Gemini, Copilot, Le Chat Mistral). Firefox WebExtensions cannot inject into that built-in provider dropdown, so this extension provides the standard WebExtensions way: a `sidebar_action` that lives in the same sidebar switcher.

## What you get

- 📎 **Sidebar entry “Ask LM Studio”** — View → Sidebar → Ask LM Studio, or click the sidebar launcher → Ask LM Studio, or toolbar button
- 💬 Full chat UI talking to LM Studio's OpenAI-compatible server (`/v1/models`, `/v1/chat/completions` with streaming)
- 🔄 Model picker auto-loaded from LM Studio
- 📄 “Attach page” in sidebar + right-click menus (on by default — if you install the enterprise policy, uncheck “Show Ask LM Studio in the right-click menu” in Options so you don't get a duplicate menu)
- 🔎 “Fact Check” right-click action — check the facts in any selected text with your local model: every claim gets a True / False / Partly true / Unverifiable verdict, a confidence percentage, and the sources it was based on (training knowledge + the attached page, if any — local models can't browse), plus an overall correctness percentage for the selection
- 📚 “Research” right-click action — select a term and right-click → Research: a structured brief from your local model — definition, key facts with sources, why it matters, multiple viewpoints or misconceptions, real places to verify and go deeper, plus follow-up questions to ask next. The model states its training-data cutoff when relevant and names its sources honestly (no browsing, no invented citations)
- 🖼 “Find Image Source” right-click action — right-click any image to see where it most likely comes from: the model reads the image / link / page URLs (and the attached page, if any), reports what the host and filename reveal, its best guess at the origin (own photo / stock / CDN copy / social repost / generated) with a confidence percentage, and the reverse-image search — Google Lens, TinEye, Bing Visual Search — that verifies it. Note: the model can't see the image pixels or browse, so this analyzes URLs only
- ⚙️ Options page for Base URL, API token (if you enabled “Require Authentication” in LM Studio), model, system prompt, temperature, thinking mode
- 🔒 Local-first — defaults to `http://localhost:1234`, no telemetry. If you set a custom Base URL (e.g. LAN `http://192.168.x.x:1234` or remote), page selections/context will go there — keep it local for full privacy, and use an `https://` Base URL if the server isn't on your machine so traffic is encrypted in transit (see [Privacy](#privacy-data-collection-disclosure)). Note: the extension requests `http://*/*` + `https://*/*` host access (shown as one “Access your data for all websites” item) so 📄 Attach page can run on any page and so chat can reach LM Studio — the local server sends no CORS headers, so without host access the browser would block it. Chat still goes only to your configured Base URL.

## 1. LM Studio setup (5 min)

1. Install LM Studio from https://lmstudio.ai, download a model (e.g. Llama 3.2, Mistral, Qwen).
2. Go to **Developer tab → Start Server**, port `1234`.
   - Enable `Serve on local network` if needed, and **Enable CORS** (required for `fetch` from Firefox).
   - Optional: enable **Require Authentication** and create a token via **Manage Tokens** — then paste that token into the extension's Options (API token). Without it the add-on can't talk to a server that requires auth.
3. Load your model (or `lms load` on CLI).
4. Verify: `curl http://localhost:1234/v1/models` should list your model.

## 2. Install extension in Firefox

### Temporary (dev)

1. `about:debugging → This Firefox → Load Temporary Add-on → manifest.json`
2. Open sidebar launcher (View → Sidebar) → **Ask LM Studio**. Or click toolbar button.
3. Status bar shows `Connected to LM Studio — <model>` (if not, ··· → Reload LM Studio).

### Permanent

- `web-ext build` → upload `.zip` to `about:addons` or sign via AMO, or use ESR policies.

## 3. Use it

- Select model from dropdown, type, Enter to send.
- **Quick prompts** — Summarize / Explain this / Quiz me / Proofread, same labels and prompt texts as the built-in chatbot (Summarize uses typed composer text first, otherwise the attached page).
- **Attach page** (footer) → asks about current tab.
- ··· menu: Reload LM Studio, New chat, Show shortcut when selecting text, Settings…
- Select text on any page → right-click → Ask LM Studio (Summarize / Quiz me / Explain this / Proofread / Fact Check / Research).
- Right-click an image → Ask LM Studio → Find Image Source.

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

```bash
docker run -p 3000:8080 ghcr.io/open-webui/open-webui:main
# Open WebUI → Settings → Connections → OpenAI → http://host.docker.internal:1234/v1
```

Then the policy URL `http://localhost:3000/?temporary-chat=true` gives you
LM Studio models inside the native dropdown. Full guide:
https://docs.openwebui.com/tutorials/integrations/dev-tools/firefox-sidebar

This extension remains the zero-dependency way — no Docker / Open WebUI needed,
talks straight to `localhost:1234` from its own sidebar entry.

## Troubleshooting

- **Invalid Base URL**: must start with `http://` or `https://` (e.g. `http://localhost:1234/v1`).
- **Can't reach LM Studio**: server not started? wrong port? Base URL ending in `/v1`? The sidebar shows a numbered checklist below the status bar.
- **HTTP 401 / “asked for authentication”**: the server is reachable but has **Require Authentication** on. Paste the token you created in LM Studio (Developer → Server Settings → Manage Tokens) into Options → API token, or turn authentication off in LM Studio.
- **CORS / empty response**: In LM Studio Server settings enable CORS, restart server.
- **No model**: Load model in LM Studio first, then ··· → Reload LM Studio.
- **Sidebar not showing**: Firefox 140+ required (the built-in data-collection consent the manifest uses needs it). View → Sidebar → Ask LM Studio. `browser.ml.chat` prefs are for native chatbot only, not needed for this extension.

## Files

```txt
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

## Privacy (data collection disclosure)

Ask LM Studio has **no telemetry, analytics, accounts, or third-party services**. The manifest's `data_collection_permissions` declares exactly what can leave the browser:

| Data | When | Where it goes |
| --- | --- | --- |
| Chat messages you type | Every message you send | Only the Base URL configured in Options — default `http://localhost:1234`, a program on your own machine |
| The API token you saved in Options (if any) | Every request, as an `Authorization: Bearer` header — only if you pasted a token; nothing is sent when the field is empty | Same configured server (it's that server's own credential; created and managed in LM Studio, stored only in this browser) |
| Attached page text (first ~12,000 chars) or selected text (first ~8,000 chars) | Only when you click Attach page or a right-click prompt | Same configured server |
| The page's URL | Only with attached page text (Attach page or “Summarize Page”) or a “Find Image Source” right-click prompt — never with selection-only prompts | Same configured server |
| The image's URL and the link URL wrapping it (first ~2,000 chars each; a page's inline `data:` image is reduced to its MIME header and byte count — the image data itself is never sent) | Only when you right-click an image → Ask LM Studio → Find Image Source | Same configured server |

- **Why:** solely to generate the model's reply — the extension's whole purpose. Nothing else (browsing history, identifiers, device info, usage statistics) is ever sent anywhere.
- **Storage:** settings and chat history stay in the browser; the queued right-click prompt uses in-memory (`storage.session`) data that Firefox clears on exit, so nothing from private windows is retained across sessions. Whatever your configured server keeps is under your control.
- **Control:** keep the default localhost Base URL and nothing leaves your machine. For a remote server, use an `https://` Base URL so data is encrypted in transit.
- **Sharing:** none. There are no third parties; the destination server is one you chose.

License: [GPL-2.0](LICENSE) — local-first. By default no data leaves your machine; a custom Base URL sends prompts there.
Exception: `shared/firefox-tokens.css` is bundled Mozilla code under [MPL-2.0](https://www.mozilla.org/MPL/2.0/).
