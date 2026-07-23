#!/bin/bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/deck-threads-postinstall-test.XXXXXX")"
trap '/bin/rm -rf "$test_root"' EXIT

install_root="$test_root/install-root"
test_home="$test_root/home"
source_plugin="$install_root/Library/Application Support/Deck Threads/Installer/com.roie.deck-threads.sdPlugin"
destination_plugin="$test_home/Library/Application Support/com.elgato.StreamDeck/Plugins/com.roie.deck-threads.sdPlugin"
current_user="$(/usr/bin/id -un)"

/bin/mkdir -p "$test_home"

write_plugin() {
  local root="$1"
  local version="$2"
  local marker="$3"
  /bin/mkdir -p "$root"
  printf '{"Version":"%s"}\n' "$version" > "$root/manifest.json"
  printf '%s\n' "$marker" > "$root/marker.txt"
}

run_postinstall() {
  DECK_THREADS_INSTALL_ROOT="$install_root" \
  DECK_THREADS_INSTALL_USER="$current_user" \
  DECK_THREADS_INSTALL_HOME="$test_home" \
  DECK_THREADS_SKIP_LAUNCH=1 \
    "$project_root/installer/scripts/postinstall"
}

# The companion-only installer has no external plugin payload. Installing it
# must not create a Stream Deck plugin from the copy bundled inside the app.
run_postinstall
[[ ! -e "$destination_plugin" ]]

write_plugin "$source_plugin" "1.0.1.0" "bundled"
run_postinstall
[[ "$(<"$destination_plugin/marker.txt")" == "bundled" ]]

printf 'preserve\n' > "$destination_plugin/equal-install.txt"
run_postinstall
[[ -f "$destination_plugin/equal-install.txt" ]]

write_plugin "$destination_plugin" "1.0.2.0" "newer"
run_postinstall
[[ "$(<"$destination_plugin/marker.txt")" == "newer" ]]

write_plugin "$destination_plugin" "invalid" "invalid"
run_postinstall
[[ "$(<"$destination_plugin/marker.txt")" == "bundled" ]]

write_plugin "$destination_plugin" "1.0.0.9" "older"
run_postinstall
[[ "$(<"$destination_plugin/marker.txt")" == "bundled" ]]

echo "Installer postinstall plugin version handling verified."
