# --- Etapa 1: Dependencias (deps) ---
# Esta etapa solo instala las dependencias. Se cachea y solo se reconstruye
# si `package.json` o `prisma/schema.prisma` cambian.
FROM node:18-slim AS deps

WORKDIR /app

# Evita que Puppeteer descargue su propia versión de Chromium.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copia los archivos de dependencias y el esquema de Prisma.
COPY package*.json ./
COPY backend/prisma ./prisma/

# Instala TODAS las dependencias.
RUN npm install --force

# --- Etapa 2: Código Fuente (builder) ---
# Esta etapa copia el código fuente. Se reconstruirá si el código cambia,
# pero no reinstalará los node_modules gracias a la etapa anterior.
FROM node:18-slim AS builder

WORKDIR /app

# Copia las dependencias ya instaladas desde la etapa 'deps'.
COPY --from=deps /app/node_modules ./node_modules

# Copia el resto del código fuente.
COPY . .

# --- Etapa 3: Ejecución (final) ---
# Esta es la imagen final, optimizada y ligera para producción.
FROM node:18-slim AS final

WORKDIR /app

# Instala las dependencias de sistema necesarias para Puppeteer/whatsapp-web.js en Debian.
# Debian (en la que se basa 'slim') ya incluye las librerías OpenSSL que Prisma necesita.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Copia solo los artefactos necesarios desde la fase 'builder'.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend ./backend

EXPOSE 5000

CMD [ "node", "backend/src/index.js" ]