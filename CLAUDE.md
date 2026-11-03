# BS-MOSS working agreement

Use pnpm. Follow the yucer rules/service/store separation and numbered docs
taxonomy. Product code is bsmoss; package scope is @bsmoss. Source and root
metadata are ASCII; Chinese product specifications live under docs/.

This repository started empty. Work on feature branches; do not push main or
release tags directly. No external deployment, registry allocation, OIDC client
registration or platform entitlement catalog has been performed.

Rules are pure. Services enforce platform entitlement then product permission
and workspace scope. Store adapters must enforce tenant isolation and atomic
idempotency. Source evidence is append-only. Use integer counters and integer
money; never mix voice seconds with data bytes. Agent analysis cannot approve
settlements or mutate evidence. No drones, robot dogs or actuator control.

DDL under deploy/database/ddl is the sole schema authority. Apply it only through
a reviewed db-init path; never during application startup. Prisma is a scalar client-generation mirror only; DDL owns constraints. The measurement PostgreSQL adapter is implemented and locally tested; production
identity wiring is implemented, while live registration and deployment remain pending. Do not copy yucer sales tables,
credentials, release history or successful deployment claims into this product.


New-product decision: use an empty-database baseline (00/97/98); no legacy upgrade or data migration is required. Earlier unexecuted increment drafts were replaced.

Portal UI follows yucer's shell composition and the published @vxture/design-system
umbrella. New business views must use its components, theme, fonts and semantic
tokens; do not introduce parallel button/card/table primitives, hardcoded visual
values or global token overrides. Keep consumer providers in a client module.
The existing full-canvas map remains independent. Legacy metrics styles are
scoped to .legacy-metrics and must never leak into the portal.
