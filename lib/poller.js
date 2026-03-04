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

  get snapshot() {
    return this._snapshot;
  }

  async pollOnce() {
    if (this._inFlight)
      return;
    this._inFlight = true;
    const gen = this._generation;
    this._cancellable = new Gio.Cancellable();

    let hadFailure = false;

    const providerNames = Object.keys(this._providers);
    for (const name of providerNames) {
      if (gen !== this._generation)
        break;

      const fn = this._providers[name];
      let token = null;
      try {
        token = await this._lookupToken(name);
      } catch (e) {
        token = null;
      }

      let result;
      try {
        result = await fn({ token, requestJson: this._requestJson, cancellable: this._cancellable });
      } catch (e) {
        result = { ok: false, errorKind: 'network' };
      }

      if (!result.ok)
        hadFailure = true;

      this._snapshot = { ...this._snapshot, [name]: result };
      try {
        this._onUpdate?.(name, result, this._snapshot);
      } catch (e) {
      }
    }

    if (gen === this._generation) {
      if (hadFailure)
        this._backoff.fail();
      else
        this._backoff.reset();
    }

    this._inFlight = false;
    this._cancellable = null;

    return { hadFailure, nextDelaySeconds: this.computeNextDelaySeconds(hadFailure) };
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
        .then(({ hadFailure, nextDelaySeconds }) => {
          if (gen !== this._generation)
            return;
          this._scheduleNext(this.computeNextDelaySeconds(hadFailure) ?? nextDelaySeconds);
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
