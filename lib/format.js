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

export function formatCopilotUsage(percent = null) {
  return `gh: ${formatPercent(percent)}%`;
}

export function formatCodexUsage({ dailyPercent = null, weeklyPercent = null } = {}) {
  return `5h: ${formatPercent(dailyPercent)}% w: ${formatPercent(weeklyPercent)}%`;
}

export function formatPanelLabel({
  ghPercent = null,
  dailyPercent = null,
  weeklyPercent = null,
  showGh = true,
  showCodex = true
} = {}) {
  const parts = [];

  if (showGh)
    parts.push(formatCopilotUsage(ghPercent));
  if (showCodex)
    parts.push(formatCodexUsage({ dailyPercent, weeklyPercent }));

  return parts.length > 0 ? parts.join(' ') : 'AI: off';
}
