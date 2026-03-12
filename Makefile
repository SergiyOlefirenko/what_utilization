GJS ?= gjs

.PHONY: test test-core test-keyring compile-schemas

compile-schemas:
	glib-compile-schemas schemas/

test: test-core test-keyring

test-core: compile-schemas
	$(GJS) -m tools/test-format-panel-label.js
	$(GJS) -m tools/test-metadata-settings-schema.js
	$(GJS) -m tools/test-no-deprecated-imports.js
	$(GJS) -m tools/test-no-secrets-in-settings.js
	$(GJS) -m tools/test-secrets-schema-init.js
	$(GJS) -m tools/test-codex-cli-auth.js
	$(GJS) -m tools/test-parse-copilot.js
	$(GJS) -m tools/test-parse-wham.js
	$(GJS) -m tools/test-poller-backoff.js
	$(GJS) -m tools/test-provider-status.js
	$(GJS) -m tools/test-provider-codex-dry.js
	$(GJS) -m tools/test-provider-copilot-dry.js

test-keyring: compile-schemas
	$(GJS) -m tools/test-secret-roundtrip.js
