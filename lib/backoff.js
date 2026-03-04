export class Backoff {
  constructor({ baseSeconds = 30, maxSeconds = 3600 } = {}) {
    this._baseSeconds = baseSeconds;
    this._maxSeconds = maxSeconds;
    this._failures = 0;
  }

  get failures() {
    return this._failures;
  }

  reset() {
    this._failures = 0;
  }

  fail() {
    this._failures += 1;
  }

  nextDelaySeconds() {
    if (this._failures <= 0)
      return this._baseSeconds;
    const exp = Math.pow(2, this._failures);
    return Math.min(this._maxSeconds, Math.round(this._baseSeconds * exp));
  }
}
