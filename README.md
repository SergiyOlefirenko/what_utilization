# AI Usage Indicator (GNOME Shell Extension)

Shows a small panel indicator with provider icons and remaining quota percent:

`[GitHub icon] gh:<N>% [Codex icon] 5h:<N>% w:<N>%`

- `gh` is GitHub Copilot remaining percent
- `5h` is Codex short-window remaining percent
- `w` is Codex weekly remaining percent

Tokens are stored in the system keyring (libsecret). No tokens are stored in GSettings.

## Installation

Extension UUID: `ai-usage@serhii.local`
Declared GNOME Shell compatibility: `48`, `49`, `50`.

### Option A: Local development install (symlink, recommended while developing)

1. Clone this repository.
2. Compile schemas:
   ```bash
   glib-compile-schemas schemas/
   ```
3. Create a symlink into your user extensions directory:
   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions
   ln -sfn "$(pwd)" ~/.local/share/gnome-shell/extensions/ai-usage@serhii.local
   ```
4. Enable the extension:
   ```bash
   gnome-extensions enable ai-usage@serhii.local
   ```
5. Open preferences:
   ```bash
   gnome-extensions prefs ai-usage@serhii.local
   ```

Important: if your local extension install path is a symlink, do not run
`gnome-extensions install --force` against it. That can replace the symlink
with a real directory and break your linked development setup.

### Option B: User install (copy files)

1. Create install directory:
   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions/ai-usage@serhii.local
   ```
2. From repository root, copy required extension files into it:
   ```bash
   cp -r metadata.json extension.js prefs.js lib schemas assets ~/.local/share/gnome-shell/extensions/ai-usage@serhii.local/
   ```
3. Verify metadata path and UUID:
   ```bash
   test -f ~/.local/share/gnome-shell/extensions/ai-usage@serhii.local/metadata.json
   grep -n '"uuid"' ~/.local/share/gnome-shell/extensions/ai-usage@serhii.local/metadata.json
   ```
4. Compile schemas inside installed extension directory:
   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/ai-usage@serhii.local/schemas
   ```
5. Enable extension:
   ```bash
   gnome-extensions enable ai-usage@serhii.local
   ```

### Apply GNOME Shell changes

- On X11: `Alt` + `F2`, type `r`, press Enter.
- On Wayland: log out and log back in.

## Initial setup

1. Open extension preferences:
   ```bash
   gnome-extensions prefs ai-usage@serhii.local
   ```
2. Set up authentication:
   - In extension preferences, use `Sign in` under Codex to start the OpenAI browser login flow.
   - The extension starts a temporary local callback on `http://localhost:1455/auth/callback` during sign-in.
   - Approve the login in your browser and wait for the browser page to show the sign-in result.
   - Save your GitHub token for Copilot usage endpoint access in the extension keyring.
3. Optionally disable either provider using `Enable Codex polling` / `Enable GitHub Copilot polling`; this also hides that provider's panel metrics.

## Removal (uninstall)

### Remove from current user

1. Disable the extension:
   ```bash
   gnome-extensions disable ai-usage@serhii.local
   ```
2. Delete installed extension directory/symlink:
   ```bash
   rm -rf ~/.local/share/gnome-shell/extensions/ai-usage@serhii.local
   ```
3. Apply GNOME Shell changes (restart shell on X11, re-login on Wayland).

### Optional cleanup of stored tokens

The extension stores tokens in the system keyring. If you want complete removal,
delete these secrets in your keyring UI (`seahorse`) or clear them from extension
preferences before uninstalling.

## Development

- Compile schemas: `glib-compile-schemas schemas/`
- Run core tests (no keyring required): `make test-core`
- Run keyring integration test only: `make test-keyring`
- Run full suite: `make test`

## Notes

These services are not official stable APIs. Changes on the provider side may break parsing.
GNOME 48 is the tested baseline. GNOME 49/50 are predeclared compatibility targets.

## Troubleshooting

- If you see `Settings schema not found`, run `glib-compile-schemas schemas/`.
- If keyring test fails with secret-service connection errors, ensure a Secret Service is running.
- If menu shows `Codex: sign in required`, open extension preferences and use `Sign in` under Codex.
- If your browser does not open automatically, use `Open browser` in the Codex preferences section.
- If the browser cannot reach `http://localhost:1455/auth/callback`, check whether a firewall, browser policy, or another local process is blocking port `1455`.
- If Codex auth keeps expiring, sign out and complete the OpenAI browser login again so the extension can store a fresh refresh token.
- If menu shows `auth failed`, re-save the Copilot token or reconnect Codex in Preferences.
- If `gnome-extensions prefs ai-usage@serhii.local` shows `ImportError` mentioning `extensionUtils.js`,
  your installed files are stale. Re-copy/relink the full extension directory and re-login on Wayland.
- If `gnome-extensions prefs ai-usage@serhii.local` shows
  `Expected type string for argument 'schema_id' but got type undefined`,
  your installed `metadata.json` is missing `settings-schema` or is stale; re-copy/relink the extension directory and re-login.
- If `gnome-extensions enable ai-usage@serhii.local` says `Extension "... does not exist"`:
  - Verify directory path is exactly `~/.local/share/gnome-shell/extensions/ai-usage@serhii.local`.
  - Verify installed `metadata.json` has `"uuid": "ai-usage@serhii.local"`.
  - Verify current GNOME major version is in `"shell-version"` list.
  - Check discovery output:
    ```bash
    gnome-extensions list | grep ai-usage@serhii.local
    ```
  - On Wayland, log out and log back in after install changes.
