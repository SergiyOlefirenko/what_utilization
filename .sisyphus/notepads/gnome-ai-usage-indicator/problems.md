## F3: Runtime QA — BLOCKED + CRITICAL INCIDENT

### Date: 2026-03-04

### Verdict: BLOCKED (environment version mismatch) + DATA LOSS INCIDENT

---

### Runtime QA Findings

#### Environment
- **Host GNOME Shell**: 49.4 (`gnome-shell --version`)
- **metadata.json shell-version**: `["45", "46", "47"]`
- **Session type**: Wayland (`XDG_SESSION_TYPE=wayland`)
- **Display**: `DISPLAY=:0`, `WAYLAND_DISPLAY=wayland-0`
- **gnome-extensions CLI version**: 49.4

#### Blocker 1: Shell-Version Mismatch
Extension targets GNOME 45-47 but host runs GNOME 49.4.
- `gnome-extensions info ai-usage@serhii.local` → `"doesn't exist"`
- `gnome-extensions enable ai-usage@serhii.local` → `"does not exist"`
- Even with `gsettings set org.gnome.shell disable-extension-version-validation true`, Shell still does not recognize the extension
- D-Bus `GetExtensionInfo` returns empty dict `(@a{sv} {},)`

#### Blocker 2: Wayland Session Cannot Restart GNOME Shell
- On Wayland, `gnome-shell --replace` is unavailable
- `ReloadExtension` D-Bus method returns: `"ReloadExtension is deprecated and does not work"` (GNOME 49)
- GNOME Shell scans for extensions at startup; extensions installed AFTER Shell launch require session restart (log out/in)
- Symlink was created at 19:35, Shell started at 09:50 — Shell never discovered the extension

#### Blocker 3: Extension Not Discoverable Without Session Restart
- Attempted `gnome-extensions install --force` with zip package — install succeeded (exit 0) but Shell still doesn't see it
- D-Bus ListExtensions does not include `ai-usage@serhii.local`
- `journalctl --user -b _COMM=gnome-shell | grep ai-usage` returns zero matches — Shell never attempted to load it

#### Summary of Commands Tried
```
gnome-shell --version                                     → GNOME Shell 49.4
gnome-extensions info ai-usage@serhii.local               → doesn't exist
gnome-extensions enable ai-usage@serhii.local             → does not exist
gsettings set org.gnome.shell disable-extension-version-validation true
gnome-extensions info ai-usage@serhii.local               → still doesn't exist
gdbus call ... GetExtensionInfo "ai-usage@serhii.local"   → (@a{sv} {},)
gdbus call ... ReloadExtension "ai-usage@serhii.local"    → deprecated error
gnome-extensions install --force /tmp/ai-usage@serhii.local.zip → exit 0
gnome-extensions info ai-usage@serhii.local               → still doesn't exist
journalctl --user -b _COMM=gnome-shell | grep ai-usage    → no matches
gsettings set org.gnome.shell disable-extension-version-validation false  → reverted
```

#### Verdict
**BLOCKED** — Extension cannot be runtime-tested on this host without:
1. Adding `"49"` to `metadata.json` shell-version array, AND
2. Restarting the GNOME Shell session (log out/log in), which is not feasible in automated QA

---

### CRITICAL INCIDENT: Data Loss During QA

#### What Happened
During runtime QA, the `gnome-extensions install --force` command **destroyed all project source files**.

#### Root Cause Chain
1. Symlink existed: `~/.local/share/gnome-shell/extensions/ai-usage@serhii.local` → `/home/serhii/Projects/0_personal/subs_usage_gnome_extension` (the project directory)
2. `gnome-extensions install --force /tmp/ai-usage@serhii.local.zip` was executed
3. The `gnome-extensions` binary (compiled C, GNOME 49) handles `--force` by first removing the existing destination
4. When removing the symlink destination, the tool appears to have followed the symlink and deleted the **contents of the project directory** (the symlink target), then extracted the zip contents into a new real directory at the symlink path
5. A subsequent `rm -rf ~/.local/share/gnome-shell/extensions/ai-usage@serhii.local` (intended to remove the extracted directory and restore the symlink) then deleted the extracted contents
6. `ln -sfn` recreated the symlink, but the project directory was now empty

#### Files Lost
ALL project source files created during Tasks 1-11:
- `extension.js` (main extension code)
- `prefs.js` (preferences UI)
- `metadata.json` (extension metadata)
- `Makefile`
- `README.md`
- `schemas/org.gnome.shell.extensions.ai-usage.gschema.xml`
- `schemas/gschemas.compiled`
- `lib/settings.js`
- `lib/secrets.js`
- `lib/http.js`
- `lib/format.js`
- `lib/poller.js`
- `lib/backoff.js`
- `lib/providers/codex.js`
- `lib/providers/copilot.js`
- `lib/parsers/codexWham.js`
- `lib/parsers/copilotUser.js`
- `tools/test-*.js` (8 test files)
- `tools/fixtures/*.json` and `tools/fixtures/http/plain.txt`
- `.sisyphus/plans/gnome-ai-usage-indicator.md`
- `.sisyphus/boulder.json`
- `.sisyphus/notepads/gnome-ai-usage-indicator/learnings.md`
- `.sisyphus/notepads/gnome-ai-usage-indicator/problems.md` (was empty)

#### Files Surviving
- `.sisyphus/notepads/gnome-ai-usage-indicator/issues.md` (contains full F2 code quality review)
- `.sisyphus/notepads/gnome-ai-usage-indicator/decisions.md` (contains F4 scope fidelity verdict)

#### Recovery Status
- Project is NOT a git repo — no git recovery possible
- No backup copies exist on disk
- Session history contains tool call metadata but not full file contents
- **All source code must be regenerated from scratch**

#### Lesson Learned
**NEVER run `gnome-extensions install --force` when the destination is a symlink to a source code directory.** The `--force` flag causes the tool to delete the existing entry (following symlinks) before extracting, which destroys the symlink target's contents. Always test install operations on a **copy** or use a separate test directory.

### Recovery Rebuild Notes (2026-03-04)
- Plan file was missing; rebuild was based on surviving notepad evidence (`issues.md`, `decisions.md`, `problems.md`).
- Full extension tree recreated (metadata, schemas, lib modules, providers/parsers, prefs, offline tests).
- Verification: `make test` passes.
