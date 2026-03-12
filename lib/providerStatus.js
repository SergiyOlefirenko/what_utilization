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
    return 'Codex: run codex login';

  if (result?.ok) {
    const nextReset = result.windows
      ?.map(w => w.resetAtMs)
      .filter(x => Number.isFinite(x))
      .sort()[0] ?? null;
    const plan = result.planType ?? 'unknown';
    return `Codex: ${plan}${nextReset ? ` (next reset: ${new Date(nextReset).toISOString().slice(0, 10)})` : ''}`;
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
