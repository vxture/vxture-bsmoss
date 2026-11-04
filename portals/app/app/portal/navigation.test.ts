import { test } from "node:test";
import assert from "node:assert/strict";
import { portalBusinessGroups, portalDomain, portalNavigation } from "./navigation";

test("business and configuration navigation are disjoint and management routes share their own domain", () => {
  for (const preview of [false, true]) {
    const business = portalNavigation(preview), management = portalNavigation(preview, "management");
    assert.deepEqual(business.map(entry => entry.id), preview ? ["home", "board", "sites", "map", "capacity", "efficiency", "operator-usage", "usage-reports", "analysis", "reports"] : ["home", "board", "sites", "capacity", "efficiency", "operator-usage", "usage-reports", "analysis", "reports"]);
    assert.deepEqual(management.map(entry => entry.id), ["settings", "templates", "aggregation", "report-jobs"]);
    for (const entry of management) {
      assert.equal(portalDomain(entry.id), "management");
      assert.ok(entry.href === "/settings" || entry.href.startsWith("/settings/"));
      assert.ok(!business.some(item => item.id === entry.id));
    }
    for (const entry of business) assert.equal(portalDomain(entry.id), "business");
  }
});

test("global destinations stand apart from business groups and planned modules have no links", () => {
  for (const preview of [false, true]) {
    const groups = portalBusinessGroups(preview), modules = groups.flatMap(group => group.modules);
    assert.deepEqual(groups.map(group => group.key), ["resources", "supervision", "business", "verification", "reporting"]);
    assert.ok(modules.every(item => item.page !== "home" && item.page !== "board"));
    assert.equal(new Set(modules.map(item => item.key)).size, modules.length);
    for (const item of modules) {
      if (item.planned) assert.equal(item.href, undefined);
      else assert.ok(item.href?.startsWith("/") && !item.href.startsWith("/settings"));
      if (!preview) assert.ok(!item.href?.startsWith("/product-preview"));
    }
    for (const id of preview ? ["sites", "map", "analysis", "reports", "capacity", "efficiency", "operator-usage", "usage-reports"] : ["sites", "analysis", "reports"])
      assert.equal(modules.filter(item => item.page === id).length, 1);
    for (const item of modules.filter(item => item.page !== "map")) assert.ok(!item.href?.startsWith("/product-preview"));
  }
});
