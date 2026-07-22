#!/bin/bash
set -euo pipefail

release_root="${1:-release-production}"
packages=(
  "$release_root/Deck-Threads-Installer.pkg"
  "$release_root/Deck-Threads-Companion.pkg"
)

for package_path in "${packages[@]}"; do
  if [[ ! -f "$package_path" ]]; then
    echo "Installer package not found: $package_path" >&2
    exit 1
  fi
  xcrun notarytool submit "$package_path" \
    --apple-id "$APPLE_ID" \
    --team-id "$APPLE_TEAM_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --wait
  xcrun stapler staple "$package_path"
done
