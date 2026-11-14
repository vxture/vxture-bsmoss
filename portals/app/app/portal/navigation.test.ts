import { test } from "node:test";
import assert from "node:assert/strict";
import { portalBusinessGroups, portalPendingMigration, portalDomain, portalNavigation, portalLauncherEntries } from "./navigation";

test("business and configuration navigation are disjoint and management routes share their own domain", () => {
  for (const preview of [false, true]) {
    const business = portalNavigation(preview), management = portalNavigation(preview, "management");
    assert.deepEqual(business.map(entry => entry.id), preview ? ["monitoring", "customer-use", "home", "board", "map", "sites", "capacity", "efficiency", "analysis", "reports", "usage-review", "data-updates"] : ["monitoring", "customer-use", "home", "board", "sites", "capacity", "efficiency", "analysis", "reports", "usage-review", "data-updates"]);
    assert.deepEqual(management.map(entry => entry.id), ["operator-identities", "settings", "overview-display", "jurisdiction", "business-dictionaries", "analysis-rules", "source-configurations", "templates"]);
    for (const entry of management) {
      assert.equal(portalDomain(entry.id), "management");
      assert.ok(entry.href === "/settings" || entry.href.startsWith("/settings/"));
      assert.ok(!business.some(item => item.id === entry.id));
    }
    for (const entry of business) assert.equal(portalDomain(entry.id), "business");
  }
});

test("launcher preserves every existing destination exactly once across assigned and pending sections", () => {
  for (const preview of [false,true]) {
    const groups=portalBusinessGroups(preview), pending=portalPendingMigration(preview);
    assert.deepEqual(groups.map(g=>g.key),["runtime","operations","business"]);
    assert.deepEqual(groups.map(g=>g.modules.length),[3,5,4]);
    const modules=groups.flatMap(g=>g.modules);
    const overview=portalLauncherEntries(preview,"overview"),tools=portalLauncherEntries(preview,"tools");
    assert.deepEqual(overview.map(e=>e.id),preview?["home","board","map"]:["home","board"]);
    assert.deepEqual(overview.map(e=>e.label),preview?["\u8fd0\u884c\u603b\u89c8","\u7efc\u5408\u7814\u5224","\u7ad9\u7f51\u5168\u666f"]:["\u8fd0\u884c\u603b\u89c8","\u7efc\u5408\u7814\u5224"]);
    assert.deepEqual(tools.map(e=>e.id),["reports","data-updates","usage-review"]);
    assert.ok(!portalNavigation(preview).some(e=>e.id==="review-history"));
    const assigned=[...overview,...tools].map(e=>e.id);
    const pages=[...assigned,...modules.flatMap(m=>m.page?[m.page]:[]),...pending.flatMap(m=>m.page?[m.page]:[])];
    assert.equal(new Set(pages).size,pages.length);
    assert.deepEqual([...pages].sort(),portalNavigation(preview).map(e=>e.id).sort());
    for(const m of modules) if(m.planned) assert.equal(m.href,undefined);
    for(const m of pending) {assert.ok(m.href?.startsWith("/"));assert.ok(!m.planned);}
    assert.equal(modules.find(m=>m.key==="analysis")?.href,"/analysis");
    assert.ok(!pending.some(m=>m.page==="analysis"));
    assert.equal(tools.find(m=>m.id==="reports")?.href,"/reports");
    assert.ok(!modules.some(m=>m.key==="sharing"));
    assert.equal(modules.find(m=>m.key==="monitoring")?.href,"/monitoring");
    assert.equal(modules.find(m=>m.key==="bearing")?.href,"/capacity");
    assert.equal(modules.find(m=>m.key==="efficiency")?.href,"/efficiency");
    assert.ok(!modules.some(m=>m.key==="operator-usage"));
    assert.ok(!pending.some(m=>m.page==="operator-usage"));
    assert.ok(!pending.some(m=>m.page==="efficiency"));
    assert.ok(!pending.some(m=>m.page==="capacity"));
    assert.ok(!pending.some(m=>m.page==="monitoring"));
    assert.ok(!pending.some(m=>m.page==="sharing"));
    assert.ok(!pending.some(m=>m.page==="report-jobs"));
    assert.ok(!pending.some(m=>m.page==="overview-display"));
    assert.ok(!portalNavigation(preview).some(m=>m.href==="/preferences/overview"));
    assert.ok(!modules.some(m=>m.key==="report-generation"));
    assert.ok(!pending.some(m=>m.key==="service-relations"));
    assert.equal(modules.find(m=>m.key==="sites")?.href,"/sites");
  }
});
