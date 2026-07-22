#!/bin/bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
release_root="${1:-$project_root/release-production}"
output_root="${2:-$release_root}"
app_path="$(find "$release_root" -type d -name 'Deck Threads.app' -print -quit)"
plugin_package="$project_root/stream-deck/com.roie.deck-threads.streamDeckPlugin"
installer_scripts="$project_root/installer/scripts"
version="$(node -p "require('$project_root/package.json').version")"
installer_identity="${DECK_THREADS_INSTALLER_IDENTITY:-}"
signing_keychain="${DECK_THREADS_SIGNING_KEYCHAIN:-}"

if [[ -z "$app_path" ]]; then
  echo "Deck Threads.app was not found under $release_root" >&2
  exit 1
fi
if [[ ! -f "$plugin_package" ]]; then
  echo "The packaged Stream Deck plugin was not found at $plugin_package" >&2
  exit 1
fi
if [[ ! -x "$installer_scripts/postinstall" ]]; then
  echo "The installer postinstall script must be executable." >&2
  exit 1
fi
if [[ -z "$installer_identity" && "${DECK_THREADS_ALLOW_UNSIGNED_INSTALLERS:-0}" != "1" ]]; then
  echo "Set DECK_THREADS_INSTALLER_IDENTITY to a Developer ID Installer identity." >&2
  exit 1
fi

work_root="$(mktemp -d "${TMPDIR:-/tmp}/deck-threads-installers.XXXXXX")"
trap '/bin/rm -rf "$work_root"' EXIT

complete_root="$work_root/complete-root"
companion_root="$work_root/companion-root"
complete_components="$work_root/complete-components.plist"
companion_components="$work_root/companion-components.plist"

/bin/mkdir -p \
  "$complete_root/Applications" \
  "$complete_root/Library/Application Support/Deck Threads/Installer" \
  "$companion_root/Applications" \
  "$output_root"
/usr/bin/ditto "$app_path" "$complete_root/Applications/Deck Threads.app"
/usr/bin/ditto "$app_path" "$companion_root/Applications/Deck Threads.app"
/usr/bin/unzip -q "$plugin_package" -d "$complete_root/Library/Application Support/Deck Threads/Installer"
if [[ ! -f "$complete_root/Library/Application Support/Deck Threads/Installer/com.roie.deck-threads.sdPlugin/manifest.json" ]]; then
  echo "The Stream Deck plugin package did not contain the expected plugin bundle." >&2
  exit 1
fi

/usr/bin/pkgbuild --analyze --root "$complete_root" "$complete_components"
/usr/bin/pkgbuild --analyze --root "$companion_root" "$companion_components"
for components in "$complete_components" "$companion_components"; do
  component_index=0
  while /usr/libexec/PlistBuddy -c "Print :$component_index" "$components" >/dev/null 2>&1; do
    /usr/libexec/PlistBuddy -c "Set :$component_index:BundleIsRelocatable false" "$components"
    /usr/libexec/PlistBuddy -c "Set :$component_index:BundleOverwriteAction upgrade" "$components"
    component_index=$((component_index + 1))
  done
done

build_package() {
  local root="$1"
  local identifier="$2"
  local components="$3"
  local output="$4"
  local command=(
    /usr/bin/pkgbuild
    --root "$root"
    --component-plist "$components"
    --scripts "$installer_scripts"
    --identifier "$identifier"
    --version "$version"
    --install-location /
    --ownership recommended
  )
  if [[ -n "$installer_identity" ]]; then
    command+=(--sign "$installer_identity")
    if [[ -n "$signing_keychain" ]]; then
      command+=(--keychain "$signing_keychain")
    fi
  fi
  command+=("$output")
  "${command[@]}"
}

build_package \
  "$complete_root" \
  "com.roie.deck-threads.complete-installer" \
  "$complete_components" \
  "$output_root/Deck-Threads-Installer.pkg"
build_package \
  "$companion_root" \
  "com.roie.deck-threads.companion-installer" \
  "$companion_components" \
  "$output_root/Deck-Threads-Companion.pkg"

echo "Prepared Deck-Threads-Installer.pkg and Deck-Threads-Companion.pkg in $output_root"
