# Empty database initialization

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

The current baseline contains 31 tables: 15 original domain tables, 3 aggregate
tables, 2 source completion ledgers, 10 neutral platform tables
(vx_provision/local_authz/local_usage), and explicit local_authz.data_scope.
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
