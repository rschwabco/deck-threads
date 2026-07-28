#!/bin/bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/deck-threads-postinstall-test.XXXXXX")"
trap '/bin/rm -rf "$test_root"' EXIT

install_root="$test_root/install-root"
test_home="$test_root/home"
source_plugin="$install_root/Library/Application Support/Deck Threads/Installer/com.roie.deck-threads.sdPlugin"
destination_plugin="$test_home/Library/Application Support/com.elgato.StreamDeck/Plugins/com.roie.deck-threads.sdPlugin"
install_policy="$test_home/Library/Application Support/Deck Threads/plugin-install-policy.json"
current_user="$(/usr/bin/id -un)"

/bin/mkdir -p "$test_home"

if /usr/bin/grep -Fq '/usr/bin/pkill -x "Stream Deck"' "$project_root/installer/scripts/postinstall"; then
  echo "Installer must not terminate the Stream Deck host." >&2
  exit 1
fi
/usr/bin/grep -Fq 'streamdeck://plugins/restart/com.roie.deck-threads' "$project_root/installer/scripts/postinstall"

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
/usr/bin/grep -Fqx '{"policy":"companion-only"}' "$install_policy"

write_plugin "$source_plugin" "1.0.1.0" "bundled"
run_postinstall
[[ "$(<"$destination_plugin/marker.txt")" == "bundled" ]]
/usr/bin/grep -Fqx '{"policy":"complete"}' "$install_policy"

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
