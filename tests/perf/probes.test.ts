import { describe, expect, it } from "vitest";
import { countScanWork } from "@perf/probes";

describe("probes: countScanWork tallies Σ(scanned length)", () => {
  it("counts the full array length per scan, independent of where the match lands", () => {
    const arr = Array.from({ length: 100 }, (_item, i) => i);
    expect(countScanWork(() => arr.find((n) => n === 0))).toBe(100);
    expect(countScanWork(() => arr.find((n) => n === 99))).toBe(100);
    expect(countScanWork(() => arr.includes(50))).toBe(100);
  });

  it("sums across composed and repeated scans — the 'doing the work twice' signal", () => {
    const arr = Array.from({ length: 50 }, (_item, i) => i);
    expect(countScanWork(() => {
      arr.some((n) => n === -1);
      arr.filter((n) => n < 0);
    })).toBe(100);
  });

  it("restores the patched Array methods after running", () => {
    const original = Array.prototype.find;
    countScanWork(() => [1, 2, 3].find((n) => n === 2));
    expect(Array.prototype.find).toBe(original);
  });
});
