function clampPercent(n) {
  if (n === null || n === undefined)
    return null;
  const x = Number(n);
  if (!Number.isFinite(x))
    return null;
  return Math.max(0, Math.min(100, Math.round(x)));
}

export function formatPercent(n) {
  const v = clampPercent(n);
  return v === null ? '--' : String(v);
}

export function formatPanelLabel({ ghPercent = null, dailyPercent = null, weeklyPercent = null } = {}) {
  return `gh:${formatPercent(ghPercent)}% d:${formatPercent(dailyPercent)}% w:${formatPercent(weeklyPercent)}%`;
}
