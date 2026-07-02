FROM node:20-slim AS deps

WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev \
    && npx prisma generate

FROM node:20-slim AS final

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma/
COPY src ./src/

EXPOSE 5000

CMD ["node", "src/index.js"]
