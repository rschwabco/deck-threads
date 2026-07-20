#!/bin/bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
production_root="$project_root/release-production"
output_root="$project_root/release-submission"

mkdir -p "$output_root"
find "$output_root" -maxdepth 1 -type f -delete

artifacts=()
while IFS= read -r artifact; do
  artifacts+=("$artifact")
done < <(find "$production_root" -maxdepth 1 -type f \( -name 'Deck-Threads-*.dmg' -o -name 'Deck-Threads-*.zip' \) -print | sort)

plugin_package="$(find "$project_root" "$project_root/stream-deck" -maxdepth 2 -type f -name 'com.roie.deck-threads.streamDeckPlugin' -print -quit)"
if [[ -n "$plugin_package" ]]; then
  artifacts+=("$plugin_package")
fi

if [[ ${#artifacts[@]} -lt 3 ]]; then
  echo "Expected a DMG, ZIP, and Stream Deck plugin package. Build and verify the release first." >&2
  exit 1
fi

for artifact in "${artifacts[@]}"; do
  cp "$artifact" "$output_root/"
done

(
  cd "$output_root"
  shasum -a 256 ./* > SHA256SUMS.txt
)

echo "Prepared release artifacts in $output_root"
