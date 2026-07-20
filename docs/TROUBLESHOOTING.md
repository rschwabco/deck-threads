# Troubleshooting

## Keys say the companion is offline

Open Deck Threads from Applications or its macOS menu-bar item. In the Stream Deck app, select a Task slot action and press **Check again**. The local health endpoint should also respond in Terminal:

```bash
curl http://127.0.0.1:9876/v1/health
```

If another process is already using port `9876`, quit that process or the older Deck Threads instance, then reopen Deck Threads.

## Deck Threads cannot see Codex Desktop

- Confirm Codex Desktop is installed in Applications and currently running.
- Confirm you are signed in and the Codex sidebar contains tasks.
- Quit and reopen both Codex Desktop and Deck Threads.
- Install the newest Deck Threads release. Codex Desktop's local interfaces can change over time, and a compatibility update may be required.

## A key opens the wrong task

Open the Deck Threads window and compare the slot number and compact label with the physical key. If the wrong task still opens, quit Deck Threads, reopen it, and try again. Please include both labels—but no sensitive task content—in a support report.

## Questions or needs-input tasks do not turn orange

In the Stream Deck app, select one of the eight task keys. Its action must be **Deck Threads → Task slot**. Older development profiles may still use **Codex Threads → Codex task**; those actions do not support the orange question state. Replace each legacy action with **Deck Threads → Task slot** in the same position, then restart Stream Deck. The slot number is inferred from the key's position.

## The bundled profile is missing

The bundled profile targets Stream Deck +. On another device, create a profile and manually drag **Deck Threads → Task slot** onto your keys. On Stream Deck +, reinstall the `.streamDeckPlugin` package and restart the Stream Deck app once.

## The plugin is installed but the action is missing

Search the action sidebar for **Deck Threads**. If it is still absent:

1. Open **Stream Deck → Preferences → Plugins** and confirm Deck Threads is installed.
2. Quit and reopen Stream Deck.
3. Reinstall the plugin from the latest GitHub release.

## macOS blocks the companion

Only install Deck Threads from this repository's official releases. Public releases are expected to be signed with a Developer ID certificate and notarized by Apple. If macOS reports that the developer cannot be verified, check the release notes: you may have downloaded a development or pre-release build that is not intended for normal installation.

## Getting logs

The companion shows recent local connection events in its window. Stream Deck plugin logs are stored by the Stream Deck app under:

```text
~/Library/Logs/ElgatoStreamDeck/
```

Remove private task names, project paths, or other workspace data before attaching logs to a public issue.

Still stuck? Follow the private-data guidance in [Support](SUPPORT.md) and open a GitHub issue.
