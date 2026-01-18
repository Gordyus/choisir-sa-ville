export function summarizeSkips(skipped: Record<string, number>): string {
  const entries = Object.entries(skipped).sort((a, b) => b[1] - a[1]);
  return entries
    .slice(0, 5)
    .map(([reason, count]) => `${reason}=${count}`)
    .join(", ");
}
