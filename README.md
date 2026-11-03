# BS-MOSS

Base Station Multi-domain Operation and Supervision System.
Chinese product name is defined in docs/20-specs/10-product-definition.md.

A Shaanxi-wide base station supervision product for the tower construction and
operation entity, serving Telecom, Unicom, Mobile, Broadcast and other operators.
Planning scale: approximately 110,000 stations; this is not an imported inventory.

## Architecture

Follows yucer's product-spec -> domain ownership -> pure rules -> gated service
-> store port structure. Platform C1 identity, C2 entitlement and C3 provisioning
and usage follow the engineering reference. C1/C2/C3 adapters and a protected
measurement query are implemented locally; live registration and deployment
remain pending. See docs/40-implementation/60-yucer-alignment.md.

- portals/app/app/domains/: station, integration, metering, supervision,
  settlement, analysis; shared types and access context.
- portals/packages/shared/: product identity.
- deploy/database/ddl/: empty-database baseline, sole database structure authority.
- docs/: numbered product specifications, design and delivery batches.
- scripts/guardrails/: documentation numbering check inherited from yucer.

## Development

Requires Node >=22.18 and pnpm 10.30.3.

    pnpm install
    pnpm test
    pnpm type-check:all
    pnpm lint:docs-numbering

Implemented: versioned metric and view rules, a 61-table empty-database baseline,
transactional PostgreSQL measurements and aggregates, formal analysis with personal
display preferences, versioned reports and audited task queues, and a gated sample
portal. The internal trusted-access resolver and service facades are tested;
production RP, entitlement, PostgreSQL local-grant and provisioning providers
are now wired, with no in-memory production fallback.
Live sources and production deployment remain pending.
Memory storage and tariff examples are isolated early test assets, not enabled
product features. Read docs/70-workplan/00-index.md before extending the product.


## Current scope (V0.2)

Periodic usage analysis only: voice duration and directional data traffic first,
with optional call counts, SMS, energy and load indicators where sources support
them. Design covers 15-minute, hourly, daily, weekly and monthly analysis.
Fees are reserved for future expansion; the isolated tariff example is not an
enabled product capability. See docs/20-specs/60-periodic-usage-analysis.md.

## Metric classification (V0.3)

Periodic analysis covers three configurable categories: business service,
operational status and runtime parameters. The planned catalog and versioned
view/report configuration are specified in docs/20-specs/70-metric-catalog.md.
The sample portal implements configurable display for the first metric catalog.
Formal /analysis, /reports and /operations workspaces use real RP authorization;
the authenticated evidence API is /api/measurements. Live source adapters and
production acceptance remain pending. Formal analysis defaults to a server-selected
page template; personal preferences never change scope, bindings or report templates.
Reviewed physical-device populations support exact state counts/device-time and
per-device temperature-mean bins in formal analysis and reports. Missing or stale
devices remain unknown; temperatures are never summed or averaged across sensors.
See docs/40-implementation/590-reviewed-device-distributions.md.
Formal /settings/templates adds scoped configuration validation, immutable page
and report template publication, and audited default selection/rollback. Independent
permissions and incoming/displaced object scope are required; publication never
auto-selects a page or generates/publishes reports. Role-layer governance remains
pending. See docs/40-implementation/600-reviewed-template-governance.md.

## Local sample portal (I10)

    pnpm build
    $env:BSMOSS_PRODUCT_PREVIEW = "on"
    $env:PORT = "0"
    pnpm --filter @bsmoss/app start

PowerShell example: PORT=0 selects an ephemeral local port printed at startup.
Use the registered environment port for a persistent environment. Binding defaults
to 127.0.0.1. Visit /product-preview at the printed URL. The page and sample API
return 404 unless BSMOSS_PRODUCT_PREVIEW=on. This flag is not authentication.

