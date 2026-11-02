# syntax=docker/dockerfile:1.7
# Build context is the repository root; credentials use BuildKit secrets only.
FROM node:22-alpine AS builder
WORKDIR /repo
RUN corepack enable
COPY . .
RUN --mount=type=secret,id=node_auth_token,required=true \
    NODE_AUTH_TOKEN="$(cat /run/secrets/node_auth_token)" pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ARG APP_VERSION=dev
ARG GIT_SHA=unknown
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 APP_VERSION=${APP_VERSION} GIT_SHA=${GIT_SHA}
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /repo/portals/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/portals/app/.next/static ./portals/app/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/portals/app/public ./portals/app/public
USER nextjs
EXPOSE 3000
CMD ["node", "portals/app/server.js"]
