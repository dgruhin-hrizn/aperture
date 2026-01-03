# ===================================================================
# Aperture Dockerfile
# Multi-stage build: install deps, build packages, build web, build api
# ===================================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# Copy package files for all workspaces
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/ui/package.json packages/ui/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ===================================================================
# Stage 2: Builder
FROM deps AS builder
WORKDIR /app

# Copy source code
COPY . .

# Build packages in order
RUN pnpm --filter @aperture/core build
RUN pnpm --filter @aperture/ui build
RUN pnpm --filter @aperture/web build
RUN pnpm --filter @aperture/api build

# ===================================================================
# Stage 3: Production dependencies only
FROM node:20-alpine AS prod-deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# ===================================================================
# Stage 4: Runtime
FROM node:20-alpine AS runner
WORKDIR /app

# Install fontconfig for Sharp SVG text rendering (needed for poster overlays)
RUN apk add --no-cache fontconfig

# Add non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 aperture

# Install custom fonts (Oswald Bold for Top Picks posters)
COPY --chown=root:root packages/core/assets/fonts /usr/share/fonts/custom
RUN fc-cache -fv

# Copy production dependencies
COPY --from=prod-deps --chown=aperture:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=aperture:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps --chown=aperture:nodejs /app/packages/core/node_modules ./packages/core/node_modules

# Copy built packages
COPY --from=builder --chown=aperture:nodejs /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=aperture:nodejs /app/packages/core/package.json ./packages/core/

# Copy built API
COPY --from=builder --chown=aperture:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=aperture:nodejs /app/apps/api/package.json ./apps/api/

# Copy built web app
COPY --from=builder --chown=aperture:nodejs /app/apps/web/dist ./apps/web/dist

# Copy migrations
COPY --from=builder --chown=aperture:nodejs /app/db ./db

# Copy workspace config
COPY --from=builder --chown=aperture:nodejs /app/package.json ./
COPY --from=builder --chown=aperture:nodejs /app/pnpm-workspace.yaml ./

# Set user
USER aperture

# Environment
ENV NODE_ENV=production
ENV PORT=3456

# Expose port
EXPOSE 3456

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:3456/health || exit 1

# Start the server
CMD ["node", "apps/api/dist/index.js"]
