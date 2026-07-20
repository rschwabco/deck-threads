# Deck Threads

Deck Threads puts your live Codex Desktop tasks on Stream Deck. Eight keys show the work that matters now, hold their physical positions while a task remains selected, and open the exact task in Codex with one press.

![Deck Threads showing eight live Codex Desktop tasks on Stream Deck](docs/images/hero.png)

Deck Threads is an independent, open-source utility. It is not affiliated with or endorsed by OpenAI or Elgato.

## What it does

- Shows eight prioritized Codex Desktop tasks in a 4 × 2 Stream Deck layout.
- Gives recently active tasks priority, followed by tasks from pinned projects.
- Keeps active tasks in stable physical slots, including across companion restarts.
- Uses compact project-local labels such as `DT1` and `MP2`.
- Turns a key orange when Codex asks a question and is waiting for your answer.
- Distinguishes working, question, unread, read, waiting, and error states with full-key color and motion.
- Lets you choose, per state, whether Stream Deck keys show the full task title or only the compact project label.
- Keeps Threads, Connections, Key labels, and Activity in separate companion views.
- Opens the exact Codex task when its key is pressed.
- Runs locally in the macOS menu bar and starts automatically at login.
- Keeps task data on your Mac; the companion only listens on `127.0.0.1`.

## Requirements

- macOS 13 Ventura or later on Apple silicon or Intel.
- [Codex Desktop](https://openai.com/codex/) installed and running.
- Stream Deck 7.1 or later.
- A keypad Stream Deck device. The bundled profile is designed for Stream Deck +; the action can be placed manually on other keypad models.

## Install

1. Open the [latest Deck Threads release](https://github.com/rschwabco/deck-threads/releases/latest).
2. Download `Deck-Threads-1.0.0-universal.dmg`, open it, and drag **Deck Threads** to Applications.
3. Download `com.roie.deck-threads.streamDeckPlugin` and double-click it. Stream Deck will ask you to confirm installation.
4. Open **Deck Threads** from Applications. The app adds a menu-bar item and enables launch at login.
5. Keep Codex Desktop and Stream Deck running. The bundled 4 × 2 profile installs automatically on Stream Deck +.

For device-specific setup, manual action placement, verification, and uninstall instructions, see the [complete setup guide](docs/SETUP.md).

## How it works

The macOS companion reads Codex Desktop's local runtime state and asks the local Codex app-server for the same task titles shown in the Codex sidebar. It assigns the eight selected tasks to stable slots and exposes that state through a loopback-only HTTP service on `127.0.0.1:9876`. The Stream Deck plugin polls that service, renders each key locally, and asks the companion to open a `codex://` deep link when a key is pressed.

No OpenAI API key is required. Deck Threads has no analytics, account system, cloud storage, or remote backend.

## Documentation

- [Complete setup guide](docs/SETUP.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Privacy](docs/PRIVACY.md)
- [Support](docs/SUPPORT.md)
- [Development](docs/DEVELOPMENT.md)
- [Release process](docs/RELEASING.md)

## Build from source

```bash
git clone https://github.com/rschwabco/deck-threads.git
cd deck-threads
npm install
npm --prefix stream-deck install
npm run test:state
npm run build
npm run streamdeck:pack
```

Creating a public macOS release additionally requires an Apple Developer account, a Developer ID Application certificate, and notarization credentials. See [Releasing](docs/RELEASING.md).

## License

[MIT](LICENSE)
