#!/usr/bin/env bash
# Print the macOS MDM payload for LM Studio native chatbot provider.
# macOS has no silent local policy write — deploy via MDM or manually create
# /Library/Preferences/org.mozilla.firefox.plist. This script only prints.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)/policies/lm-studio.json"
echo "Source: $SRC"
echo "macOS requires MDM / managed profile for Enterprise Policies."
echo "Payload below. Restart Firefox, check about:policies."
python3 - "$SRC" <<'PY'
import json, sys
src = sys.argv[1]
with open(src) as f:
    chatbot = json.load(f)["policies"]["AIChatbot"]
print("AIChatbot payload to deploy via MDM / defaults:")
print(json.dumps({"AIChatbot": chatbot}, indent=2))
print()
print("To apply locally, create /Library/Preferences/org.mozilla.firefox.plist with EnterprisePoliciesEnabled + AIChatbot, or use:")
print("  sudo defaults write /Library/Preferences/org.mozilla.firefox EnterprisePoliciesEnabled -bool TRUE")
print("Then deploy the above AIChatbot dict via your MDM. See firefox-admin-docs for profile format.")
PY
