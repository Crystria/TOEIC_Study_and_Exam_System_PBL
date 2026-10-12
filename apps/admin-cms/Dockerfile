# syntax=docker/dockerfile:1
# Multi-stage build for the Admin CMS (Next.js, standalone output).
# NOTE: build context must be the monorepo root, e.g.
#   docker build -f apps/admin-cms/Dockerfile -t toeic-admin-cms .

# ---- Base ----
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/config-ts/package.json ./packages/config-ts/package.json
COPY apps/admin-cms/package.json ./apps/admin-cms/package.json
RUN npm install --workspace @toeic/admin-cms --include-workspace-root

# ---- Builder ----
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin-cms/node_modules ./apps/admin-cms/node_modules
COPY . .
RUN npm run build --workspace @toeic/admin-cms

# ---- Runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3007
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/admin-cms/public ./apps/admin-cms/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-cms/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-cms/.next/static ./apps/admin-cms/.next/static
USER nextjs
EXPOSE 3007
CMD ["node", "apps/admin-cms/server.js"]
