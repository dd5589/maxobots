FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Europe/Moscow
ENV PORT=80
ENV DATA_DIR=/app/runtime
ENV NODE_EXTRA_CA_CERTS=/app/certs/russian_bundle.crt

RUN apk add --no-cache tini ca-certificates \
  && update-ca-certificates \
  && mkdir -p /app/runtime \
  && chown -R node:node /app

COPY certs ./certs
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY data ./data
COPY package*.json ./

RUN chown -R node:node /app/certs
USER node
EXPOSE 10000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/bot/index.js"]
