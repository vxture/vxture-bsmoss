import { createRegistry, GRAINS, type MetricDefinition, type MetricRef } from "./registry.ts";
const ref = (code: string): MetricRef => ({ code, version: 1 });
const metric = (code: string, unit: MetricDefinition["unit"], overrides: Partial<MetricDefinition> = {}): MetricDefinition => ({
  code, version: 1, category: "business_service", unit, semantic: "interval_delta", lifecycle: "planned",
  object: "network_object", attribution: "service_required", timeAggregation: "sum", objectAggregation: "disjoint_sum",
  grains: GRAINS, displayUnits: unit === "byte" ? ["B", "MB", "GB", "GiB"] : unit === "second" ? ["second", "minute", "hour"] : ["count"],
  dependencies: [], ...overrides,
});
export const FIRST_METRICS = createRegistry([
  metric("service.voice.connected_seconds", "second"),
  metric("service.voice.attempt_count", "count"),
  metric("service.voice.connected_count", "count"),
  metric("service.data.uplink_bytes", "byte"),
  metric("service.data.downlink_bytes", "byte"),
  metric("service.data.total_bytes", "byte", { semantic: "derived", timeAggregation: "derived_sum", dependencies: [ref("service.data.uplink_bytes"), ref("service.data.downlink_bytes")] }),
  metric("service.sms.success_count", "count"),
  metric("status.voice.connection_rate", "ratio", { category: "operational_status", semantic: "ratio", timeAggregation: "ratio_parts", objectAggregation: "ratio_parts", displayUnits: ["%"], dependencies: [ref("service.voice.connected_count"), ref("service.voice.attempt_count")] }),
  metric("status.radio.prb_utilization", "ratio", { category: "operational_status", semantic: "ratio", object: "cell", timeAggregation: "ratio_parts", objectAggregation: "ratio_parts", displayUnits: ["%"] }),
  metric("runtime.energy.site_wh", "Wh", { category: "runtime_parameter", object: "station_meter", attribution: "physical_object", displayUnits: ["Wh", "kWh"] }),
  metric("runtime.device.state", "enum", { category: "runtime_parameter", semantic: "state", object: "device", attribution: "physical_object", timeAggregation: "state_duration", objectAggregation: "state_counts", displayUnits: ["state", "second", "device_count"] }),
]);

