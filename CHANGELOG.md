# Changelog

## Unreleased

## 1.0.1-beta.2 — 2026-07-22

- Added signed in-app updates from public GitHub Releases with a single Update now action, download progress, automatic restart, stable and prerelease channels, and retry handling.
- Added safe bundled Stream Deck plugin synchronization with version ordering, companion-only opt-out, atomic replacement, and rollback.
- Added immutable draft-release publishing and verification for updater metadata, ZIP hashes, embedded provider configuration, and Apple Team identity.

## 1.0.1 — 2026-07-22

- Added local Claude Code task monitoring alongside Codex, including sidebar titles, pinned tasks, archived-task filtering, lifecycle status, and reliable desktop task switching.
- Added configurable Codex/Claude key reservations with a 4/4 default and optional borrowing of unused capacity.
- Added per-app background colors and four animation choices for every task status.
- Added per-app controls for slot-handle and thread-name font sizes.
- Kept configured typography consistent between active and inactive Stream Deck slots.
- Updated companion and Stream Deck keys to use blue or orange source borders with configurable status-colored surfaces.
- Kept compact project task numbers stable across status and priority changes.

## 1.0.0 — 2026-07-20

- Introduced the Deck Threads macOS companion and Stream Deck plugin.
- Added an eight-key, two-row live task layout with active-task priority and stable physical slots.
- Added project-local compact labels, pinned-project markers, and distinct working, question, unread, read, waiting, and error treatments.
- Added an orange attention state when Codex is waiting for an answer.
- Added persistent per-state controls for showing or hiding full task titles on Stream Deck keys.
- Split Threads, Connections, Key labels, and Activity into dedicated companion views so settings are not buried in one scrolling dashboard.
- Added one-press opening of the matching Codex Desktop task.
- Added a local connection dashboard, macOS menu-bar access, and automatic launch at login.
- Added a Stream Deck setup panel with live companion status.
