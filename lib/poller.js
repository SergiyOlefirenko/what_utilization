import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Backoff } from './backoff.js';

export class Poller {
  constructor({
    providers,
    lookupToken,
    requestJson,
    intervalSeconds = 300,
    onUpdate,
    backoffBaseSeconds = 30,
  }) {
    this._providers = providers;
    this._lookupToken = lookupToken;
    this._requestJson = requestJson;
    this._intervalSeconds = intervalSeconds;
    this._onUpdate = onUpdate;

    this._backoff = new Backoff({ baseSeconds: backoffBaseSeconds, maxSeconds: 3600 });

    this._timeoutId = 0;
    this._generation = 0;
    this._inFlight = false;
    this._snapshot = {};
    this._cancellable = null;
  }

  start() {
    this.stop();
    this._generation += 1;
    this._scheduleNext(0);
  }

  stop() {
    this._generation += 1;
    this._inFlight = false;
    if (this._timeoutId) {
      GLib.Source.remove(this._timeoutId);
      this._timeoutId = 0;
    }
    if (this._cancellable) {
      this._cancellable.cancel();
      this._cancellable = null;
    }
  }

  setIntervalSeconds(seconds) {
    this._intervalSeconds = seconds;
  }

  setProviders(providers) {
    this._providers = providers ?? {};
    const active = new Set(Object.keys(this._providers));
    this._snapshot = Object.fromEntries(
      Object.entries(this._snapshot).filter(([name]) => active.has(name))
    );
  }

  get snapshot() {
    return this._snapshot;
  }

  async pollOnce() {
    if (this._inFlight)
      return;
    this._inFlight = true;
    const gen = this._generation;
    const cancellable = new Gio.Cancellable();
    this._cancellable = cancellable;

    let hadFailure = false;
    let aborted = false;

    try {
      const providerNames = Object.keys(this._providers);
      for (const name of providerNames) {
        if (gen !== this._generation) {
          aborted = true;
          break;
        }

        const fn = this._providers[name];
        let token = null;
        try {
          token = await this._lookupToken(name);
        } catch (e) {
          token = null;
        }

        if (gen !== this._generation) {
          aborted = true;
          break;
        }

        let result;
        try {
          result = await fn({ token, requestJson: this._requestJson, cancellable });
        } catch (e) {
          result = { ok: false, errorKind: 'network' };
        }

        if (gen !== this._generation) {
          aborted = true;
          break;
        }

        if (!result.ok)
          hadFailure = true;

        this._snapshot = { ...this._snapshot, [name]: result };
        try {
          this._onUpdate?.(name, result, this._snapshot);
        } catch (e) {
        }
      }

      if (!aborted && gen === this._generation) {
        if (hadFailure)
          this._backoff.fail();
        else
          this._backoff.reset();
      }

      return aborted ? null : { hadFailure, nextDelaySeconds: this.computeNextDelaySeconds(hadFailure) };
    } finally {
      if (gen === this._generation && this._cancellable === cancellable) {
        this._inFlight = false;
        this._cancellable = null;
      }
    }
  }

  computeNextDelaySeconds(hadFailure) {
    if (!hadFailure)
      return this._intervalSeconds;
    return this._backoff.nextDelaySeconds();
  }

  _scheduleNext(delaySeconds) {
    const gen = this._generation;
    const delay = Math.max(0, Math.round(delaySeconds));
    this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, delay, () => {
      if (gen !== this._generation)
        return GLib.SOURCE_REMOVE;
      this.pollOnce()
        .then((result) => {
          if (gen !== this._generation)
            return;
          if (!result)
            return;
          this._scheduleNext(result.nextDelaySeconds);
        })
        .catch(() => {
          if (gen !== this._generation)
            return;
          this._backoff.fail();
          this._scheduleNext(this._backoff.nextDelaySeconds());
        });
      return GLib.SOURCE_REMOVE;
    });
  }
}
