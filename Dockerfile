# Laundromat — one image, one process, one port.
#
# The server is the only thing running, and it serves three things from the
# SAME origin:
#
#   /, /assets/*, /join/ABCD   the built React client (Vite output, dist/)
#   /api/rooms/*, /api/health  the lobby REST API
#   /laundromat/*              boardgame.io's SocketIO transport
#
# That single origin is why there is no CORS configuration anywhere in this
# project. Split the client onto a CDN and you inherit a CORS problem and a
# WebSocket-origin problem in the same afternoon. See DEPLOY.md.
#
# Two stages: `build` has the full toolchain and the source; `runtime` gets the
# two output directories and production dependencies, nothing else.

# ---- build ----------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# The build context is the REPOSITORY ROOT, not web/, because this file sits at
# the root — Docker only reads the .dockerignore at the context root, so the two
# have to live together. Every source path below is therefore `web/`-prefixed.
#
# Manifests first, so `npm ci` stays cached when only source changes.
COPY web/package.json web/package-lock.json ./
RUN npm ci

# web/ becomes /app, so the layout inside the image is what the scripts expect.
# The root .dockerignore trims this to source + config; note that it must NOT
# exclude web/tools/, because build:server IS `node tools/build-server.mjs` and
# the image build dies with MODULE_NOT_FOUND without it — while the client build
# still succeeds, so the error reads like a server problem when it is a
# build-context problem.
COPY web/ ./

# `npm run build` is `tsc -b && vite build`. The typecheck is deliberately part
# of the build: a type error must not be able to reach a deploy.
RUN npm run build

# esbuild -> server-dist/index.cjs. COMMONJS, and that is load-bearing rather
# than stylistic: boardgame.io/server is a bare directory with a `main` field
# and no `exports` map, which Node's ESM resolver refuses outright
# (ERR_UNSUPPORTED_DIR_IMPORT). An ESM bundle builds cleanly and then dies on
# its first line at run time.
RUN npm run build:server

# ---- runtime --------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

# Set before `npm ci` so the install itself runs in production mode.
ENV NODE_ENV=production

# Production dependencies only: no vite, no vitest, no typescript.
COPY web/package.json web/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Only the two build outputs cross the stage boundary. Source, tests, tools and
# the toolchain all stay behind.
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server-dist ./server-dist

# Never run as root. The node image ships this user; it owns nothing it does
# not need, and the server writes no files.
USER node

# Every platform injects its own PORT (Fly sets 8080 via fly.toml, Render and
# Heroku assign one), and server/index.ts reads it. This is only the fallback
# for a plain `docker run`.
ENV PORT=8000
EXPOSE 8000

# The same endpoint the platforms poll. `fetch` is global on Node 20, so this
# needs no dependency and no shell.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form: node receives signals directly, so a platform stopping the machine
# gets a clean exit rather than a ten-second SIGKILL wait.
CMD ["node", "server-dist/index.cjs"]
