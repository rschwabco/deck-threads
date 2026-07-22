# Development

## Repository layout

- `electron/` contains the macOS companion process, local Codex and Claude adapters, source allocator, stable-slot allocator, and loopback HTTP service.
- `src/` contains the companion's React interface.
- `stream-deck/src/` contains the plugin, polling client, action behavior, and key renderer.
- `stream-deck/com.roie.deck-threads.sdPlugin/` contains the plugin manifest and static assets.
- `stream-deck/scripts/build-profile.mjs` creates the bundled 4 × 2 Stream Deck + profile.
- `build/` contains app and menu-bar icon resources.

## Prerequisites

- Node.js 22 or newer.
- npm.
- macOS for running and packaging the Electron companion.
- Stream Deck 7.1 or later for hardware testing.

## Install and run

```bash
npm install
npm --prefix stream-deck install
npm run dev
```

## Build and test

```bash
npm run test:state
npm run build
npm run streamdeck:build
npm run streamdeck:validate
```

To link the development plugin into Stream Deck:

```bash
npm run streamdeck:link
```

To package the plugin installer:

```bash
npm run streamdeck:pack
```

The plugin's working animation updates at approximately 8.3 frames per second, below Stream Deck's 10-updates-per-second guidance.

## Local API

The companion binds only to `127.0.0.1:9876` and exposes:

- `GET /v1/health`
- `GET /v1/threads`
- `POST /v1/threads/:source/:id/open`
- `POST /v1/threads/:id/open` (legacy Codex-only route)
- `POST /v1/focus`

Do not change the server to listen on all network interfaces. Task titles and project data can be sensitive.
