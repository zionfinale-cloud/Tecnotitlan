# --- Etapa 1: Dependencias (deps) ---
# Esta etapa solo instala las dependencias. Se cachea y solo se reconstruye
# si `package.json` o `prisma/schema.prisma` cambian.
FROM node:18-alpine AS deps

WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copia los archivos de dependencias y el esquema de Prisma.
COPY package*.json ./
COPY backend/prisma ./prisma/

# Instala solo las dependencias de producción y genera el cliente de Prisma.
RUN npm install --force

# --- Etapa 2: Código Fuente (builder) ---
# Esta etapa copia el código fuente. Se reconstruirá si el código cambia,
# pero no reinstalará los node_modules gracias a la etapa anterior.
FROM node:18-alpine AS builder

WORKDIR /app

# Copia las dependencias ya instaladas desde la etapa 'deps'.
COPY --from=deps /app/node_modules ./node_modules

# Copia el resto del código fuente.
COPY . .

# --- Etapa 3: Ejecución (final) ---
# Esta es la imagen final, optimizada y ligera para producción.
FROM node:18-alpine AS final

WORKDIR /app

# Instala Chromium, necesario para `whatsapp-web.js`.
RUN apk add --no-cache udev ttf-freefont chromium

# Copia selectivamente los artefactos necesarios desde la etapa 'builder'
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/backend ./backend

EXPOSE 5000

CMD [ "node", "backend/src/index.js" ]