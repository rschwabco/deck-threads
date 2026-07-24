# Deck Threads v1.0.1 release acceptance

This record separates completed acceptance from the remaining physical-hardware check for the stable `v1.0.1` release. The stable candidate promotes the code tested as `v1.0.1-beta.3` at commit `09f534f0de0ca6572ff851e1d22c80c34fe82dc9`.

Public release evidence:

- [v1.0.1-beta.3 release](https://github.com/rschwabco/deck-threads/releases/tag/v1.0.1-beta.3)
- [v1.0.1-beta.3 release workflow](https://github.com/rschwabco/deck-threads/actions/runs/30034890008)
- Complete installer SHA-256: `a0ae62d1ce01b1d2c0d9128848262033f17bc93deee72f3192f8fd2ab8995063`

## Completed acceptance

| Surface | Result | Evidence |
| --- | --- | --- |
| Release identity | Pass | The complete installer checksum matched `SHA256SUMS.txt`; its package signature was trusted and notarized for Team `W7F2CX5957`. |
| Installed application | Pass | Deep code-signing validation, Gatekeeper assessment, and stapler validation passed. The application contains both `arm64` and `x86_64` slices. |
| In-app update | Pass | An installed beta.2 discovered beta.3, downloaded it, restarted automatically, reopened as beta.3, and reconnected to eight task slots. |
| Clean first run | Pass with scope noted | The exact signed installer payload launched with isolated application data, created defaults, exposed a healthy local API, rendered eight task slots, and discovered both providers. This was a payload-level first run, not an administrator-authorized system package installation. |
| Intel runtime | Pass in CI when the `Intel runtime acceptance` check is green | The candidate builds and launches its Electron UI on GitHub's `macos-15-intel` runner, then proves the local API, version identity, default allocation, and eight rendered task slots. A local Rosetta run also exercised the packaged `x86_64` slice. |
| Packaged plugin | Pass | Plugin `1.0.2.0` was installed as a real directory from the official installer payload, not a development symlink. Its JavaScript matched the bundled copy byte-for-byte and reconnected to Stream Deck. |
| Existing settings | Pass | Display and source-allocation file hashes were unchanged after installing and restarting the packaged plugin. |
| Provider allocation | Pass | Codex-only, Claude-only, and mixed allocation modes rendered correctly; the original adaptive 4/4 allocation was restored. |
| Task opening | Pass at the application layer | A Codex task opened in Codex and a Claude task opened in Claude, with the exact requested task visible in each destination application. |
| Attached keypad | Pass for Stream Deck Plus | The installed packaged plugin connected to one Stream Deck Plus and rendered the expected eight-key layout. |

## Required before publishing the stable tag

One physical acceptance step remains because only a Stream Deck Plus was available during this audit:

1. Connect one supported non-Plus Stream Deck keypad.
2. Place populated Deck Threads task-slot actions on it.
3. Press one Codex key and one Claude key.
4. Record that each press opened the exact corresponding task and that reconnecting preserved the key layout.

Do not publish `v1.0.1` until that result is attached to the release decision. Once it passes, tag the exact accepted candidate and rerun signing, notarization, checksum, installer, updater-metadata, and bundled-plugin verification against the stable artifacts.
