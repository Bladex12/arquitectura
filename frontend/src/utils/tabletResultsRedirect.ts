export function getResultsRedirectUrl(
  gameData: { show_results_stage?: number },
  connectionId: string
): string | null {
  const n = gameData.show_results_stage ?? 0;
  if (n < 1 || n > 4) return null;
  return `/tablet/etapa${n}/resultados/?connection_id=${encodeURIComponent(connectionId)}`;
}
