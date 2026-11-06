# Empty database initialization

Current baseline: 65 tables. source_binding_revision/source_binding_head record
reviewed source configuration; runtime can only read and hold a fixed shared
head lock. source_intake_receipt is append-only, committing received-input
position together with raw facts, pending quality and input changes. It is not
a source completeness attestation or an analysis availability publication.
Only the internal intake coordinator is implemented; no live adapter or machine
ingest entitlement is enabled. data_update_request records immutable handles over
already-received evidence for reviewed partitions; existing dispatch/result
workers continue independently. It is not an upstream connector or a published
availability watermark. Runtime request INSERT/SELECT and append-only column
locks follow the existing analysis grants. Historical counts below describe
earlier increments. Use only the reviewed empty-database initialization path.

This is a new product: no legacy migration or data conversion is required.
Use a dedicated EMPTY database. Apply 00_baseline.sql, then 97_runtime_grants.sql,
then 98_column_locks.sql in one transaction via db-init under an administrative identity.
The DBA must provision bsmoss_svc as a non-owner/non-superuser role first.
No script drops an existing schema or resets populated databases.

00 requires btree_gist for source mapping interval exclusion. Prisma mirrors
scalar fields and indexes; database CHECK/FK/exclusion constraints remain DDL-owned.
Metric JSON and template JSON still require application catalog/template validation;
SQL does not validate all business semantics or row-level user authorization.
Measurement mapping effective-time coverage, source/mapping consistency and
metric semantic/value-kind matching must also be checked by the ingestion service.
Raw evidence, facts, quality decisions and published config versions are append-only
for the runtime role. Selection pointer updates need service audit records (not yet implemented).

Validated against a dedicated local PostgreSQL 18.4 cluster and Prisma CLI 7.8.0.
Reproducible checks: pnpm test:db (requires TEST_DATABASE_ADMIN_URL for a local
test cluster), pnpm prisma:validate and pnpm lint:schema-mirror.
See docs/40-implementation/20-database-contract.md for evidence and limits.

The current baseline contains 50 tables, including the original domain and
neutral platform tables, typed aggregate revisions, completion ledgers, refresh
queues, input/authority change evidence, dispatch receipts and registered partitions.
object_rollup_revision adds reviewed finite coverage configuration. Runtime can
only read it; its trigger enforces append-only contiguous revisions and captures
the JSONB digest and database actor. Resource ownership, disjoint coverage and
ratio bases are also validated by the scoped query service, not only SQL shape.
report_series/report_revision/report_outbox persist generated report snapshots,
not approved publication or exported files. Only the current_revision series
column is runtime-updatable. The service enforces finite source scope, report
template semantics, CAS, fingerprints and final access revalidation atomically.
report_publication_event/report_publication_outbox add a separate append-only
publication/withdrawal chain and atomic event delivery records. Generated reports
stay unchanged. SQL enforces contiguous transitions and exact tenant/revision/SHA
references; freshness, completeness and full current authorization are enforced
by the publication service. This does not publish externally or sign source data.
The publication trigger also maintains current_publication_revision on the report
series as a write fence; the runtime role cannot update that pointer directly.
report_export_job/report_export_artifact/report_export_attempt add durable bounded
HTML exports. Pure rendering and artifact/receipt/status writes share one locked
transaction, so a process abort returns to pending without an external lease.
Only queue state columns are runtime-updatable; artifacts and receipts are append-only.
Downloads independently revalidate the active exact publication, current source
evidence and user scope, and recompute the deterministic artifact digest.
DDL files intentionally do not commit independently; the initializer owns the
transaction and refuses a database with existing product schemas.
Runtime cannot edit member roles/scopes or use the reserved platform usage buffer.
See docs/40-implementation/60-yucer-alignment.md for the current adapter scope.

Aggregate revisions and outbox events are append-only; the runtime role may
update only the series current_revision pointer. Expected-head concurrency,
calendar alignment, catalog semantics and authorized triples are enforced by
the service/store, not by row-level SQL authorization. Outbox delivery and
acknowledgment are not implemented. See
docs/40-implementation/100-aggregate-persistence.md.

source_completion is a reviewed, append-only confirmation/revocation ledger;
the runtime role has SELECT only, with no INSERT/UPDATE/DELETE/TRUNCATE grant.
It does not create an automatic source confirmation or ingestion approval path.
See docs/40-implementation/120-source-completion.md.

source_completion_set attests a whole stable object/metric/window across mapping
versions, with exact mapping-manifest and input fingerprints. Latest set revisions
win before fingerprint matching, including revocation; runtime has SELECT only.
NULLS NOT DISTINCT uniqueness requires PostgreSQL 15+ (deployment targets 18).
See docs/40-implementation/310-composite-completion.md.

refresh_job permits state/lease/scheduling-column updates only; refresh_attempt
is append-only. A fenced aggregate publication can commit result, outbox, job
success and its receipt together. No scheduler or machine identity is enabled.
See docs/40-implementation/320-durable-refresh-queue.md.
