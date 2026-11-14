export type AssetKind = "site" | "device";
export interface MaintenanceFields { alias: string; locationNote: string; note: string }
export interface MaintenanceRecord extends MaintenanceFields { kind: AssetKind; id: string; revision: number; updatedAt: string }
export interface MaintenanceEvent { kind: AssetKind; id: string; revision: number; at: string; actor: string; before: MaintenanceFields; after: MaintenanceFields }
export interface MaintenanceCatalog { records: MaintenanceRecord[]; events: MaintenanceEvent[] }
export interface MaintenanceCommand extends MaintenanceFields { kind: AssetKind; id: string; revision: number }
export const emptyMaintenance = (): MaintenanceCatalog => ({ records: [], events: [] });
export const emptyFields = (): MaintenanceFields => ({ alias: "", locationNote: "", note: "" });
function fields(raw: unknown, names: string[]): asserts raw is Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).sort().join() !== [...names].sort().join()) throw Error("invalid_maintenance");
}
function text(value: unknown, limit: number) {
  if (typeof value !== "string" || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw Error("invalid_maintenance");
  return value.trim();
}
export function maintenanceCommand(raw: unknown): MaintenanceCommand {
  fields(raw, ["kind", "id", "revision", "alias", "locationNote", "note"]);
  if (!['site', 'device'].includes(String(raw.kind)) || typeof raw.id !== "string" || !/^[A-Za-z0-9-]{1,80}$/.test(raw.id) || !Number.isSafeInteger(raw.revision) || Number(raw.revision) < 0) throw Error("invalid_maintenance");
  const command = { kind: raw.kind as AssetKind, id: raw.id, revision: Number(raw.revision), alias: text(raw.alias, 80), locationNote: text(raw.locationNote, 300), note: text(raw.note, 1000) };
  if (/[\r\n\t]/.test(command.alias + command.locationNote) || command.kind === "device" && command.locationNote) throw Error("invalid_maintenance");
  return command;
}
export function maintenanceFor(catalog: MaintenanceCatalog, kind: AssetKind, id: string) { return catalog.records.find(r => r.kind === kind && r.id === id); }
export function applyMaintenance(catalog: MaintenanceCatalog, raw: unknown, at: string, actor: string): MaintenanceCatalog {
  const command = maintenanceCommand(raw), current = maintenanceFor(catalog, command.kind, command.id);
  if ((current?.revision ?? 0) !== command.revision) throw Error("maintenance_conflict");
  const before = current ? { alias: current.alias, locationNote: current.locationNote, note: current.note } : emptyFields();
  const after = { alias: command.alias, locationNote: command.locationNote, note: command.note };
  if (JSON.stringify(before) === JSON.stringify(after)) return catalog;
  if (!Number.isFinite(Date.parse(at)) || !actor || catalog.events.length >= 10000) throw Error("maintenance_unavailable");
  const record = { ...command, ...after, revision: command.revision + 1, updatedAt: at };
  return { records: [...catalog.records.filter(r => r.kind !== record.kind || r.id !== record.id), record], events: [...catalog.events, { kind: record.kind, id: record.id, revision: record.revision, at, actor, before, after }] };
}
export function readMaintenance(raw: unknown): MaintenanceCatalog {
  fields(raw, ["records", "events"]);
  if (!Array.isArray(raw.records) || !Array.isArray(raw.events) || raw.events.length > 10000) throw Error("invalid_maintenance");
  // Replay immutable events so malformed records or a missing audit cannot pass.
  let catalog = emptyMaintenance();
  for (const value of raw.events) {
    fields(value, ["kind", "id", "revision", "at", "actor", "before", "after"]);
    fields(value.before, ["alias", "locationNote", "note"]); fields(value.after, ["alias", "locationNote", "note"]);
    const current = maintenanceFor(catalog, value.kind as AssetKind, String(value.id));
    if (JSON.stringify(value.before) !== JSON.stringify(current ? { alias: current.alias, locationNote: current.locationNote, note: current.note } : emptyFields()) || typeof value.at !== "string" || typeof value.actor !== "string") throw Error("invalid_maintenance");
    const next = applyMaintenance(catalog, { kind: value.kind, id: value.id, revision: Number(value.revision) - 1, ...value.after }, value.at, value.actor);
    if (next === catalog || next.events.at(-1)!.revision !== value.revision) throw Error("invalid_maintenance");
    catalog = next;
  }
  if (JSON.stringify(catalog.records) !== JSON.stringify(raw.records)) throw Error("invalid_maintenance");
  return catalog;
}
