# AI Usage Indicator (GNOME Shell Extension)

Shows a small panel label with:

`gh:<N>% d:<N>% w:<N>%`

- `gh` is GitHub Copilot usage percent
- `d` is Codex daily usage percent
- `w` is Codex weekly usage percent

Tokens are stored in the system keyring (libsecret). No tokens are stored in GSettings.

## Setup

1. Install the extension in your GNOME Shell extensions directory.
2. Open extension preferences.
3. Save tokens in the keyring:
   - Codex API token for `api.openai.com`.
   - GitHub token for Copilot usage endpoint access.
4. Optionally disable either provider using `Enable Codex polling` / `Enable GitHub Copilot polling`.

## Development

- Compile schemas: `glib-compile-schemas schemas/`
- Run core tests (no keyring required): `make test-core`
- Run keyring integration test only: `make test-keyring`
- Run full suite: `make test`

## Notes

These services are not official stable APIs. Changes on the provider side may break parsing.

## Troubleshooting

- If you see `Settings schema not found`, run `glib-compile-schemas schemas/`.
- If keyring test fails with secret-service connection errors, ensure a Secret Service is running.
- If menu shows `auth failed`, re-save the token for that provider in Preferences.
