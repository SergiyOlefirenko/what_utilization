function formatError(providerLabel, result) {
  const errorKind = result?.errorKind ?? null;
  if (errorKind === 'not_configured')
    return `${providerLabel}: not configured`;
  if (errorKind === 'auth')
    return `${providerLabel}: auth failed`;
  if (errorKind === 'network')
    return `${providerLabel}: network error`;
  if (errorKind === 'parse')
    return `${providerLabel}: parse error`;
  if (errorKind === 'http') {
    const status = Number(result?.status);
    return Number.isFinite(status) ? `${providerLabel}: http ${status}` : `${providerLabel}: http error`;
  }
  return `${providerLabel}: --`;
}

function pad2(value) {
  return `${value}`.padStart(2, '0');
}

function formatLocalDateTime(ms) {
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime()))
    return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatCodexStatus(result, enabled) {
  if (!enabled)
    return 'Codex: disabled';

  if (result?.errorKind === 'not_configured')
    return 'Codex: sign in required';

  if (result?.ok) {
    const dayWindow = result.windows?.find(w => w?.label === 'Day') ?? null;
    const weekWindow = result.windows?.find(w => w?.label === 'Week') ?? null;
    const plan = result.planType ?? 'unknown';
    const lines = [
      `Codex: ${plan}`,
    ];

    const dayReset = Number.isFinite(dayWindow?.resetAtMs) ? formatLocalDateTime(dayWindow.resetAtMs) : null;
    const weekReset = Number.isFinite(weekWindow?.resetAtMs) ? formatLocalDateTime(weekWindow.resetAtMs) : null;

    if (dayReset)
      lines.push(` - 5h: ${dayReset}`);

    if (weekReset)
      lines.push(` - w: ${weekReset}`);

    return lines.join('\n');
  }

  return formatError('Codex', result);
}

export function formatCopilotStatus(result, enabled) {
  if (!enabled)
    return 'Copilot: disabled';

  if (result?.ok)
    return `Copilot: ${result.plan ?? 'unknown'}${result.resetDate ? ` (reset: ${result.resetDate})` : ''}`;

  return formatError('Copilot', result);
}
