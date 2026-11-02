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

Implemented: versioned metric and view rules, a 30-table empty-database baseline,
the transactional PostgreSQL measurement adapter, and an explicitly gated sample
portal. The internal trusted-access resolver and measurement facade are tested;
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
The sample portal implements configurable display for the first 11 metric
definitions. The authenticated evidence API is /api/measurements; live source
adapters, aggregate reports and their production validation remain pending.

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
separate /product-preview/metrics portal retains the first 11 metric definitions
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
composition; no aggregate route or scheduler
is enabled. Reviewed source completion/revocation evidence is bound to the exact
input snapshot; stale evidence cannot approve later revisions. Live confirmation
ingestion and gauge/state persistence remain pending. Target and dependency
metric grants/capabilities are all required, with one shared native frequency.
See docs/40-implementation/300-trusted-derived-inputs.md.
Adjacent mappings of one stable subject are planned per native window; service
activation/retirement sets expected coverage. Gaps, overlaps and off-grid
boundaries fail closed. A reviewed whole-object completion ledger binds the exact
mapping set and complete input snapshot. Latest revocations/stale proofs never
fall back to older or single-segment confirmations; missing inputs remain partial.
See docs/40-implementation/310-composite-completion.md.

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
result/outbox/receipt commits. No production scheduler, background identity or
source revision dispatcher is enabled. See
docs/40-implementation/320-durable-refresh-queue.md.
