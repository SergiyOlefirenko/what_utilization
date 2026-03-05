# Agent Guidelines: AI Usage Indicator

This document provides essential information for AI agents (Cursor, Copilot, etc.) working on the AI Usage Indicator GNOME Shell extension. It serves as the primary source of truth for repository structure, development commands, and standards.

## Project Overview
The **AI Usage Indicator** is a GNOME Shell extension designed to help developers monitor their AI subscription usage. It displays a small label in the GNOME panel with the following metrics:
- `gh`: GitHub Copilot usage percentage.
- `d`: Codex daily usage percentage.
- `w`: Codex weekly usage percentage.

### Security & Storage
A critical design decision is the handling of sensitive tokens:
- **System Keyring (libsecret):** All authentication tokens are stored securely using `libsecret`.
- **No Secrets in GSettings:** GSettings is only used for non-sensitive configuration (polling intervals, display toggles). No tokens should ever be written to GSettings. Never log or print tokens to console/stdout.

## Environment & Prerequisites
To work on this extension, the environment must support:
- **GNOME Shell extension environment:** Target platform for execution.
- **GJS (GObject Introspection for JavaScript):** The runtime used by GNOME Shell.
- **GLib / GObject:** Core libraries for GNOME development.
- **libsecret:** Required for secure token management.
- **GSettings:** For configuration management.

## Critical Commands

### Schema Compilation
Before running the extension or any tests that access GSettings, you MUST compile the schemas. Failure to do so will result in "Settings schema not found" errors.
```bash
glib-compile-schemas schemas/
```

### Full Test Suite
The repository includes a comprehensive test suite managed via a `Makefile`. Always run this to ensure no regressions.
```bash
make test
```

### Single Test Execution
To isolate a specific feature or fix, run individual test files from the `tools/` directory. You must ensure schemas are compiled first.
```bash
glib-compile-schemas schemas/ && gjs -m tools/test-parse-wham.js
```
Replace `tools/test-parse-wham.js` with any of the following available tests:
- `tools/test-format-panel-label.js`
- `tools/test-no-secrets-in-settings.js`
- `tools/test-parse-copilot.js`
- `tools/test-parse-wham.js`
- `tools/test-poller-backoff.js`
- `tools/test-provider-codex-dry.js`
- `tools/test-provider-copilot-dry.js`
- `tools/test-secret-roundtrip.js`

### Install Safety Warning
If your local extension install directory is a symlink, do not run `gnome-extensions install --force` against it. The force install flow can replace the symlink with a real directory and break your linked development setup.

## Code Style & Conventions
- **General Style:** Match existing code exactly.
    - 2-space indentation.
    - Single quotes for strings.
    - Semicolons are required.
    - Trailing commas in multiline object/array literals.
- **Import Order:**
    1. `gi://` imports (GObject Introspection).
    2. `resource:///` imports (GNOME Shell internal modules).
    3. Local relative imports (e.g., `./lib/...`).
- **Naming Conventions:**
    - `PascalCase` for classes.
    - `camelCase` for variables and functions.
    - `_privateField` or `_privateMethod` (underscore prefix) for class-private members.
- **Error Handling:**
    - Prefer returning result objects: `{ ok: true, ... }` or `{ ok: false, errorKind: '...' }`.
    - Common `errorKind` values: `not_configured`, `network`, `auth`, `http`, `parse`.
- **GJS Environment:** Use standard GJS/ES6 patterns. Do not use TypeScript-specific syntax.
- **Logging:** Zero `console.log` or `print` calls in production code. Tests may use `console` for failures.

- **Linter Status:** No configured linter (ESLint/Biome) exists.
- **Formatter Status:** No automated formatter (Prettier) exists.

### Linting & Formatting
- **Linter Status:** There is **no configured linter** (e.g., ESLint, Biome) in this repository.
- **Formatter Status:** There is **no automated formatter** (e.g., Prettier).
- **Rule:** Match the existing code style exactly. Pay close attention to:
  - Brace placement (matching existing files).
  - Variable naming conventions (camelCase).

### AI Instruction Files
A thorough inventory of the repository confirms that the following agent-specific instruction files are **ABSENT**:
- `.cursorrules`
- `.cursor/rules/**`
- `.github/copilot-instructions.md`
- `CONTRIBUTING.md`

Because these files do not exist, this `AGENTS.md` file is the **exclusive source of instruction** for AI agents.

## Repository Map (Key Locations)

### Core Extension Files
- `extension.js`: The main entry point for the extension. Handles panel indicator lifecycle (enable/disable).
- `prefs.js`: Defines the preferences dialog for the extension (GNOME Settings).

### Configuration & Data
- `schemas/`: Contains the XML GSettings schema definitions.
  - `org.gnome.shell.extensions.ai-usage.gschema.xml`: Defines available settings.

### Tools & Testing
- `tools/`: Contains JavaScript test scripts and utility tools.
- `Makefile`: Defines build and test targets.

### Documentation
- `README.md`: General project information and quickstart.
- `AGENTS.md`: This file.

## Workflow Patterns

### 1. Modifying Code
When modifying logic in `extension.js` or `lib/` (if present), ensure that you follow the GJS patterns used elsewhere in the file.

### 2. Updating Settings
If you add a new setting:
1. Edit the XML in `schemas/`.
2. Run `glib-compile-schemas schemas/`.
3. Update `prefs.js` to expose the setting to the user.
4. Verify that no secrets are being stored in this new setting.

### 3. Running Tests
1. For quick verification of a specific component: `gjs -m tools/test-<name>.js`.
2. For full verification: `make test`.

## Architectural Decisions (Reference)
- **Modular Providers:** Usage data is fetched from separate providers (Copilot, Wham/Codex).
- **Polling Logic:** Uses a backoff mechanism to avoid rate-limiting or excessive network usage when providers are unavailable.
- **Indicator Lifecycle:** Correctly cleanup all resources, pollers, and signals in the `disable()` method.

## Common Pitfalls & Edge Cases
- **Async Operations:** GJS uses a specific loop for async operations. Ensure `Mainloop` or `GLib.MainLoop` is handled correctly in tests.
- **Libsecret Availability:** Ensure the system keyring is accessible. Tests might fail in headless environments without a secret service.
- **GNOME Version Compatibility:** Be aware of API differences between GNOME versions if targeting multiple releases.

## Integration Test Scenarios
- **First Run:** No tokens in keyring.
- **Expired Token:** Token exists but provider returns 401/403.
- **Network Offline:** Graceful handling of fetch failures.
- **Settings Change:** Immediate update of polling interval or display preferences.

---
*Last Updated: 2026-03-04*
