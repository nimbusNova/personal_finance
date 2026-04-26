# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
# Build tools required to compile better-sqlite3 (native module)
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json ./
RUN npm install

# ── Stage 2: Build Next.js app ────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN node_modules/.bin/next build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.cjs ./next.config.cjs

RUN mkdir -p /app/data/pdfs /app/data/exports /app/data/logs && \
    chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
