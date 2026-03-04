# AI Usage Indicator (GNOME Shell Extension)

Shows a small panel label with:

`gh:<N>% d:<N>% w:<N>%`

- `gh` is GitHub Copilot usage percent
- `d` is Codex daily usage percent
- `w` is Codex weekly usage percent

Tokens are stored in the system keyring (libsecret). No tokens are stored in GSettings.

## Development

- Compile schemas: `glib-compile-schemas schemas/`
- Run tests: `make test`

## Notes

These services are not official stable APIs. Changes on the provider side may break parsing.
