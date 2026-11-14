import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import {
  CATEGORIES,
  refKey,
  type Category,
  type Grain,
} from "../catalog/registry.ts";
import {
  resolvePanels,
  type Panel,
  type Preference,
} from "../views/resolve.ts";
import { CITIES, OPERATORS, displayValue } from "./presentation.ts";
export interface PreviewRequest {
  category: Category;
  city: keyof typeof CITIES;
  operator: keyof typeof OPERATORS;
  preferences: Preference[];
}
export const DEFAULT_REQUEST: PreviewRequest = {
  category: "business_service",
  city: "all",
  operator: "all",
  preferences: [],
};
const names: Record<string, [string, string]> = {
  "service.voice.connected_seconds": [
    "\u63a5\u901a\u901a\u8bdd\u65f6\u957f",
    "\u6309\u6709\u6548\u7a97\u53e3\u6c42\u548c\uff1b\u8bed\u97f3\u65f6\u957f\u4e0e\u6570\u636e\u6d41\u91cf\u72ec\u7acb\u8ba1\u91cf\u3002",
  ],
  "service.voice.attempt_count": [
    "\u547c\u53eb\u5c1d\u8bd5\u6b21\u6570",
    "\u56fa\u5b9a\u7edf\u8ba1\u70b9\u7684\u547c\u53eb\u5c1d\u8bd5\u6b21\u6570\u3002",
  ],
  "service.voice.connected_count": [
    "\u547c\u53eb\u63a5\u901a\u6b21\u6570",
    "\u4e0e\u5c1d\u8bd5\u6b21\u6570\u4f7f\u7528\u540c\u4e00\u7edf\u8ba1\u70b9\u3002",
  ],
  "service.data.uplink_bytes": [
    "\u4e0a\u884c\u6d41\u91cf",
    "\u4e0a\u884c\u533a\u95f4\u5b57\u8282\u589e\u91cf\uff0c\u4fdd\u7559\u65b9\u5411\u53e3\u5f84\u3002",
  ],
  "service.data.downlink_bytes": [
    "\u4e0b\u884c\u6d41\u91cf",
    "\u4e0b\u884c\u533a\u95f4\u5b57\u8282\u589e\u91cf\uff1b\u7f3a\u6570\u4e0d\u8ba1\u4f5c\u96f6\u3002",
  ],
  "service.data.total_bytes": [
    "\u53cc\u5411\u603b\u6d41\u91cf",
    "\u4ec5\u540c\u7a97\u4e0a\u4e0b\u884c\u5747\u6709\u6548\u65f6\u8ba1\u7b97\uff1b\u603b\u91cf\u4e0d\u4e0e\u65b9\u5411\u660e\u7ec6\u91cd\u590d\u7d2f\u52a0\u3002",
  ],
  "service.sms.success_count": [
    "\u77ed\u4fe1\u6210\u529f\u91cf",
    "\u6837\u4f8b\u6765\u6e90\u672a\u63a5\u5165\u77ed\u4fe1\u6570\u636e\u3002",
  ],
  "status.voice.connection_rate": [
    "\u547c\u53eb\u63a5\u901a\u7387",
    "\u6c47\u603b\u63a5\u901a\u4e0e\u5c1d\u8bd5\u6b21\u6570\u540e\u76f8\u9664\uff0c\u4e0d\u5e73\u5747\u767e\u5206\u6bd4\u3002",
  ],
  "status.radio.prb_utilization": [
    "PRB \u8d44\u6e90\u5229\u7528\u7387",
    "\u6309\u8d44\u6e90\u65f6\u95f4\u5408\u5e76\u5206\u5b50\u5206\u6bcd\uff1b\u6837\u4f8b\u91c7\u7528\u4e0b\u884c\u540c\u5236\u5f0f\u53e3\u5f84\u3002",
  ],
  "runtime.energy.site_wh": [
    "\u7ad9\u5740\u603b\u7535\u8017",
    "\u7ad9\u5740\u603b\u8868\u533a\u95f4\u7535\u8017\uff0c\u65e0\u8fd0\u8425\u5546\u5206\u644a\u4f9d\u636e\u3002",
  ],
  "runtime.device.state": [
    "\u8bbe\u5907\u72b6\u6001",
    "\u67e5\u8be2\u65f6\u6bb5\u7ed3\u675f\u65f6\u7684\u6837\u672c\u8bbe\u5907\u72b6\u6001\u5206\u5e03\u3002",
  ],
};
const defaults: Record<string, string> = {
  second: "hour",
  count: "count",
  byte: "GiB",
  ratio: "%",
  Wh: "kWh",
  enum: "state",
};
// Keep this established synthetic fixture limited to metrics it actually models.
const codeList = FIRST_METRICS.list().filter(m => m.semantic !== "gauge");
const template = {
  workspaceId: "preview",
  code: "tower-sample",
  version: 1,
  panels: codeList.map(
    (m, i): Panel => ({
      id: m.code,
      category: m.category,
      metricRef: { code: m.code, version: m.version },
      view: m.semantic === "state" ? "table" : "trend",
      grain: "hour",
      displayUnit: defaults[m.unit],
      precision: 2,
      order: i,
      visible: ![
        "service.voice.attempt_count",
        "service.voice.connected_count",
        "service.data.downlink_bytes",
      ].includes(m.code),
    }),
  ),
};
const allowedMetricKeys = new Set(codeList.map(refKey));
// Synthetic source capability. Never changes the real catalog lifecycle.
const capabilities = codeList
  .filter((m) => m.code !== "service.sms.success_count")
  .map((m) => ({
    metricRef: { code: m.code, version: m.version },
    grains: ["hour", "day"] as Grain[],
  }));
