# --- Fase 1: Construcción (Builder) ---
# Instala dependencias y genera el cliente de Prisma.
FROM node:18-alpine AS builder

WORKDIR /app

# Evita que Puppeteer descargue su propia versión de Chromium.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copia los archivos de definición de paquetes.
COPY package*.json ./

# --- DEBUG: Ver el contenido después de copiar package.json ---
RUN echo "--- Builder Stage: After package.json copy ---" && ls -la

# Instala TODAS las dependencias.
RUN npm install --force
RUN echo "--- Builder Stage: After npm install ---" && ls -la

# CRÍTICO: Copia solo las carpetas y archivos necesarios para la construcción.
# Esto evita el error de dependencia circular al no copiar el contexto de build de Docker.
COPY backend ./backend
RUN echo "--- Builder Stage: After backend copy ---" && ls -la
COPY frontend ./frontend
RUN echo "--- Builder Stage: After frontend copy ---" && ls -la
COPY prisma ./prisma
RUN echo "--- Builder Stage: After prisma copy ---" && ls -la

# --- Fase 2: Ejecución (Runner) ---
# Crea la imagen final y ligera para producción.
FROM node:18-alpine

WORKDIR /app
RUN echo "--- Runner Stage: Before any copy ---" && ls -la

# Instala la versión de Chromium de Alpine Linux, que es mucho más ligera.
RUN apk add --no-cache udev ttf-freefont chromium

# Copia solo los artefactos necesarios desde la fase 'builder'.
COPY --from=builder /app/node_modules ./node_modules
RUN echo "--- Runner Stage: After node_modules copy ---" && ls -la
COPY package*.json ./
RUN echo "--- Runner Stage: After package.json copy ---" && ls -la
COPY backend ./backend
RUN echo "--- Runner Stage: After backend copy ---" && ls -la

EXPOSE 5000

CMD [ "node", "backend/src/index.js" ]