The map portal covers 1,080 synthetic sites and six featured station profiles in
Shaanxi. It supports province/city/county and operator scopes, exact spatial
selections, hour/day/week/month usage analysis, and station/regional HTML drafts.
Its calendar and four-week reference data are fixed synthetic samples. The
separate /product-preview/metrics portal exposes the versioned metric definitions
and browser display preferences. Preferences do not change formal report templates.
No database is required for this sample. Run pnpm test:portal after pnpm build.

Windows uses the normal Next.js production build; other platforms configure
standalone output. Linux packaging has not been validated. See
docs/40-implementation/40-sample-portal.md for acceptance scope and limitations.

## Engineering delivery

The repository defines the six yucer CI contexts, an empty-bypass ruleset,
secret scanning, manual SCA review, Dependabot, image building and protected
beta/prod delivery workflows. These files have not been run on GitHub.
The container runs as non-root and never initializes the database at startup.
Application credentials and Compose owner configuration use separate files.
Read docs/50-deployment/30-delivery-runbook.md before first delivery.

## Periodic aggregation core (I08, in progress)

domains/aggregation implements calendar windows, exact integer totals,
dependency-aligned traffic/rate calculations, revision/quality selection,
duration-weighted versus sample gauge means, and device state validity.
Interval results have a scoped PostgreSQL store with immutable revisions,
input manifests, expected-head concurrency checks and atomic outbox writes.
The authorized internal facade reads reviewed active capabilities, full-period
mappings, latest facts and latest quality in one PostgreSQL snapshot. It supports
direct counters/ratios, reviewed directional/rate dependency inputs and session
composition. GET /api/aggregates reads authorized single-object revisions;
no production scheduler is enabled. Reviewed source completion/revocation evidence is bound to the exact
input snapshot; stale evidence cannot approve later revisions. Live confirmation
ingestion remains pending. Target and dependency
metric grants/capabilities are all required, with one shared native frequency.
See docs/40-implementation/300-trusted-derived-inputs.md.
Adjacent mappings of one stable subject are planned per native window; service
activation/retirement sets expected coverage. Gaps, overlaps and off-grid
boundaries fail closed. A reviewed whole-object completion ledger binds the exact
mapping set and complete input snapshot. Latest revocations/stale proofs never
fall back to older or single-segment confirmations; missing inputs remain partial.
See docs/40-implementation/310-composite-completion.md.
Device state now has a reviewed heartbeat policy, bounded carry-in, exact state
durations, unknown gaps, object completion proofs and immutable PostgreSQL
revisions. State refresh jobs use the same scoped atomic execution path; state
and interval adapters reject each other's metric semantics. Authorized queries
support state revisions; there is no live device connector yet.
See docs/40-implementation/340-device-state-persistence.md.
Device temperature adds a twelfth planned definition with exact fixed-point
sample or explicitly reviewed duration-weighted summaries, extrema, quality,
whole-object completion and immutable PostgreSQL revisions. Scoped refresh and
GET /api/aggregates support these values; no live source or synthetic map
temperature is claimed. Cross-object authoritative aggregation remains pending.
See docs/40-implementation/390-gauge-persistence.md.
Reviewed mapping, capability and station-service mutations now append old/new
authority evidence atomically, including deletion and exact revision chains.
This journal does not yet dispatch affected refresh jobs or approve sources.
See docs/40-implementation/400-authority-change-evidence.md.

## Cumulative source normalization (I07, in progress)

domains/normalization/counters.ts provides baseline-aware counter differences,
evidence-bound resets/wraps, exact unit conversion and revision/quality handling.
It emits eligible candidates or pending decisions; production quality approval,
connector integration and persistence remain separate service responsibilities.
See docs/40-implementation/90-counter-normalization.md.

## Demo acceptance and release prerequisites

The map demo now covers 1,080 synthetic sites in Shaanxi, six scenarios, exact
rectangle/circle/polygon scopes, operator reconciliation, calendar comparisons,
rankings and station wave evidence. Station and regional HTML exports are drafts.

