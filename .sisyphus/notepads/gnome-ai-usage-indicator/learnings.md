# Learnings

## 2026-03-04 (recovery rebuild)
- Keep tokens in keyring only (libsecret); never store or log them.
- Panel label must stay exact: `gh:<N>% d:<N>% w:<N>%` with `--` placeholders.
- Providers are testable by injecting transport; `make test` stays offline-safe.
- `gnome-extensions install --force` can follow symlinks and delete the symlink target.
