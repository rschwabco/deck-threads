# Deck Threads setup guide

This guide installs the Deck Threads macOS companion and Stream Deck plugin, then verifies that live Codex and Claude Code tasks appear on your keys.

## Before you start

You need:

- macOS 13 Ventura or later.
- Codex Desktop installed in `/Applications` and signed in, an installed Claude Code or Claude Desktop, or both.
- Stream Deck 7.1 or later with a keypad device connected.
- Permission to install an app in `/Applications` and a Stream Deck plugin.

Deck Threads supports Apple silicon and Intel Macs through one universal app build.

## 1. Install the companion

1. Go to the [latest GitHub release](https://github.com/rschwabco/deck-threads/releases/latest).
2. Download the universal `.dmg` file.
3. Open the disk image.
4. Drag **Deck Threads** into the **Applications** folder.
5. Eject the Deck Threads disk image.
6. Open **Deck Threads** from Applications.

The companion opens a status window, adds an eight-slot icon to the macOS menu bar, and enables **Open at Login**. Closing its window leaves the companion running; choose **Quit Deck Threads** from the menu-bar item to stop it.

## 2. Install the Stream Deck plugin

1. From the same GitHub release, download `com.roie.deck-threads.streamDeckPlugin`.
2. Double-click the downloaded file.
3. Confirm installation in the Stream Deck app.
4. If Stream Deck does not refresh automatically, quit and reopen it once.

The plugin includes a 4 × 2 profile for Stream Deck +. It also adds **Deck Threads → Task slot** to the actions list.

## 3. Choose a layout

### Stream Deck + bundled profile

The included profile automatically places eight task slots in two horizontal rows of four. Select **Deck Threads** from Stream Deck's profile menu if it is not already visible.

### Other keypad Stream Deck devices

Create or open any profile, then drag **Deck Threads → Task slot** onto eight keys. Slots are derived from the key coordinates:

```text
1  2  3  4
5  6  7  8
```

You can use fewer than eight keys. Each key still represents the corresponding slot.

## 4. Verify the connection

1. Open Codex Desktop and/or start a Claude Code session. Claude tasks are active local Code sessions, not ordinary Claude chat tabs.
2. Open Deck Threads from the menu-bar item.
3. Confirm that the agent apps you use, **Local companion**, and **Stream Deck** report connected.
4. Select any Task slot action in the Stream Deck app. Its setup panel should say **Companion connected**.
5. Press a populated task key. A blue border identifies Codex, while an orange border identifies Claude; the matching app should open the task.

Keys refresh automatically. You do not need a refresh action.

## Reading the keys

- **Working** uses a prominent animated field and minimal text.
- **Question** uses a high-attention status surface when Codex or Claude is waiting for your answer.
- **Unread** uses a stronger attention animation to signal completed work you have not opened.
- **Read** stays calm and does not show a `READ` label.
- **Waiting** and **Error** use their own status colors.
- The compact label combines a project abbreviation and that task's number inside the project, such as `DT1`.
- Task numbers remain fixed when status, recency, or priority changes. They follow the saved manual order when you rearrange tasks inside a Codex project.
- A small marker identifies tasks from pinned projects.
- The border identifies the owning app: blue for Codex and orange for Claude. The key background indicates status.

Open the Deck Threads companion, select **Key labels** in the sidebar, and use **Show thread titles** to choose whether each state includes the full task title. These choices are saved on your Mac and picked up by the Stream Deck plugin automatically.

Recently active tasks are selected first, followed by tasks from pinned projects. Once a selected task owns a slot, it does not move just because another task's priority changes; it only leaves when it is no longer among the selected eight.

## Choose how keys are allocated

Open **Sources** in the Deck Threads companion. The default reservation is four Codex keys and four Claude keys. Select any split from all-Claude to all-Codex.

**Fill unused keys with active tasks** is on by default. Reservations remain balanced when both apps have enough work, but the other app can borrow unused keys. For example, six active Codex tasks and two active Claude tasks appear as 6/2 instead of leaving two Codex tasks hidden. Turn the setting off for a strict per-app limit.

## Start at login

Deck Threads enables launch at login the first time the packaged app starts. You can verify this in **System Settings → General → Login Items**. The companion must be running for the Stream Deck keys to update.

## Updating

1. Quit Deck Threads from its menu-bar item.
2. Download the newer release.
3. Replace the existing app in Applications.
4. Double-click the newer `.streamDeckPlugin` file and approve replacement if the release includes one.

Your stable slot assignments and source allocation are stored in the app's local data folder and survive normal updates.

## Uninstalling

1. Quit Deck Threads from the menu bar.
2. Move `/Applications/Deck Threads.app` to Trash.
3. In Stream Deck, open **Preferences → Plugins**, find Deck Threads, and choose **Uninstall**.
4. Remove Deck Threads from **System Settings → General → Login Items** if macOS still lists it.

Optional: remove `~/Library/Application Support/Deck Threads` to delete saved slot assignments. This is irreversible, so only do it if you do not want to preserve your layout for a later reinstall.

If anything does not match this guide, continue with [Troubleshooting](TROUBLESHOOTING.md).
