/**
 * Render tally (Pillar B; see tests/perf/README.md). Leave the useRenderTally(...) probes in place — the budget suite asserts against these labels.
 * Count in the render BODY, not an effect: a React.memo bailout must read as NOT counted — that's the signal the suite locks.
 */

let enabled = false;
const counts = new Map<string, number>();

export function setRenderTallyEnabled(value: boolean): void {
  enabled = value;
}

export function resetRenderTally(): void {
  counts.clear();
}

export function renderCount(label: string): number {
  return counts.get(label) ?? 0;
}

export function renderTallySnapshot(): Record<string, number> {
  return Object.fromEntries(counts);
}

export function useRenderTally(label: string): void {
  if (!enabled) return;
  counts.set(label, (counts.get(label) ?? 0) + 1);
}
