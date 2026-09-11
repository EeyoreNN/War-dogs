# syntax=docker/dockerfile:1
# Relay image (§7.7): build with tsc, ship server/dist plus the two runtime packages (ws, zod).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY server ./server
COPY src ./src
RUN npm run build:relay

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production RELAY_PORT=8787
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/node_modules/ws ./node_modules/ws
COPY --from=build /app/node_modules/zod ./node_modules/zod
COPY package.json ./
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "server/dist/server/relay.js"]
