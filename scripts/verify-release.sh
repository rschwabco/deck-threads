#!/bin/bash
set -euo pipefail

release_root="${1:-release-production}"
app_path="$(find "$release_root" -type d -name 'Deck Threads.app' -print -quit)"

if [[ -z "$app_path" ]]; then
  echo "Deck Threads.app was not found under $release_root" >&2
  exit 1
fi

signature_details="$(codesign -dv --verbose=4 "$app_path" 2>&1)"
if ! grep -q '^Authority=Developer ID Application:' <<<"$signature_details"; then
  echo "Release is not signed with a Developer ID Application certificate." >&2
  exit 1
fi
if grep -q '^TeamIdentifier=not set$' <<<"$signature_details"; then
  echo "Release has no Apple Team Identifier." >&2
  exit 1
fi
expected_team_id="${DECK_THREADS_APPLE_TEAM_ID:-${APPLE_TEAM_ID:-W7F2CX5957}}"
actual_team_id="$(sed -n 's/^TeamIdentifier=//p' <<<"$signature_details" | head -1)"
if [[ "$actual_team_id" != "$expected_team_id" ]]; then
  echo "Release Team Identifier $actual_team_id does not match expected Team Identifier $expected_team_id." >&2
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$app_path"
spctl --assess --verbose=4 --type execute "$app_path"
xcrun stapler validate "$app_path"

executable="$app_path/Contents/MacOS/Deck Threads"
architectures="$(lipo -archs "$executable")"
if [[ "$architectures" != *"arm64"* || "$architectures" != *"x86_64"* ]]; then
  echo "Release is not universal. Found architectures: $architectures" >&2
  exit 1
fi

if ! codesign -d --entitlements :- "$app_path" 2>/dev/null | grep -q 'com.apple.security.cs.allow-jit'; then
  echo "Release is missing the Electron JIT entitlement." >&2
  exit 1
fi

node scripts/verify-update-metadata.cjs "$release_root"

find "$release_root" -maxdepth 1 -type f \( -name 'Deck-Threads-*.dmg' -o -name 'Deck-Threads-*.zip' \) -print
echo "Developer ID signature, Hardened Runtime, Gatekeeper, notarization, updater metadata, and universal binary checks passed."
