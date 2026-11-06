import { resolveMeasurementAccess, type AccessPorts } from "../access/resolve.ts";
import type { UnattributedDraft } from "../access/measurements.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey } from "../catalog/registry.ts";
import { normalizeDraft } from "../measurements/rules.ts";
import { assertReportScope } from "../reports/rules.ts";
import { exactFields, PULL_LIMITS, planSourcePull, sourceBinding, sourceHead, sourcePage, sourcePosition } from "./rules.ts";
import type { SourceBinding, SourceReadPort, SourcePosition } from "./contracts.ts";

async function readBounded<T>(read: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> {
  const signal = AbortSignal.any([AbortSignal.timeout(PULL_LIMITS.callMs), ...(parent ? [parent] : [])]);
  signal.throwIfAborted();
  let abort: () => void = () => {};
  try {
    const cancelled = new Promise<never>((_, reject) => { abort = () => reject(signal.reason); signal.addEventListener("abort", abort, { once: true }); });
    // Attach the rejection handler even if an adapter ignores cancellation.
    const result = await Promise.race([read(signal), cancelled]); signal.throwIfAborted(); return result;
  } finally { signal.removeEventListener("abort", abort); }
}

/** Read-only preparation. No DB writes, checkpoints, jobs or completion claims
 * are committed here. Production activation awaits a reviewed source adapter
 * and durable intake coordinator; never expose this as a browser write API. */
export async function prepareSourceUpdate(ports: AccessPorts, connector: SourceReadPort, rawBinding: SourceBinding, rawPosition: SourcePosition | null, signal?: AbortSignal) {
  const binding = sourceBinding(rawBinding), position = rawPosition === null ? null : sourcePosition(rawPosition);
  const now = ports.now ?? Date.now;
  const first = await resolveMeasurementAccess(ports, "ingest", "data");
  assertReportScope(first.scope, binding.scope);
  async function check() {
    signal?.throwIfAborted();
    const current = await resolveMeasurementAccess(ports, "ingest", "data");
    if (first.expiresAt <= now() || current.context.sub !== first.context.sub || current.context.workspaceId !== first.context.workspaceId) throw Error("access_expired");
    assertReportScope(current.scope, binding.scope);
  }
  // Send copies so an adapter cannot mutate the service's binding or plan.
  await check();
  const head = sourceHead(await readBounded(s => connector.head({ binding: structuredClone(binding), signal: s }), signal));
  await check();
  const plan = planSourcePull(binding, head, position, now());
  const records = new Map<string, UnattributedDraft>();
  const cursors = new Set<string>(); let after: string | null = null, pages = 0, received = 0, bytes = 0;
  if (plan.state === "pull") {
    for (;;) {
      if (pages >= PULL_LIMITS.pages) throw Error("source_page_bound_exceeded");
      await check();
      const page = sourcePage(await readBounded(s => connector.page({ binding: structuredClone(binding), plan: structuredClone(plan), after, limit: PULL_LIMITS.pageSize, signal: s }), signal), plan, after);
      await check(); pages++; received += page.items.length; bytes += Buffer.byteLength(JSON.stringify(page), "utf8");
      if (received > PULL_LIMITS.records) throw Error("source_record_bound_exceeded");
      if (bytes > PULL_LIMITS.totalBytes) throw Error("source_total_bytes_exceeded");
      for (const item of page.items) {
        const m = item.measurement;
        exactFields(m, ["sourceId", "eventId", "revision", "previousRevision", "payloadSha256", "payloadUri", "occurredAt", "metric", "componentKey", "stationId", "mappingId", "transformVersion", "periodStart", "periodEnd", "value"]);
        exactFields(m.metric, ["code", "version"]);
        // An upstream quality flag cannot approve local evidence. A later
        // governed quality process must independently review pending records.
        const draft = normalizeDraft({ ...m, workspaceId: binding.scope.workspaceId, quality: {
          status: "pending", ruleVersion: "connector-intake-v1", reason: "source_quality_review_required", decidedBy: first.context.sub,
        } }, FIRST_METRICS);
        if (draft.sourceId !== binding.sourceId || draft.transformVersion !== binding.transformVersion || !binding.scope.stationIds.includes(draft.stationId) || !binding.scope.metricKeys.includes(refKey(draft.metric))) throw Error("source_record_scope_denied");
        if (draft.periodStart < binding.coverageStart || draft.periodEnd > plan.to || item.kind === "window" && draft.periodStart < plan.from) throw Error("source_record_window_denied");
        // Service/device effective mappings remain the existing PG store's
        // responsibility at eventual append time; preparation is not approval.
        const { workspaceId: _workspace, quality: { decidedBy: _actor, ...quality }, ...value } = draft;
        const record: UnattributedDraft = { ...value, quality };
        const key = fingerprintOf([record.sourceId, record.eventId, record.revision, refKey(record.metric), record.componentKey]);
        const prior = records.get(key);
        if (prior && fingerprintOf(prior) !== fingerprintOf(record)) throw Error("source_conflicting_replay");
        records.set(key, record);
      }
      if (page.next === null) break;
      if (cursors.has(page.next)) throw Error("source_cursor_cycle");
      cursors.add(page.next); after = page.next;
    }
  }
  await check();
  const ordered = [...records].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value);
  return { state: plan.state === "current" ? "current" as const : "prepared" as const, applied: false as const, publishesAvailability: false as const,
    plan, pages, received, records: ordered, recordsSha256: fingerprintOf(ordered),
    // Preserve the claim only as unverified evidence. It has not been bound to
    // a local input snapshot and must never populate source_completion here.
    unverifiedCompletionClaim: head.completionClaim };
}
