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

async function ensureMenus() {
  try {
    await browser.menus.removeAll();
  } catch (_) {}
  if (!(await shouldShowOwnMenus())) return; // native-only UX: no duplicate menu
  const menus = browser.menus;
  // No icons — matches the native "Ask {provider}" submenu (GenAI.sys.mjs
  // buildAskChatMenu), which is plain text with no extension/brand icons.
  menus.create({
    id: "ask-lmstudio",
    title: "Ask LM Studio",
    contexts: ["selection", "page"],
  });
  // Selection context: verbatim native genai-prompts labels (genai.ftl)
  menus.create({
    id: "ask-summarize",
    parentId: "ask-lmstudio",
    title: "Summarize",
    contexts: ["selection"],
  });
  menus.create({
    id: "ask-quiz",
    parentId: "ask-lmstudio",
    title: "Quiz me",
    contexts: ["selection"],
  });
  menus.create({
    id: "ask-explain",
    parentId: "ask-lmstudio",
    title: "Explain this",
    contexts: ["selection"],
  });
  menus.create({
    id: "ask-proofread",
    parentId: "ask-lmstudio",
    title: "Proofread",
    contexts: ["selection"],
  });
  // Page (no selection) context: native shows "Summarize Page" + "Open
  // {provider}" instead of the selection prompts — toggled in onShown below.
  menus.create({
    id: "ask-summarize-page",
    parentId: "ask-lmstudio",
    title: "Summarize Page",
    contexts: ["page"],
  });
  menus.create({
    id: "ask-open",
    parentId: "ask-lmstudio",
    title: "Open Ask LM Studio",
    contexts: ["page"],
  });
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
      await browser.menus.update("ask-summarize-page", { visible: !hasSelection });
      await browser.menus.update("ask-open", { visible: !hasSelection });
      await browser.menus.refresh();
    } catch (_) {}
  });
}

async function enqueuePending(payload) {
  try {
    const { pendingPrompts } = await browser.storage.local.get("pendingPrompts");
    const queue = Array.isArray(pendingPrompts) ? pendingPrompts : [];
    queue.push(payload);
    // cap queue so rapid clicks don't grow storage unbounded
    await browser.storage.local.set({ pendingPrompts: queue.slice(-5) });
  } catch (_) {
    try { await browser.storage.local.set({ pendingPrompts: [payload] }); } catch (_) {}
  }
}

browser.runtime.onInstalled.addListener(async () => {
  await ensureMenus();
  // Note: no auto-open — native chatbot is primary UX (see manifest open_at_install=false).
});

browser.runtime.onStartup.addListener(ensureMenus);

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
    pageUrl: tab?.url || "",
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
