GJS ?= gjs

.PHONY: test compile-schemas

compile-schemas:
	glib-compile-schemas schemas/

test: compile-schemas
	$(GJS) -m tools/test-format-panel-label.js
	$(GJS) -m tools/test-no-secrets-in-settings.js
	$(GJS) -m tools/test-parse-copilot.js
	$(GJS) -m tools/test-parse-wham.js
	$(GJS) -m tools/test-poller-backoff.js
	$(GJS) -m tools/test-provider-codex-dry.js
	$(GJS) -m tools/test-provider-copilot-dry.js
	$(GJS) -m tools/test-secret-roundtrip.js
