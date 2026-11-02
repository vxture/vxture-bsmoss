import { test } from "node:test";
import assert from "node:assert/strict";
import { FIRST_METRICS } from "./first-metrics.ts";
import { createRegistry, assertDisplay, type MetricDefinition } from "./registry.ts";
const base = FIRST_METRICS.get({ code: "service.data.uplink_bytes", version: 1 })!;
test("planned definitions cover all three categories and fixed dependencies", () => {
  assert.equal(FIRST_METRICS.list().length, 12);
  assert.equal(new Set(FIRST_METRICS.list().map(m => m.category)).size, 3);
  assert.ok(FIRST_METRICS.list().every(m => m.lifecycle === "planned"));
  assert.equal(FIRST_METRICS.get({code:base.code,version:2}),undefined);
});
test("duplicates, units, category and unsafe aggregation are rejected", () => {
  assert.throws(() => createRegistry([base,base]),/duplicate_definition/);
  for (const patch of [{displayUnits:["kWh"]},{category:"runtime_parameter" as const},{timeAggregation:"ratio_parts" as const},{version:0},{grains:[]}]) {
    assert.throws(() => createRegistry([{...base,...patch}]));
  }
  assertDisplay(base,"hour","GiB");
  assert.throws(() => assertDisplay(base,"hour","kWh"),/unsupported_unit/);
});
test("missing, incompatible and cyclic dependencies are rejected", () => {
  const total = FIRST_METRICS.get({code:"service.data.total_bytes",version:1})!;
  assert.throws(() => createRegistry([total]),/missing_dependency/);
  const down = FIRST_METRICS.get({code:"service.data.downlink_bytes",version:1})!;
  assert.throws(() => createRegistry([base,{...down,object:"cell"},total]),/incompatible_dimension/);
  const a: MetricDefinition = {...total,code:"service.data.cycle_a",dependencies:[{code:"service.data.cycle_b",version:1},{code:base.code,version:1}]};
  const b: MetricDefinition = {...a,code:"service.data.cycle_b",dependencies:[{code:a.code,version:1},{code:base.code,version:1}]};
  assert.throws(() => createRegistry([base,a,b]),/dependency_cycle/);
});
test("registry snapshots are immutable and detached from caller arrays", () => {
  const units = ["B"];
  const registry = createRegistry([{...base,displayUnits:units}]); units.push("kWh");
  assert.deepEqual(registry.get(base)!.displayUnits,["B"]);
  assert.throws(() => { (registry.get(base)!.displayUnits as string[]).push("kWh"); });
});

