#!/bin/bash
set -euo pipefail

release_root="${1:-release-production}"
complete_package="$release_root/Deck-Threads-Installer.pkg"
companion_package="$release_root/Deck-Threads-Companion.pkg"
allow_unsigned="${DECK_THREADS_ALLOW_UNSIGNED_INSTALLERS:-0}"

for package_path in "$complete_package" "$companion_package"; do
  if [[ ! -f "$package_path" ]]; then
    echo "Installer package not found: $package_path" >&2
    exit 1
  fi
  if [[ "$allow_unsigned" != "1" ]]; then
    pkgutil --check-signature "$package_path" | grep -q 'Developer ID Installer:'
    spctl --assess --verbose=4 --type install "$package_path"
    xcrun stapler validate "$package_path"
  fi
done

complete_payload="$(pkgutil --payload-files "$complete_package")"
companion_payload="$(pkgutil --payload-files "$companion_package")"

grep -q '^\./Applications/Deck Threads.app/' <<<"$complete_payload"
grep -q '^\./Library/Application Support/Deck Threads/Installer/com.roie.deck-threads.sdPlugin/manifest.json$' <<<"$complete_payload"
grep -q '^\./Applications/Deck Threads.app/' <<<"$companion_payload"
if grep -q 'com.roie.deck-threads.sdPlugin' <<<"$companion_payload"; then
  echo "The companion-only installer unexpectedly contains the Stream Deck plugin." >&2
  exit 1
fi

echo "Complete and companion-only installer contents verified."
