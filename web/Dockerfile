# Laundromat — one image, one process, one port.
#
# The server serves three things from the SAME origin:
#   /                 the built React client (Vite output in dist/)
#   /api/rooms/*      the lobby REST API
#   /socket.io/*      boardgame.io's SocketIO transport
#
# That is the whole reason there is no CORS configuration anywhere in this
# project. Split the client onto a CDN and you inherit a CORS problem and a
# WebSocket-origin problem; keep them together and there is nothing to do.

# ---- build ----------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Copy manifests first so `npm ci` is cached across source-only changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# `npm run build` is `tsc -b && vite build` — the typecheck is part of the
# build on purpose, so a type error cannot reach a deploy.
RUN npm run build && npm run build:server

# ---- runtime --------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies only: no vite, no vitest, no typescript.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/server-dist ./server-dist

# Never run as root.
USER node

# Overridden by the platform (Fly, Render, Heroku all inject PORT).
ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server-dist/index.cjs"]
