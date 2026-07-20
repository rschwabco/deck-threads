# Release process

Public macOS releases must be signed with a **Developer ID Application** certificate, use the hardened runtime, and be notarized by Apple. An Apple Development certificate is not sufficient for distribution outside the Mac App Store.

## Required GitHub Actions secrets

Configure these repository secrets:

- `APPLE_CERTIFICATE_P12_BASE64`: Base64-encoded `.p12` containing the Developer ID Application certificate and private key.
- `APPLE_CERTIFICATE_PASSWORD`: Password used when exporting the `.p12`.
- `APPLE_ID`: Apple ID used for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password created at appleid.apple.com.
- `APPLE_TEAM_ID`: Ten-character Apple Developer team ID.

## Versioning

Keep these versions aligned:

- root `package.json`
- `stream-deck/package.json`
- plugin `manifest.json` using four numeric components
- the Codex app-server client metadata

Document customer-facing changes in `CHANGELOG.md`.

## Local verification

With a Developer ID certificate installed and notarization credentials exported using electron-builder's supported environment variables:

```bash
npm ci
npm --prefix stream-deck ci
npm run test:state
npm run streamdeck:pack
npm run release:mac
npm run release:verify
npm run release:submission
```

The verification script requires a Developer ID signature, Team Identifier, accepted Gatekeeper assessment, stapled notarization ticket, hardened runtime entitlement, and a universal binary.

## Publishing from GitHub Actions

1. Update the version and changelog on `main`.
2. Push a tag such as `v1.0.0`.
3. The release workflow builds and validates the app and plugin, then creates a GitHub Release containing the universal DMG, ZIP, Stream Deck plugin installer, and SHA-256 checksums.
4. Install the release artifacts on a clean test Mac before promoting or submitting the product.

Marketplace-only screenshots and upload metadata are generated in the gitignored `marketplace/` directory and are intentionally not published in this repository.
