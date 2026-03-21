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
      'Codex',
      ` - plan: ${plan}`,
    ];

    if (Number.isFinite(dayWindow?.resetAtMs))
      lines.push(` - 5h next reset: ${new Date(dayWindow.resetAtMs).toISOString().slice(0, 10)}`);

    if (Number.isFinite(weekWindow?.resetAtMs))
      lines.push(` - w next reset: ${new Date(weekWindow.resetAtMs).toISOString().slice(0, 10)}`);

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
