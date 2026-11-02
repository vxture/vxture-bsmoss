import type { AnalysisPoint } from "../domains/views/analysis.ts";

// Only bounded screen coordinates become Number; original integers remain strings.
export function seriesPaths(points: readonly AnalysisPoint[]): string[] {
  const values = points.map(p => {
    if (p.freshness !== "current") return null;
    const v = p.data?.kind === "aggregate" ? p.data.publication?.result.value : p.data?.kind === "rollup" ? p.data.result.value : null;
    if (!v) return null;
    if (v.kind === "integer") return { n: BigInt(v.value), d: 1n };
    if (v.kind === "ratio" && BigInt(v.denominator) > 0n) return { n: BigInt(v.numerator), d: BigInt(v.denominator) };
    if (v.kind === "gauge") return { n: BigInt(v.mean.numerator), d: BigInt(v.mean.denominator) * 10n ** BigInt(v.scale) };
    return null;
  });
  const known = values.filter(v => v !== null); if (!known.length) return [];
  const sorted = [...known].sort((a, b) => a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0), min = sorted[0]!, max = sorted.at(-1)!;
  const span = max.n * min.d - min.n * max.d;
  const groups: string[][] = []; let group: string[] = [];
  values.forEach((v, i) => {
    if (!v) { if (group.length) groups.push(group); group = []; return; }
    const y = span === 0n ? 35 : 60 - Number((v.n * min.d - min.n * v.d) * max.d * 50n / (v.d * span));
    group.push((points.length === 1 ? 150 : 10 + i * 280 / (points.length - 1)) + "," + y);
  });
  if (group.length) groups.push(group); return groups.map(g => g.join(" "));
}