const stations = [
  {
    id: "SX-DEMO-001",
    name: "\u9ad8\u65b0\u6837\u4f8b\u7ad9",
    city: "xian",
    operator: "mobile",
  },
  {
    id: "SX-DEMO-002",
    name: "\u66f2\u6c5f\u6837\u4f8b\u7ad9",
    city: "xian",
    operator: "telecom",
  },
  {
    id: "SX-DEMO-003",
    name: "\u6e2d\u6ee8\u6837\u4f8b\u7ad9",
    city: "baoji",
    operator: "unicom",
  },
  {
    id: "SX-DEMO-004",
    name: "\u91d1\u53f0\u6837\u4f8b\u7ad9",
    city: "baoji",
    operator: "broadcast",
  },
  {
    id: "SX-DEMO-005",
    name: "\u79e6\u90fd\u6837\u4f8b\u7ad9",
    city: "xianyang",
    operator: "mobile",
  },
  {
    id: "SX-DEMO-006",
    name: "\u6e2d\u57ce\u6837\u4f8b\u7ad9",
    city: "xianyang",
    operator: "other",
  },
];
interface Sample {
  station: (typeof stations)[number];
  hour: number;
  voice: number;
  attempts: number;
  connected: number;
  up: number;
  down: number | null;
  used: number;
  capacity: number;
  energy: number;
  state: string;
}
const samples: Sample[] = stations.flatMap((station, i) =>
  Array.from({ length: 24 }, (_, hour) => {
    const load = 0.3 + 0.65 * Math.exp(-Math.pow((hour - 14) / 5, 2));
    const attempts = Math.round(450 * (i + 1) * load);
    const connected = Math.floor(attempts * (0.976 + i * 0.001));
    return {
      station,
      hour,
      voice: connected * 64,
      attempts,
      connected,
      up: Math.round((i + 1) * load * 1.4 * 1073741824),
      down:
        i === 2 && hour === 10
          ? null
          : Math.round((i + 1) * load * 6.2 * 1073741824),
      used: Math.round((0.29 + load * 0.48) * 100000 * (i + 1)),
      capacity: 100000 * (i + 1),
      energy: Math.round(2200 + (i + 1) * load * 700),
      state:
        i === 4 && hour === 23
          ? "unknown"
          : i === 2 && hour === 23
            ? "fault"
            : "running",
    };
  }),
);
export function parsePreviewRequest(value: unknown): PreviewRequest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid_request");
  const r = value as Record<string, unknown>;
  if (
    Object.keys(r).some(
      (k) => !["category", "city", "operator", "preferences"].includes(k),
    )
  )
    throw new Error("unknown_field");
  if (
    !CATEGORIES.includes(r.category as Category) ||
    !Object.hasOwn(CITIES, r.city as string) ||
    !Object.hasOwn(OPERATORS, r.operator as string) ||
    !Array.isArray(r.preferences) ||
    r.preferences.length > 30
  )
    throw new Error("invalid_filter");
  for (const p of r.preferences) {
    if (
      !p ||
      typeof p !== "object" ||
      Array.isArray(p) ||
      typeof p.id !== "string"
    )
      throw new Error("invalid_preference");
    if (
      p.id === "runtime.device.state" &&
      p.displayUnit !== undefined &&
      p.displayUnit !== "state"
    )
      throw new Error("unsupported_state_display");
  }
  return r as unknown as PreviewRequest;
}
function read(code: string, rows: Sample[]): number | null {
  if (!rows.length) return null;
  const sum = (fn: (r: Sample) => number) =>
    rows.reduce((n, r) => n + fn(r), 0);
  switch (code) {
    case "service.voice.connected_seconds":
      return sum((r) => r.voice);
    case "service.voice.attempt_count":
      return sum((r) => r.attempts);
    case "service.voice.connected_count":
      return sum((r) => r.connected);
    case "service.data.uplink_bytes":
      return sum((r) => r.up);
    case "service.data.downlink_bytes":
      return rows.some((r) => r.down === null) ? null : sum((r) => r.down!);
    case "service.data.total_bytes":
      return rows.some((r) => r.down === null)
        ? null
        : sum((r) => r.up + r.down!);
    case "status.voice.connection_rate":
      return sum((r) => r.attempts)
        ? sum((r) => r.connected) / sum((r) => r.attempts)
        : null;
    case "status.radio.prb_utilization":
      return sum((r) => r.used) / sum((r) => r.capacity);
    case "runtime.energy.site_wh":
      return sum((r) => r.energy);
    default:
      return null;
  }
}
export function buildPreview(value: unknown) {
  const request = parsePreviewRequest(value);
  const resolved = resolvePanels(FIRST_METRICS, {
    workspaceId: "preview",
    template,
    mode: "interactive",
    allowedMetricKeys,
    capabilities,
    preferences: request.preferences,
  });
  const selected = stations.filter(
    (s) =>
      (request.city === "all" || s.city === request.city) &&
      (request.operator === "all" || s.operator === request.operator),
  );
  const rows = samples.filter((r) => selected.includes(r.station));
  const cards = resolved.panels
    .filter((p) => p.category === request.category)
    .map((p) => {
      const code = p.metricRef.code,
        physical = code.startsWith("runtime."),
        state = code.endsWith("device.state");
      const unsupported = p.availability !== "supported";
      const status = unsupported
        ? "not_connected"
        : physical && request.operator !== "all"
          ? "not_applicable"
          : !rows.length
            ? "empty"
            : code.includes("sms")
              ? "not_connected"
              : "sample";
      const missing = rows.filter((r) => r.down === null).length;
      const partial =
        status === "sample" &&
        (code.endsWith("downlink_bytes") || code.endsWith("total_bytes")) &&
        missing > 0;
      const valid = partial ? rows.filter((r) => r.down !== null) : rows;
      const number = status === "sample" && !state ? read(code, valid) : null;
      const current = rows.filter((r) => r.hour === 23);
      const states =
        state && status === "sample"
          ? ["running", "fault", "unknown"].map((key) => ({
              key,
              count: current.filter((r) => r.state === key).length,
            }))
          : [];
      const series =
        status !== "sample" || state
          ? []
          : Array.from({ length: p.grain === "day" ? 1 : 24 }, (_, h) => {
              const bucket =
                p.grain === "day" ? rows : rows.filter((r) => r.hour === h);
              return {
                label:
                  p.grain === "day"
                    ? "10-25"
                    : String(h).padStart(2, "0") + ":00",
                value: read(code, bucket),
              };
            });
      return {
        id: p.id,
        code,
        name: names[code][0],
        description: names[code][1],
        category: p.category,
        unit: p.displayUnit,
        precision: p.precision,
        grain: p.grain,
        status,
        partial,
        value: number,
        formatted:
          state && status === "sample"
            ? String(current.filter((r) => r.state === "running").length)
            : displayValue(number, p.displayUnit, p.precision),
        validWindows: partial ? valid.length : rows.length,
        expectedWindows: rows.length,
        series,
        states,
        evidence: selected.map((s) => {
          const entries = rows.filter((r) => r.station === s);
          const known = entries.filter((r) => r.down !== null);
          const n =
            status === "sample" && !state
              ? read(code, partial ? known : entries)
              : null;
          return {
            stationId: s.id,
            name: s.name,
            city: CITIES[s.city as keyof typeof CITIES],
            operator: physical
              ? "\u5171\u4eab\u7ad9\u5740\u53c2\u6570"
              : OPERATORS[s.operator as keyof typeof OPERATORS],
            value:
              state && status === "sample"
                ? (entries.at(-1)?.state ?? "unknown")
                : displayValue(n, p.displayUnit, p.precision),
            quality:
              status !== "sample"
                ? status
                : partial && known.length < entries.length
                  ? "partial"
                  : "sample",
            source: "fixture-hourly-v1",
          };
        }),
      };
    });
  return {
    mode: "sample" as const,
    request,
    templateVersion: resolved.templateVersion,
    window: "2026-10-25 00:00 \u2014 24:00",
    watermark: "2026-10-26 08:00 +08:00",
    revision: 1,
    stationCount: selected.length,
    quality: {
      valid: rows.filter((r) => r.down !== null).length,
      expected: rows.length,
    },
    cards,
    options: template.panels
      .filter((p) => p.category === request.category)
      .map((p) => {
        const m = FIRST_METRICS.get(p.metricRef)!;
        const pref = request.preferences.find((x) => x.id === p.id);
        return {
          id: p.id,
          name: names[p.id][0],
          visible: pref?.visible ?? p.visible,
          order: pref?.order ?? p.order,
          unit: pref?.displayUnit ?? p.displayUnit,
          grain: pref?.grain ?? p.grain,
          units: m.semantic === "state" ? ["state"] : [...m.displayUnits],
          grains: [...m.grains],
        };
      }),
  };
}
export type PreviewData = ReturnType<typeof buildPreview>;
