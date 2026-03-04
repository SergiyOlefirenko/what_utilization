function toMs(x) {
  const n = Number(x);
  if (!Number.isFinite(n))
    return null;
  return n > 10_000_000_000 ? Math.round(n) : Math.round(n * 1000);
}

function clampPercent(n) {
  const x = Number(n);
  if (!Number.isFinite(x))
    return null;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function percentFromUsedLimit(used, limit) {
  const u = Number(used);
  const l = Number(limit);
  if (!Number.isFinite(u) || !Number.isFinite(l) || l <= 0)
    return null;
  return clampPercent((u / l) * 100);
}

function labelForWindow(window, primaryResetMs) {
  const DAY_SECONDS = 86400;
  const limitSeconds = Number(window?.limit_window_seconds ?? window?.limitWindowSeconds ?? NaN);
  if (Number.isFinite(limitSeconds)) {
    if (Math.abs(limitSeconds - DAY_SECONDS) <= 3600)
      return 'Day';
    if (limitSeconds >= 6 * DAY_SECONDS)
      return 'Week';
  }

  const resetAtMs = toMs(window?.reset_at ?? window?.resetAt ?? null);
  if (resetAtMs !== null && primaryResetMs !== null) {
    if (resetAtMs - primaryResetMs >= 3 * DAY_SECONDS * 1000)
      return 'Week';
  }

  return 'Other';
}

export function parseCodexWham(json) {
  if (!json || typeof json !== 'object')
    return { ok: false, errorKind: 'parse' };

  const planType = json.plan_type ?? json.planType ?? json.plan ?? null;
  const windowsIn = Array.isArray(json.windows) ? json.windows : [];

  const primaryResetMs = toMs(windowsIn[0]?.reset_at ?? windowsIn[0]?.resetAt ?? null);

  const windows = windowsIn.map(w => {
    const used = w?.used ?? w?.used_tokens ?? w?.usedTokens ?? null;
    const limit = w?.limit ?? w?.limit_tokens ?? w?.limitTokens ?? null;
    const usedPercent = percentFromUsedLimit(used, limit) ?? clampPercent(w?.used_percent ?? w?.usedPercent ?? null) ?? 0;
    const resetAtMs = toMs(w?.reset_at ?? w?.resetAt ?? null);
    const label = labelForWindow(w, primaryResetMs);
    return { label, usedPercent, resetAtMs };
  });

  const daily = windows.find(w => w.label === 'Day') ?? null;
  const weekly = windows.find(w => w.label === 'Week') ?? null;

  return {
    ok: true,
    planType: planType ? `${planType}` : null,
    dailyPercent: daily ? daily.usedPercent : null,
    weeklyPercent: weekly ? weekly.usedPercent : null,
    windows,
  };
}
