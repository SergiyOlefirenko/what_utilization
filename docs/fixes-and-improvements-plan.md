# Fixes And Improvements Plan

## Summary

This note captures the main correctness, reliability, and UX issues found during the project audit. The current test suite passes, so these are mostly latent defects and improvement opportunities rather than already failing checks.

## Priority Fixes

1. Fix stale poll result writes in `Poller`.
   The current generation guard in `lib/poller.js` only runs before each provider iteration. After `await` returns, an older canceled poll can still write into `_snapshot`, call `onUpdate`, and affect backoff state. Add generation checks after async token lookup and provider fetch, before mutating state.

2. Preserve provider parse errors instead of reporting them as generic HTTP failures.
   `lib/http.js` can return `{ ok: false, errorKind: 'parse' }` when the response body is invalid JSON, but both providers currently collapse every non-OK result into `auth` or `http`. Update `lib/providers/codex.js` and `lib/providers/copilot.js` to propagate `parse` explicitly.

3. Apply settings changes immediately.
   In `extension.js`, changing poll interval or enabled providers only updates in-memory poller configuration. It does not cancel and reschedule the current timer or trigger a fresh poll. Make settings changes restart or reschedule the poll cycle so enable/disable and interval changes take effect right away.

4. Stop treating `not_configured` as a backoff-worthy failure.
   `lib/poller.js` currently feeds all non-OK results into exponential backoff. Missing tokens are a steady configuration state, not a transient network failure. Exclude `not_configured` from backoff growth so first-run behavior and token recovery remain responsive.

5. Tighten Codex parser validation.
   `lib/parsers/codexWham.js` accepts too many malformed payloads as success and sometimes defaults missing usage values to `0`. Make parsing fail when no recognizable daily/weekly usage data exists, so upstream API drift is visible instead of silently producing misleading numbers.

6. Improve prefs error messaging for token saves.
   `prefs.js` shows `Keyring unavailable` for all `storeToken()` failures, including blank input. Distinguish validation errors such as empty tokens from actual libsecret/keyring failures.

## Improvements

1. Add tests for stale-generation cancellation behavior in `lib/poller.js`.
2. Add tests for immediate poll rescheduling after settings changes in `extension.js`.
3. Add tests covering provider parse-error propagation from `lib/http.js` through both providers.
4. Add tests for malformed Codex payloads so parser strictness is intentional and stable.
5. Add a manual refresh action in the panel menu or preferences to make token updates and auth recovery visible immediately.
6. Replace the implicit `.sort()` on reset timestamps in `lib/providerStatus.js` with an explicit numeric minimum to avoid lexicographic surprises.
7. Surface a distinct runtime status for keyring access failures instead of collapsing them into `not configured`.

## Acceptance Criteria

1. A canceled or superseded poll must not update `_snapshot`, call `onUpdate`, or alter backoff state.
2. Invalid JSON from provider endpoints must produce `errorKind: 'parse'` in provider results.
3. Changing enabled providers or poll interval in settings must update the extension behavior without waiting for the previous timeout window.
4. Missing tokens must not cause exponential backoff growth.
5. Malformed Codex usage payloads must fail parsing rather than defaulting to zero-usage success states.
6. Preferences UI must show a clear validation message for blank token input and a separate message for keyring/service failures.
