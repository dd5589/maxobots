FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY data ./data


FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Europe/Moscow
ENV DATA_DIR=/app/runtime

RUN apk add --no-cache tini wget \
    && mkdir -p /app/runtime \
    && chown -R node:node /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/data ./data
COPY package*.json ./

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3   CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/bot/index.js"]
