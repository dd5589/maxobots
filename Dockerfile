FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Europe/Moscow
ENV PORT=10000
ENV DATA_DIR=/app/runtime

RUN apk add --no-cache tini ca-certificates \
  && update-ca-certificates \
  && mkdir -p /app/runtime \
  && chown -R node:node /app

COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY data ./data
COPY package*.json ./
USER node
EXPOSE 10000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/bot/index.js"]
