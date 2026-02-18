# === Stage 1: Dependencies ===
FROM node:20-alpine AS deps
WORKDIR /app

# Skip Puppeteer's bundled Chromium download
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package.json package-lock.json* ./
RUN npm ci

# === Stage 2: Build ===
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args for Next.js public env vars (needed at build time)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN npm run build

# === Stage 3: Production ===
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install Chromium and dependencies for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer where Chromium is
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy puppeteer node_modules (not traced by standalone)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/puppeteer ./node_modules/puppeteer
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/puppeteer-core ./node_modules/puppeteer-core
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/chromium-bidi ./node_modules/chromium-bidi
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@puppeteer ./node_modules/@puppeteer

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
