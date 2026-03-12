function clampPercent(n) {
  const x = Number(n);
  if (!Number.isFinite(x))
    return null;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function remainingPercentFromUsedPercent(n) {
  const usedPercent = clampPercent(n);
  if (usedPercent === null)
    return null;
  return 100 - usedPercent;
}

export function parseCopilotUser(json) {
  if (!json || typeof json !== 'object')
    return { ok: false, errorKind: 'parse' };

  const quota = json.quota_usage ?? json.quotaUsage ?? null;
  const used = quota?.used_percent ?? quota?.usedPercent ?? json.used_percent ?? json.usedPercent ?? null;
  const remainingPercent = remainingPercentFromUsedPercent(used);
  const plan = `${json.plan ?? json.copilot_plan ?? json.copilotPlan ?? 'unknown'}`;
  const resetDate = `${json.reset_date ?? json.resetDate ?? ''}` || null;

  if (remainingPercent === null)
    return { ok: false, errorKind: 'parse' };

  return {
    ok: true,
    remainingPercent,
    plan,
    resetDate,
  };
}