Run `node scripts/demo-acceptance.mjs --browser` against the local production
preview, with BSMOSS_PLAYWRIGHT_MODULE and BSMOSS_CHROMIUM_PATH pointing to an
installed Playwright module and Chromium. Artifacts stay under artifacts/.
`node scripts/demo-release.mjs <unit-log> <http-log> <types-log> <build-log>`
creates a content-addressed recoverable source snapshot and evidence manifest.
`node scripts/release-preflight.mjs` checks local/GitHub prerequisites without
printing configuration values. Missing prerequisites exit with code 2.
These checks do not publish code, register environments or claim production launch.
See docs/50-deployment/40-live-prerequisites.md for remaining real-source and
deployment inputs. The internal refresh-window planner and durable scoped queue
support bounded leases/retries and a single authorized refresh step with atomic
result/outbox/receipt commits. Authorized bounded batches connect calendar and
trusted revision-impact planning to the queue; candidate IDs are scoped before
claim and facts/head/publication share one repeatable-read transaction. No
production scheduler or background identity is enabled.
See docs/40-implementation/330-authorized-refresh-coordination.md.
Database triggers now capture measurement and quality inserts in the source
transaction. A scoped internal dispatcher derives historical old/new objects,
dependency outputs and state suppression windows from persisted evidence, then
atomically queues jobs with an immutable per-subscription consumption receipt.
Discovery uses pending events rather than a global timestamp/sequence offset.
Capability, mapping and service changes also propagate from immutable authority
history, invalidating exact old revisions when current authority is unavailable.
Registered subscriptions and a production worker remain pending.
See docs/40-implementation/350-input-change-dispatch.md.
Reviewed completion and revocation inserts are also captured transactionally.
They queue only their exact metric/grain/object period, while execution reads
the latest proofs and preserves unknown or missing coverage. Whole-object proofs
can span mapping versions; stale or revoked proofs never revive older approval.
Runtime still cannot approve sources or write completion evidence.
See docs/40-implementation/360-completion-change-dispatch.md.
Input consumption now has append-only bounded retry/backoff, quarantine and
authorized revision-checked reopen with an evidence reference. Failed work
rolls back before failure recording; only the successful dispatch receipt
acknowledges consumption. Discovery skips deferred and quarantined changes.
Planning failures are covered without weakening full historical object scope.
See docs/40-implementation/370-input-dispatch-control.md.
The authenticated GET /api/aggregates endpoint reads one explicit object/period
and optional immutable revision under view permission. Its read-only snapshot
checks current input/authority freshness and flags stale publications; it never
recomputes publication or falls back to synthetic data. Identity and finite
scope are checked again before returning a result. Formal panels, cross-object
summaries and published reports remain pending.
See docs/40-implementation/380-authorized-aggregate-query.md.
Authority generations and their exact revision manifest bind interval, state
and gauge publications, so reverting configuration cannot revive old completion
proofs. Impact planning uses bounded existing facts/publications and does not
enumerate empty province-wide periods. See
docs/40-implementation/410-authority-impact-dispatch.md.
Reviewed persistent periodic partitions now bind a principal, finite scope,
output policy and up to 12 seeds. The internal ID-only scanner atomically
queues closed periods and a replayable receipt, including missing-data seeds,
and rechecks current grants before committing. Configuration remains read-only
to runtime; no production machine identity or daemon is enabled. See
docs/40-implementation/420-registered-periodic-partitions.md.
The same locked configuration now drives registered input discovery, one-step
supervision, direct dispatch and evidence-referenced reopen. Configuration,
historical impact, jobs, invalidations and receipts share one transaction;
backoff/quarantine remain bound to the exact registered revision. Scope changes
outside the registered partition do not reset progress, while any registered
scope loss rolls back the batch. See
docs/40-implementation/430-registered-input-consumption.md.
