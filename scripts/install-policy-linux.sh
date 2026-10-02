#!/usr/bin/env bash
# One-command installer for LM Studio native chatbot provider (Linux).
# Merges policies/lm-studio.json into Firefox distribution policies.json
# so you don't have to hand-copy JSON.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)/policies/lm-studio.json"
DEST_CANDIDATES=(
  "/usr/lib/firefox/distribution/policies.json"
  "/usr/lib64/firefox/distribution/policies.json"
  "/etc/firefox/policies/policies.json"
)
DEST_CANDIDATES+=(
  "/snap/firefox/common/.mozilla/distribution/policies.json"
  "$HOME/.var/app/org.mozilla.firefox/data/firefox/distribution/policies.json"
)
DEST=""
for c in "${DEST_CANDIDATES[@]}"; do
  # Prefer a Firefox install dir that actually exists
  if [ -d "$(dirname "$c")" ]; then
    DEST="$c"
    break
  fi
done
if [ -z "$DEST" ]; then
  # Fallback: standard system path (works for .deb/.rpm + /etc override)
  if [ -d "/usr/lib/firefox" ]; then
    DEST="/usr/lib/firefox/distribution/policies.json"
  else
    DEST="/etc/firefox/policies/policies.json"
  fi
fi
echo "Source: $SRC"
echo "Dest:   $DEST"
echo "Firefox: $(firefox --version 2>/dev/null || echo 'not on PATH')"
if ! sudo -n true 2>/dev/null; then
  echo "NOTE: sudo password will be required (dest is system-wide)."
  echo "If you cannot sudo, use the no-sudo fallback instead:"
  echo "  about:config -> browser.ml.chat.providers (see README §4), no restart as admin needed."
fi
sudo mkdir -p "$(dirname "$DEST")"
if ! sudo cp "$DEST" "$DEST.bak.$(date +%s)" 2>/dev/null; then
  echo "(no existing policies.json to back up — first install)"
fi
TMP_MERGED="$(mktemp)"
python3 - "$SRC" "$DEST" "$TMP_MERGED" <<'PY'
import json, sys, os
src, dest, out = sys.argv[1], sys.argv[2], sys.argv[3]
with open(src) as f:
    new = json.load(f)["policies"]["AIChatbot"]
existing = {"policies": {}}
if os.path.exists(dest):
    try:
        with open(dest) as f:
            existing = json.load(f)
    except Exception as e:
        print(f"Existing {dest} unreadable, overwriting: {e}")
pol = existing.setdefault("policies", {}).setdefault("AIChatbot", {})
prov = pol.setdefault("Providers", {})
# Deep-merge BuiltIn flags: add ours, but never flip a value the user already
# set (matches the Windows installer, which only ensures localhost).
# NB: the key is "BuiltIn" — Firefox (AIChatbotPolicies.sys.mjs) ignores the
# misspelled "Builtin" that appears in Mozilla's own schema examples.
prov.pop("Builtin", None)  # drop the inert misspelling from older installs
builtin_new = new.get("Providers", {}).get("BuiltIn", {})
builtin_old = prov.setdefault("BuiltIn", {})
for k, v in builtin_new.items():
    builtin_old.setdefault(k, v)
# Merge Add[] by id (preserve other custom providers)
add_new = new.get("Providers", {}).get("Add", [])
add_old = prov.setdefault("Add", [])
by_id = {p.get("id"): p for p in add_old if isinstance(p, dict) and p.get("id")}
for p in add_new:
    by_id[p["id"]] = p
prov["Add"] = list(by_id.values())
if "Default" in new.get("Providers", {}):
    prov["Default"] = new["Providers"]["Default"]
# Merge Prompts (preserve other prompt keys)
prompts_new = new.get("Prompts", {})
prompts_old = pol.setdefault("Prompts", {})
prompts_old.update(prompts_new)
with open(out, "w") as f:
    json.dump(existing, f, indent=2)
    f.write("\n")
print(f"Merged OK -> {out}")
PY
# Validate + install with sudo (dest is root-owned on most distros)
python3 -m json.tool "$TMP_MERGED" > /dev/null
if ! sudo cp "$TMP_MERGED" "$DEST"; then
  echo "ERROR: could not write $DEST (sudo failed)."
  echo "Merged file kept at: $TMP_MERGED"
  echo "Manually copy it with: sudo cp '$TMP_MERGED' '$DEST'"
  exit 1
fi
rm -f "$TMP_MERGED"
echo "Installed to $DEST (backup alongside, if any)."
echo "1. Fully quit Firefox (not just close window), reopen."
echo "2. Open about:policies -> must show AIChatbot under Active Policies (not Errors)."
echo "3. Open chatbot sidebar -> provider dropdown should list 'LM Studio (local)'."
echo "If about:policies shows Errors, paste the error here."
