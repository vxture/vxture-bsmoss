import type { Pool, PoolClient } from "pg";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { assertReportScope, fields, reportScope, unionReportScopes } from "../reports/rules.ts";
import type { RevalidateReport } from "../reports/store.ts";
import { validateTemplateBindings } from "./pg-template-validation.ts";
import { templateCandidate, templatePublication, templateSelection, templateReadQuery, templatePointer, templateVersion,
  type TemplateCandidate, type TemplatePreview, type TemplatePublicationCommand, type TemplateSelectionCommand, type TemplatePointer, type PublishedTemplate } from "./templates.ts";
import type { TemplateStore } from "./template-store.ts";

interface PublicationManifest { schema: "template-publication-v1"; command: TemplatePublicationCommand; validation: TemplatePreview; requiredScope: MeasurementScope }
interface SelectionManifest { schema: "template-selection-v1"; command: TemplateSelectionCommand; validation: TemplatePreview; requiredScope: MeasurementScope }

export class PgTemplateStore implements TemplateStore {
  readonly workspaceId: string; private readonly scope: MeasurementScope;
  constructor(private readonly pool: Pool, scope: MeasurementScope, private readonly subject: string) {
    this.scope = reportScope(scope); this.workspaceId = scope.workspaceId; jobIdentity(subject);
  }
  private async tx<T>(readOnly: boolean, work: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect(); let discard = false;
    try { await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ" + (readOnly ? " READ ONLY" : "")); const result = await work(client); await client.query("COMMIT"); return result; }
    catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; } finally { client.release(discard); }
  }
  private async retry<T>(work: () => Promise<T>) {
    for (let i = 0; ; i++) try { return await work(); } catch (error) {
      const e = error as { code?: string; constraint?: string };
      const race = e.code === "40001" || e.code === "40P01" || e.code === "23505" && ["template_version_pkey", "template_publication_pkey", "template_publication_workspace_id_subject_command_id_key",
        "template_selection_event_pkey", "template_selection_event_workspace_id_subject_command_id_key"].includes(e.constraint ?? "");
      if (!race) throw error; if (i >= 2) throw Error("template_revision_conflict");
    }
  }
  private published(row: Record<string, any>): PublishedTemplate {
    templateVersion(Number(row.version));
    const candidate = templateCandidate({ kind: row.template_kind, definition: row.definition } as TemplateCandidate);
    return { code: row.code, version: Number(row.version), sha256: fingerprintOf(row.definition), candidate, publishedBy: row.published_by, publishedAt: row.published_at.toISOString() };
  }
  private async get(client: PoolClient, code: string, version?: number): Promise<PublishedTemplate | null> {
    const row = (await client.query(`SELECT * FROM bsmoss_views.template_version WHERE workspace_id=$1 AND code=$2
      ${version === undefined ? "ORDER BY version DESC LIMIT 1" : "AND version=$3"}`, version === undefined ? [this.workspaceId, code] : [this.workspaceId, code, version])).rows[0];
    return row ? this.published(row) : null;
  }
  private async current(client: PoolClient): Promise<TemplatePointer | null> {
    const row = (await client.query(`SELECT s.*,t.definition,t.template_kind,e.revision,e.manifest,e.manifest_sha256,e.subject,
      e.database_sha256=encode(sha256(convert_to(e.manifest::text,'UTF8')),'hex') AS valid
      FROM bsmoss_views.template_selection s JOIN bsmoss_views.template_version t
      ON (t.workspace_id,t.code,t.version)=(s.workspace_id,s.template_code,s.template_version)
      LEFT JOIN LATERAL (SELECT * FROM bsmoss_views.template_selection_event WHERE workspace_id=s.workspace_id AND scope_key=s.scope_key ORDER BY revision DESC LIMIT 1) e ON true
      WHERE s.workspace_id=$1 AND s.scope_key='analysis:default'`, [this.workspaceId])).rows[0];
    if (!row) return null;
    if (row.template_kind !== "page") throw Error("invalid_template_evidence");
    if (row.revision !== null) {
      const m = row.manifest as SelectionManifest, c = templateSelection(m.command);
      if (!row.valid || fingerprintOf(m) !== row.manifest_sha256 || m.schema !== "template-selection-v1" || c.templateCode !== row.template_code ||
          String(c.templateVersion) !== row.template_version || c.templateSha256 !== fingerprintOf(row.definition) || row.changed_by !== row.subject) throw Error("invalid_template_evidence");
    }
    return templatePointer({ revision: row.revision, code: row.template_code, version: Number(row.template_version), sha256: fingerprintOf(row.definition) });
  }
  private validation(raw: TemplatePreview) {
    fields(raw, ["candidateSha256", "validationSha256", "requiredScope", "references"]);
    const { validationSha256, ...evidence } = raw;
    if (fingerprintOf(evidence) !== validationSha256 || raw.requiredScope.workspaceId !== this.workspaceId) throw Error("invalid_template_evidence");
    reportScope(raw.requiredScope); return raw;
  }
  private publicationRecord(row: Record<string, any>) {
    const m = row.manifest as PublicationManifest; fields(m, ["schema", "command", "validation", "requiredScope"]);
    const c = templatePublication(m.command), v = this.validation(m.validation), requiredScope = reportScope(m.requiredScope);
    if (m.schema !== "template-publication-v1" || !row.valid || fingerprintOf(m) !== row.manifest_sha256 || !row.recorded_by ||
        row.workspace_id !== this.workspaceId || row.subject !== this.subject || row.command_id !== c.commandId || row.code !== c.templateCode ||
        Number(row.version) !== (c.expectedVersion ?? 0) + 1 || row.published_by !== row.subject || row.template_kind !== c.candidate.kind ||
        fingerprintOf(row.definition) !== fingerprintOf(c.candidate.definition) || c.candidateSha256 !== v.candidateSha256 ||
        c.validationSha256 !== v.validationSha256 || fingerprintOf(requiredScope) !== fingerprintOf(v.requiredScope)) throw Error("invalid_template_evidence");
    return { ...m, command: c, requiredScope };
  }
  private selectionRecord(row: Record<string, any>) {
    const m = row.manifest as SelectionManifest; fields(m, ["schema", "command", "validation", "requiredScope"]);
    const c = templateSelection(m.command), v = this.validation(m.validation), requiredScope = reportScope(m.requiredScope);
    positiveRevision(row.revision);
    if (m.schema !== "template-selection-v1" || !row.valid || fingerprintOf(m) !== row.manifest_sha256 || !row.recorded_by || row.workspace_id !== this.workspaceId ||
        row.subject !== this.subject || row.command_id !== c.commandId || row.scope_key !== c.scopeKey || row.template_code !== c.templateCode ||
        Number(row.template_version) !== c.templateVersion || BigInt(row.revision) !== BigInt(c.expected?.revision ?? "0") + 1n ||
        row.template_kind !== "page" || fingerprintOf(row.definition) !== c.templateSha256 || fingerprintOf(templateCandidate({kind: "page", definition: row.definition})) !== v.candidateSha256 ||
        c.validationSha256 !== v.validationSha256) throw Error("invalid_template_evidence");
    assertReportScope(requiredScope, v.requiredScope); if (requiredScope.workspaceId !== this.workspaceId) throw Error("invalid_template_evidence");
    return { ...m, command: c, requiredScope };
  }
  private async publicationRow(client: PoolClient, commandId: string) {
    return (await client.query(`SELECT p.*,t.template_kind,t.definition,t.published_by,
      p.database_sha256=encode(sha256(convert_to(p.manifest::text,'UTF8')),'hex') AS valid
      FROM bsmoss_views.template_publication p JOIN bsmoss_views.template_version t USING(workspace_id,code,version)
      WHERE p.workspace_id=$1 AND p.subject=$2 AND p.command_id=$3`, [this.workspaceId, this.subject, commandId])).rows[0];
  }
  private async selectionRow(client: PoolClient, commandId: string) {
    return (await client.query(`SELECT e.*,t.template_kind,t.definition,
      e.database_sha256=encode(sha256(convert_to(e.manifest::text,'UTF8')),'hex') AS valid
      FROM bsmoss_views.template_selection_event e JOIN bsmoss_views.template_version t
      ON (t.workspace_id,t.code,t.version)=(e.workspace_id,e.template_code,e.template_version)
      WHERE e.workspace_id=$1 AND e.subject=$2 AND e.command_id=$3`, [this.workspaceId, this.subject, commandId])).rows[0];
  }
  async preview(raw: TemplateCandidate, revalidate: RevalidateReport) {
    return this.tx(true, async client => { const v = await validateTemplateBindings(client, this.scope, raw); await revalidate(v.requiredScope); return v; });
  }
  async read(raw: { code: string; version?: number }, revalidate: RevalidateReport) {
    const q = templateReadQuery(raw);
    return this.tx(true, async client => {
      const template = await this.get(client, q.code, q.version), selection = await this.current(client), scopes: MeasurementScope[] = [];
      if (template) scopes.push((await validateTemplateBindings(client, this.scope, template.candidate)).requiredScope);
      if (selection) { const t = await this.get(client, selection.code, selection.version); if (!t) throw Error("invalid_template_evidence"); scopes.push((await validateTemplateBindings(client, this.scope, t.candidate)).requiredScope); }
      await revalidate(unionReportScopes(this.workspaceId, scopes)); return { template, selection };
    });
  }
  async publish(raw: TemplatePublicationCommand, revalidate: RevalidateReport) {
    const c = templatePublication(raw);
    return this.retry(() => this.tx(false, async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended(jsonb_build_array('bsmoss-template-publication',$1::text,$2::text)::text,0))", [this.workspaceId, c.templateCode]);
      const prior = await this.publicationRow(client, c.commandId), latest = await this.get(client, c.templateCode);
      if (prior) {
        const m = this.publicationRecord(prior); if (fingerprintOf(m.command) !== fingerprintOf(c)) throw Error("template_command_conflict");
        assertReportScope(this.scope, m.requiredScope); await revalidate(m.requiredScope);
        return { status: "duplicate" as const, code: c.templateCode, version: Number(prior.version), currentVersion: latest!.version, commandId: c.commandId };
      }
      if ((latest?.version ?? null) !== c.expectedVersion || latest && latest.candidate.kind !== c.candidate.kind) throw Error("template_revision_conflict");
      const validation = await validateTemplateBindings(client, this.scope, c.candidate);
      if (validation.validationSha256 !== c.validationSha256) throw Error("template_validation_changed");
      const version = (c.expectedVersion ?? 0) + 1, manifest: PublicationManifest = { schema: "template-publication-v1", command: c, validation, requiredScope: validation.requiredScope };
      await client.query(`INSERT INTO bsmoss_views.template_publication(workspace_id,code,version,subject,command_id,manifest,manifest_sha256)
        VALUES($1,$2,$3,$4,$5,$6,$7)`, [this.workspaceId, c.templateCode, version, this.subject, c.commandId, manifest, fingerprintOf(manifest)]);
      const stored = await this.publicationRow(client, c.commandId); if (!stored || fingerprintOf(this.publicationRecord(stored)) !== fingerprintOf(manifest)) throw Error("invalid_template_evidence");
      await revalidate(validation.requiredScope);
      return { status: "inserted" as const, code: c.templateCode, version, currentVersion: version, commandId: c.commandId };
    }));
  }
  async select(raw: TemplateSelectionCommand, revalidate: RevalidateReport) {
    const c = templateSelection(raw);
    return this.retry(() => this.tx(false, async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended(jsonb_build_array('bsmoss-template-selection',$1::text,$2::text)::text,0))", [this.workspaceId, c.scopeKey]);
      const prior = await this.selectionRow(client, c.commandId), current = await this.current(client);
      if (prior) {
        const m = this.selectionRecord(prior); if (fingerprintOf(m.command) !== fingerprintOf(c)) throw Error("template_command_conflict");
        assertReportScope(this.scope, m.requiredScope); await revalidate(m.requiredScope);
        return { status: "duplicate" as const, revision: prior.revision as string,
          selected: { revision: prior.revision as string, code: c.templateCode, version: c.templateVersion, sha256: c.templateSha256 },
          currentRevision: current!.revision!, isCurrent: current!.revision === prior.revision, commandId: c.commandId };
      }
      if (fingerprintOf(current) !== fingerprintOf(c.expected)) throw Error("template_revision_conflict");
      // The selection-event trigger owns the exclusive pointer lock; runtime
      // never receives direct pointer UPDATE permission.
      const t = await this.get(client, c.templateCode, c.templateVersion);
      if (!t || t.candidate.kind !== "page" || t.sha256 !== c.templateSha256) throw Error("template_validation_changed");
      const validation = await validateTemplateBindings(client, this.scope, t.candidate);
      if (validation.validationSha256 !== c.validationSha256) throw Error("template_validation_changed");
      const scopes = [validation.requiredScope];
      if (current) { const old = await this.get(client, current.code, current.version); if (!old) throw Error("invalid_template_evidence"); scopes.push((await validateTemplateBindings(client, this.scope, old.candidate)).requiredScope); }
      const requiredScope = unionReportScopes(this.workspaceId, scopes), revision = (BigInt(current?.revision ?? "0") + 1n).toString(); positiveRevision(revision);
      const manifest: SelectionManifest = { schema: "template-selection-v1", command: c, validation, requiredScope };
      await client.query(`INSERT INTO bsmoss_views.template_selection_event(workspace_id,scope_key,revision,subject,command_id,template_code,template_version,manifest,manifest_sha256)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [this.workspaceId, c.scopeKey, revision, this.subject, c.commandId, c.templateCode, c.templateVersion, manifest, fingerprintOf(manifest)]);
      const stored = await this.selectionRow(client, c.commandId); if (!stored || fingerprintOf(this.selectionRecord(stored)) !== fingerprintOf(manifest)) throw Error("invalid_template_evidence");
      const selected = await this.current(client); if (!selected || selected.revision !== revision) throw Error("invalid_template_evidence");
      await revalidate(requiredScope); return { status: "inserted" as const, revision, selected, currentRevision: revision, isCurrent: true, commandId: c.commandId };
    }));
  }
}
