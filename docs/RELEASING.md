# Release process

Public macOS releases must be signed with a **Developer ID Application** certificate, use the hardened runtime, and be notarized by Apple. An Apple Development certificate is not sufficient for distribution outside the Mac App Store.

## Required GitHub Actions secrets

Configure these repository secrets:

- `APPLE_CERTIFICATE_P12_BASE64`: Base64-encoded `.p12` containing the Developer ID Application certificate and private key.
- `APPLE_CERTIFICATE_PASSWORD`: Password used when exporting the `.p12`.
- `APPLE_INSTALLER_CERTIFICATE_P12_BASE64`: Base64-encoded `.p12` containing the Developer ID Installer certificate and private key.
- `APPLE_INSTALLER_CERTIFICATE_PASSWORD`: Password used when exporting the installer `.p12`.
- `APPLE_ID`: Apple ID used for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password created at appleid.apple.com.
- `APPLE_TEAM_ID`: Ten-character Apple Developer team ID.

## Versioning

The application release version must match in:

- root `package.json`
- the Codex app-server client metadata
- the Git tag, prefixed with `v`

Prerelease versions use SemVer such as `1.0.2-beta.1`, and their tag must be `v1.0.2-beta.1`. Stable builds ignore prerelease updates; prerelease builds follow newer prereleases and the stable version that supersedes them.

The Stream Deck plugin uses its own release version in `stream-deck/package.json` and a monotonically increasing four-part numeric version in `manifest.json`. Bump both when the plugin payload changes. The companion will update an older installed plugin, will not downgrade a newer plugin, and will not add a plugin to companion-only installations. Release verification fails when plugin code or assets change without a higher manifest version.

Document customer-facing changes in `CHANGELOG.md`.

## Local verification

With a Developer ID certificate installed and notarization credentials exported using electron-builder's supported environment variables:

```bash
npm ci
npm --prefix stream-deck ci
npm run test:updater
npm run test:update-metadata
npm run test:bundled-plugin
npm run test:state
npm run streamdeck:pack
npm run release:mac
npm run release:installers
npm run release:notarize-installers
npm run release:verify
npm run release:verify-installers
npm run release:submission
```

The verification scripts require Developer ID Application and Installer signatures, the expected Apple Team Identifier, accepted Gatekeeper assessments, stapled notarization tickets, the hardened runtime entitlement, the expected complete/companion package contents, a universal binary, and valid `latest-mac.yml` metadata whose SHA-512 matches the update ZIP. The app must contain the fixed public GitHub provider configuration and the bundled plugin.

## Publishing from GitHub Actions

1. Update the version and changelog on `main`.
2. Push the exact matching tag, such as `v1.0.2-beta.1` or `v1.0.2`.
3. The release workflow builds and validates the app and plugin, creates or reuses a draft release, uploads the complete verified asset set, and only then publishes it.
4. Prerelease versions are published as GitHub prereleases. Stable versions are promoted as the latest release.
5. Published updater assets are immutable. If a release is bad, publish a higher version instead of replacing its ZIP or metadata.
6. Install the first updater-enabled prerelease manually on a clean test Mac. Publish a second, higher prerelease and verify the full in-app download, restart, preserved settings, plugin synchronization, and live reconnection before promoting a stable build.

The release contains complete and companion-only macOS installers, the universal DMG, ZIP and blockmap, `latest-mac.yml`, the standalone Stream Deck plugin installer, and checksums. The ZIP and `latest-mac.yml` are required for macOS in-app updates.

Marketplace-only screenshots and upload metadata are generated in the gitignored `marketplace/` directory and are intentionally not published in this repository.
