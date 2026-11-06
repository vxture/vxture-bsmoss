import { test } from "node:test";
import assert from "node:assert/strict";
import { portalBusinessGroups, portalDomain, portalNavigation } from "./navigation";

test("business and configuration navigation are disjoint and management routes share their own domain", () => {
  for (const preview of [false, true]) {
    const business = portalNavigation(preview), management = portalNavigation(preview, "management");
    assert.deepEqual(business.map(entry => entry.id), preview ? ["home", "board", "map", "sites", "capacity", "efficiency", "operator-usage", "usage-reports", "analysis", "reports", "usage-review", "review-history", "data-updates", "aggregation", "report-jobs", "overview-display"] : ["home", "board", "sites", "capacity", "efficiency", "operator-usage", "usage-reports", "analysis", "reports", "usage-review", "data-updates", "aggregation", "report-jobs"]);
    assert.deepEqual(management.map(entry => entry.id), ["settings", "jurisdiction", "members", "site-classifications", "analysis-rules", "metric-catalog", "source-configurations", "configuration-audit", "templates"]);
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
    assert.deepEqual(groups.map(group => group.key), ["resources", "supervision", "business", "verification", "reporting", "data"]);
    assert.ok(modules.every(item => item.page !== "home" && item.page !== "board" && item.page !== "map"));
    assert.deepEqual(portalNavigation(preview).filter(item => ["home", "board", "map"].includes(item.id)).map(item => item.id), preview ? ["home", "board", "map"] : ["home", "board"]);
    assert.equal(new Set(modules.map(item => item.key)).size, modules.length);
    for (const item of modules) {
      if (item.planned) assert.equal(item.href, undefined);
      else assert.ok(item.href?.startsWith("/") && !item.href.startsWith("/settings"));
      if (!preview) assert.ok(!item.href?.startsWith("/product-preview"));
    }
    for (const id of preview ? ["sites", "analysis", "reports", "capacity", "efficiency", "operator-usage", "usage-reports", "usage-review"] : ["sites", "analysis", "reports"])
      assert.equal(modules.filter(item => item.page === id).length, 1);
    assert.equal(modules.find(item => item.key === "usage-review")?.planned, preview ? undefined : true);
    assert.equal(modules.find(item => item.key === "review-history")?.planned, preview ? undefined : true);
    for (const item of modules.filter(item => item.page !== "map")) assert.ok(!item.href?.startsWith("/product-preview"));
  }
});

test("navigation uses concise labels and task work stays in the business domain", () => {
  for (const entry of [...portalNavigation(true), ...portalNavigation(true, "management")]) {
    assert.equal(entry.label.length, entry.id === "operator-usage" ? 5 : 4);
  }
  for (const id of ["aggregation", "data-updates", "report-jobs", "overview-display"] as const) assert.equal(portalDomain(id), "business");
  const groups = portalBusinessGroups(true), modules = groups.flatMap(group => group.modules);
  assert.equal(modules.filter(m => m.page === "data-updates").length, 1);
  assert.equal(modules.filter(m => m.page === "report-jobs").length, 1);
  assert.ok(!modules.some(m => m.page === "overview-display" || m.page === "aggregation"));
});
