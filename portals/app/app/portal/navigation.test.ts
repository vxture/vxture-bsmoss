import { test } from "node:test";
import assert from "node:assert/strict";
import { portalDomain, portalNavigation } from "./navigation";

test("business and configuration navigation are disjoint and management routes share their own domain", () => {
  for (const preview of [false, true]) {
    const business = portalNavigation(preview), management = portalNavigation(preview, "management");
    assert.deepEqual(business.map(entry => entry.id), preview ? ["home", "map", "analysis", "reports"] : ["home", "analysis", "reports"]);
    assert.deepEqual(management.map(entry => entry.id), ["settings", "templates", "aggregation", "report-jobs"]);
    for (const entry of management) {
      assert.equal(portalDomain(entry.id), "management");
      assert.ok(entry.href === "/settings" || entry.href.startsWith("/settings/"));
      assert.ok(!business.some(item => item.id === entry.id));
    }
    for (const entry of business) assert.equal(portalDomain(entry.id), "business");
  }
});
