import { test } from "node:test";
import assert from "node:assert/strict";
import { registryDemo, dossierDemo } from "./demo-store";
import { resourceScope } from "./resource-rules";
import { parseSiteQuery, siteDetailHref, siteListHref } from "./rules";
import { DEMO_REGION } from "../map-demo/resources";
import {assetDetail} from "./asset-model";
import {emptyMaintenance} from "./maintenance-rules";
import { GET } from "../../api/product-preview/site-registry/[id]/route";

test("page capacity preserves order, clamps both site and relationship lists, and survives archive links", () => {
  for (const view of ["sites", "relations"]) {
    const first = registryDemo({ view, pageSize: "100", city: "610100" });
    const small = [1, 2].flatMap(page => {
      const result = registryDemo({ view, pageSize: "50", city: "610100", page: String(page) });
      return (view === "sites" ? result.rows : result.relations).map(row => row.id);
    });
    assert.deepEqual(small, (view === "sites" ? first.rows : first.relations).map(row => row.id));
    const last = registryDemo({ view, pageSize: "50", city: "610100", page: "100000" });
    assert.equal(last.query.page, Math.ceil(last.count / 50));
    const href = siteDetailHref(first.rows[0].id, first.query, { tab: "resources", period: "month" });
    const query = parseSiteQuery(Object.fromEntries(new URL(href, "http://localhost").searchParams), DEMO_REGION);
    assert.equal(query.pageSize, 100);
    assert.equal(new URL(siteListHref(query), "http://localhost").searchParams.get("pageSize"), "100");
  }
  for (const pageSize of ["0", "1", "11", "1000", "1.5", "020"]) assert.throws(() => registryDemo({ pageSize }));
});

test("resource totals deduplicate shared facilities across operator relations and agree with every visible dossier", () => {
  for (const operator of ["all", "mobile", "other"]) {
    const model = registryDemo({ operator, city: "610100", pageSize: "100" });
    let total = 0;
    for (let page = 1; page <= model.pages; page++) {
      const result = registryDemo({ operator, city: "610100", pageSize: "100", page: String(page) });
      for (const row of result.rows) {
        const detail = dossierDemo(row.id, { operator })!;
        const scope = resourceScope(detail.resources, operator as "all" | "mobile" | "other");
        assert.equal(result.resourceCounts[row.id], scope.devices.length);
        assert.equal(new Set(scope.devices.map(d => d.id)).size, scope.devices.length);
        total += scope.devices.length;
      }
    }
    assert.equal(total, model.summary.resources);
  }
  const all = registryDemo({});
  assert.equal(all.summary.resources, 9302);
  assert.equal(all.summary.relations, 3902);
  assert.notEqual(all.summary.resources, all.summary.relations * 6);
  assert.equal(registryDemo({ search: "not-a-site" }).summary.resources, 0);
});

test("lazy asset reads accept legacy links without returning analytics, reject malformed requests and stay gated outside preview", async t => {
  const prior = process.env.BSMOSS_PRODUCT_PREVIEW;
  t.after(() => { if (prior === undefined) delete process.env.BSMOSS_PRODUCT_PREVIEW; else process.env.BSMOSS_PRODUCT_PREVIEW = prior; });
  const context = { params: Promise.resolve({ id: "SX-DEMO-001" }) };
  process.env.BSMOSS_PRODUCT_PREVIEW = "off";
  assert.equal((await GET(new Request("http://localhost/api/product-preview/site-registry/SX-DEMO-001"), context)).status, 404);
  process.env.BSMOSS_PRODUCT_PREVIEW = "on";
  for (const tab of ["overview", "resources", "services", "runtime", "business", "sources"]) {
    const response = await GET(new Request("http://localhost/api/product-preview/site-registry/SX-DEMO-001?hour=12&period=week&tab=" + tab), context);
    assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), assetDetail("SX-DEMO-001", emptyMaintenance(), true));
  }
  for (const query of ["hour=24", "hour=1&hour=2", "operator=forged", "__proto__=x", "constructor=x", "period=year", "pageSize=11"]) {
    assert.equal((await GET(new Request("http://localhost/api/product-preview/site-registry/SX-DEMO-001?" + query), context)).status, 400);
  }
  assert.equal((await GET(new Request("http://localhost/api/product-preview/site-registry/missing"), { params: Promise.resolve({ id: "missing" }) })).status, 404);
});
