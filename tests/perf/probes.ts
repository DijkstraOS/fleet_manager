/** Pillar A primitive: the scan-op tally that operation budgets assert on. Rationale in tests/perf/README.md. */

const SCAN_METHODS = [
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "some",
  "every",
  "filter",
  "indexOf",
  "lastIndexOf",
  "includes",
] as const;

export function countScanWork(run: () => void): number {
  let work = 0;
  const originals: Array<[string, unknown]> = [];
  for (const method of SCAN_METHODS) {
    const original = (Array.prototype as unknown as Record<string, unknown>)[method];
    originals.push([method, original]);
    (Array.prototype as unknown as Record<string, unknown>)[method] = function (
      this: unknown[],
      ...args: unknown[]
    ) {
      work += this.length;
      return (original as (...callArgs: unknown[]) => unknown).apply(this, args);
    };
  }
  try {
    run();
  } finally {
    for (const [method, original] of originals) {
      (Array.prototype as unknown as Record<string, unknown>)[method] = original;
    }
  }
  return work;
}
