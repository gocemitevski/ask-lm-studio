// Background: toolbar button opens sidebar, context menu sends selection to sidebar.
// Sidebar owns prompt formatting — background sends raw selection + mode to avoid double-wrapping.
// DEFAULT: own menus ON so the extension works out of the box, even without
// the enterprise policy. Uncheck Options > "Show Ask LM Studio in the
// right-click menu" to show only the native Ask menu entry.
async function shouldShowOwnMenus() {
  try {
    const { showOwnMenu } = await browser.storage.local.get("showOwnMenu");
    return showOwnMenu === undefined ? true : !!showOwnMenu;
  } catch (_) {
    return true;
  }
}

// Menu definitions. No icons — matches the native "Ask {provider}" submenu
// (GenAI.sys.mjs buildAskChatMenu), which is plain text with no
// extension/brand icons. Selection items use verbatim native genai-prompts
// labels (genai.ftl); "Fact Check" and "Research" (selection) and
// "Image Source" (image) are extension-only entries (no native equivalent).
// The two page items (native shows "Summarize Page" + "Open {provider}"
// instead of the selection prompts when nothing is selected) are toggled in
// onShown below.
const MENU_ITEMS = [
  { id: "ask-lmstudio", title: "Ask LM Studio", contexts: ["selection", "page"] },
  { id: "ask-summarize", parentId: "ask-lmstudio", title: "Summarize", contexts: ["selection"] },
  { id: "ask-quiz", parentId: "ask-lmstudio", title: "Quiz me", contexts: ["selection"] },
  { id: "ask-explain", parentId: "ask-lmstudio", title: "Explain this", contexts: ["selection"] },
  { id: "ask-proofread", parentId: "ask-lmstudio", title: "Proofread", contexts: ["selection"] },
  { id: "ask-factcheck", parentId: "ask-lmstudio", title: "Fact Check", contexts: ["selection"] },
  { id: "ask-research", parentId: "ask-lmstudio", title: "Research", contexts: ["selection"] },
  { id: "ask-imagesource", parentId: "ask-lmstudio", title: "Image Source", contexts: ["image"] },
  { id: "ask-summarize-page", parentId: "ask-lmstudio", title: "Summarize Page", contexts: ["page"] },
  { id: "ask-open", parentId: "ask-lmstudio", title: "Open Ask LM Studio", contexts: ["page"] },
];
// Page-only items: visible when the right-click had no selection.
const PAGE_MENU_IDS = ["ask-summarize-page", "ask-open"];

async function ensureMenus() {
  try {
    await browser.menus.removeAll();
  } catch (_) {}
  if (!(await shouldShowOwnMenus())) return; // native-only UX: no duplicate menu
  for (const item of MENU_ITEMS) browser.menus.create(item);
}

// Mirror native buildAskChatMenu: selection prompts when text is selected,
// page items only when it isn't. Firefox has no static "page without
// selection" context, so visibility is decided here. Updates are awaited
// before refresh, and there is deliberately no menuIds guard — the previous
// guarded/sync version could miss a run and leave the page items hidden,
// which made the submenu empty on right-click with no selection.
if (browser.menus.onShown) {
  browser.menus.onShown.addListener(async (info) => {
    try {
      const hasSelection = !!(info.selectionText || "").trim();
      for (const id of PAGE_MENU_IDS) {
        await browser.menus.update(id, { visible: !hasSelection });
      }
      await browser.menus.refresh();
    } catch (_) {}
  });
}

async function enqueuePending(payload) {
  // storage.session (memory-only) so queued selection text/URLs are never
  // written to disk — Firefox clears it at shutdown, which also keeps data
  // from private browsing sessions out of persistent storage (Add-on
  // Policies §6.3).
  try {
    const { pendingPrompts } = await browser.storage.session.get("pendingPrompts");
    const queue = Array.isArray(pendingPrompts) ? pendingPrompts : [];
    queue.push(payload);
    // cap queue so rapid clicks don't grow storage unbounded
    await browser.storage.session.set({ pendingPrompts: queue.slice(-5) });
  } catch (_) {
    try { await browser.storage.session.set({ pendingPrompts: [payload] }); } catch (_) {}
  }
}

browser.runtime.onInstalled.addListener(async () => {
  await ensureMenus();
  // Drop any queue left in persistent storage by older versions.
  try {
    await browser.storage.local.remove(["pendingPrompts", "pendingPrompt"]);
  } catch (_) {}
  // Note: no auto-open — native chatbot is primary UX (manifest open_at_install=false).
});

browser.runtime.onStartup.addListener(async () => {
  await ensureMenus();
  try {
    await browser.storage.local.remove(["pendingPrompts", "pendingPrompt"]);
  } catch (_) {}
});

// Toggle duplicate menus live from Options page
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "showOwnMenu" in changes) ensureMenus();
});

// Toolbar button toggles sidebar (Firefox 114+ supports open/close/toggle via sidebarAction)
browser.action.onClicked.addListener(async () => {
  try {
    if (browser.sidebarAction.toggle) await browser.sidebarAction.toggle();
    else await browser.sidebarAction.open();
  } catch (_) {
    try { await browser.sidebarAction.open(); } catch (_) {}
  }
});

// A data: URI can be megabytes of inline base64. Clip it at capture time so
// the blob never crosses the message bus or lands in the queued payloads in
// storage.session — the mime-type prefix plus the length is all the model
// needs (the base64 body has no analyzable URL structure). Non-data URLs are
// normal web URLs; the 2000-char cap only guards against absurd query strings.
function clipImageSrc(src) {
  if (!src) return null;
  if (src.startsWith("data:")) {
    const comma = src.indexOf(",");
    const header = (comma === -1 ? src.slice(0, 200) : src.slice(0, comma + 1)).slice(0, 200);
    return `${header}… (inline image data omitted, ${src.length} chars)`;
  }
  return src.slice(0, 2000);
}

const menuListener = async (info, tab) => {
  // Native "Open {provider}" analog: just show the panel, no prompt.
  if (info.menuItemId === "ask-open") {
    try {
      await browser.sidebarAction.open();
    } catch (_) {}
    return;
  }
  const selection = (info.selectionText || "").slice(0, 8000);
  // Parent clicked on a page with no selection: don't send URL-only prompt.
  if ((info.menuItemId === "ask-lmstudio") && !selection.trim()) {
    return;
  }
  // Send structured payload; sidebar formats the final prompt exactly once.
  // windowId scopes the prompt to the window the menu was clicked in, so a
  // sidebar open in another window doesn't answer too (best effort — the
  // sidebar falls back to processing when it can't resolve its own window).
  const payload = {
    type: "ask-selection",
    mode: info.menuItemId || "ask-lmstudio",
    text: selection,
    // Image Source context: menus API fills these only for the matching
    // contexts (srcUrl for image clicks, linkUrl when the image is wrapped
    // in a link), so they stay null for selection/page prompts. srcUrl is
    // pre-clipped so an inline data: blob never travels the bus/queue.
    imageSrc: clipImageSrc(info.srcUrl),
    linkUrl: info.linkUrl || null,
    pageUrl: info.pageUrl || tab?.url || null,
    windowId: typeof tab?.windowId === "number" ? tab.windowId : null,
  };

  try {
    await browser.sidebarAction.open();
  } catch (_) {}
  // small delay to let sidebar load
  setTimeout(() => {
    browser.runtime.sendMessage(payload).catch(() => {
      // sidebar not listening yet — queue for next open (drained in sidebar init)
      enqueuePending(payload);
    });
  }, 300);
};

(browser.menus || browser.contextMenus).onClicked.addListener(menuListener);
