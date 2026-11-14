import {test} from "node:test";
import assert from "node:assert/strict";
import {overviewDisplayHref} from "./overview-display-links";
import {legacyDestination} from "./legacy-destination";
import {managementNavigation} from "./management-navigation";
import {portalNavigation} from "./navigation";

test("legacy personal overview settings resolve only to configuration management", () => {
  const input = {city: "610100", county: "610116", reportPeriod: "week", job: "one", saved: "x", next: "https://invalid.example"};
  assert.equal(overviewDisplayHref(), "/settings/overview");
  assert.equal(legacyDestination("preferences", input), "/settings/overview");
  assert.equal(legacyDestination("preferences", {city: ["610100", "610200"], next: "https://invalid.example"}), "/settings/overview");
});

test("overview configuration has one management destination and no business launcher destination", () => {
  for (const preview of [false, true]) {
    assert.ok(!portalNavigation(preview).some(e => e.id === "overview-display"));
    const entries = managementNavigation(preview).flatMap(g => g.items).filter(e => e.id === "overview-display");
    assert.equal(entries.length, 1); assert.equal(entries[0].href, "/settings/overview");
  }
});
