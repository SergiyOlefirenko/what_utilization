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

export function formatPanelLabel({
  ghPercent = null,
  dailyPercent = null,
  weeklyPercent = null,
  showGh = true,
  showDaily = true,
  showWeekly = true,
} = {}) {
  const parts = [];

  if (showGh)
    parts.push(`gh:${formatPercent(ghPercent)}%`);
  if (showDaily)
    parts.push(`d:${formatPercent(dailyPercent)}%`);
  if (showWeekly)
    parts.push(`w:${formatPercent(weeklyPercent)}%`);

  return parts.length > 0 ? parts.join(' ') : 'AI: off';
}
