# Privacy

Last updated: July 21, 2026

Deck Threads is a local macOS companion and Stream Deck plugin. It does not have an account system, analytics, advertising, telemetry, or a hosted backend.

## Data Deck Threads reads

To display your work, the companion reads local Codex Desktop task state, including task identifiers, task titles, project names or paths, timestamps, pinned-project state, and task status. It asks the locally installed Codex app-server for task titles so labels match the Codex Desktop sidebar.

For Claude, the companion asks the locally installed Claude Code binary for active session metadata and reads a bounded tail of the corresponding local session file to determine whether the session is working, asking a question, or finished. Deck Threads keeps the session identifier, task title, project path, timestamps, and derived state in memory for display; it does not store a separate copy of Claude messages.

## Where data goes

Selected task metadata is sent only between the Deck Threads companion and its Stream Deck plugin through an HTTP service bound to `127.0.0.1:9876`. A loopback address is accessible from the same Mac and is not exposed as a network service to other devices.

Deck Threads does not send task data to the developer, GitHub, Elgato, Anthropic, OpenAI, or another remote service. The plugin renders key images locally.

## Data stored

The companion stores the identifiers assigned to its eight physical slots, the selected Codex/Claude reservation, and the unused-key preference in its local application-data folder. It does not create a separate archive of task messages or task contents.

## User actions

When you press a populated key, the local plugin asks the local companion to open that task using a `codex://` or `claude://` link. The owning app handles the link under its own terms and privacy practices.

## Removing local data

Uninstalling the plugin removes its installed files. Moving Deck Threads to Trash removes the app. You may also remove `~/Library/Application Support/Deck Threads` to delete saved slot assignments.

## Contact

Questions or suspected privacy issues can be reported through [GitHub Issues](https://github.com/rschwabco/deck-threads/issues). Do not include private task titles, project names, source code, or credentials in a public issue.
