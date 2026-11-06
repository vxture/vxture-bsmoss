import { test } from "node:test";
import assert from "node:assert/strict";
import { ANALYSIS_RULES, CLASSIFICATIONS, filterDefinitions } from "./catalog";
import { sharingType, SITE_TYPES, SCENES, SHARING_TYPES } from "./classification";
import { TOPIC_THRESHOLDS, WAVE_POLICY } from "./policies";
import { parseSiteQuery } from "../site-registry/rules";
import { DEMO_SITES, DEMO_REGION } from "../map-demo/resources";
import { syntheticSharing } from "../map-demo/site-attributes";

test("sharing is an exclusive physical classification, and no operator is unknown", () => {
  assert.deepEqual([0,1,2,3,4,5].map(sharingType), [null,"single","dual","multi","multi","multi"]);
  for (const n of [-1,1.5,6,NaN,Infinity]) assert.throws(() => sharingType(n), /invalid_operator_count/);
  assert.throws(() => syntheticSharing({ ...DEMO_SITES[0], operators: [] }), /synthetic_site_without_operator/);
  assert.ok(!SHARING_TYPES.includes("all" as never));
});
test("classification vocabulary is accepted by the existing registry query parser", () => {
  for (const siteType of SITE_TYPES) assert.equal(parseSiteQuery({siteType}, DEMO_REGION).siteType, siteType);
  for (const scene of SCENES) assert.equal(parseSiteQuery({scene}, DEMO_REGION).scene, scene);
});
test("catalog search combines words across facts and boundaries and never mutates its source", () => {
  const before=JSON.stringify(ANALYSIS_RULES);
  assert.deepEqual(filterDefinitions(ANALYSIS_RULES," CAPACITY   98 ","capacity").map(r=>r.code), ["capacity.connection"]);
  assert.equal(filterDefinitions(ANALYSIS_RULES,"capacity","runtime").length,0);
  assert.equal(filterDefinitions(CLASSIFICATIONS,"unmatched-query").length,0);
  assert.ok(filterDefinitions(CLASSIFICATIONS,"", "sharing").every(r=>r.group==="sharing"));
  assert.equal(JSON.stringify(ANALYSIS_RULES),before);
});
test("every definition carries a unique code, explicit boundaries and versioned evidence", () => {
  for (const rows of [CLASSIFICATIONS,ANALYSIS_RULES]) {
    assert.equal(new Set(rows.map(r=>r.id)).size, rows.length);
    assert.equal(new Set(rows.map(r=>r.code)).size, rows.length);
    assert.ok(rows.every(r=>r.version && r.facts.length && r.applies.length && r.boundaries.length));
  }
});
test("shared policies cannot be changed by a consumer through their nested references", () => {
  assert.equal(Reflect.set(TOPIC_THRESHOLDS,"loadWarningPct",1),false);
  assert.equal(Reflect.set(WAVE_POLICY.minimum,"bytes","0"),false);
  assert.equal(Reflect.set(WAVE_POLICY.baselineWeeks,"0",52),false);
  assert.equal(WAVE_POLICY.minimum.bytes,"1073741824");
});
