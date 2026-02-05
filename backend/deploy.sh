#!/bin/bash

# deploy.sh - Script para automatizar el despliegue de Tecnotitlan en cPanel.
# Este script actualiza el código y reinicia la aplicación Node.js.

# Salir inmediatamente si un comando falla para evitar un estado inconsistente.
set -e

# Configuración crítica para estabilidad en cPanel: Usar motor binario
export PRISMA_CLIENT_ENGINE_TYPE=binary

echo "🚀  Iniciando el despliegue de Tecnotitlan en cPanel..."

# 1. Obtener los últimos cambios desde el repositorio de Git.
echo "🚫  Saltando actualización de Git (Modo Desarrollo en Vivo)..."

# 2. Instalar dependencias (si hubo cambios en package.json)
echo "📦  Instalando dependencias..."
npm install --production

# 2.2. Generar cliente de Prisma (Manual para evitar crash en postinstall)
echo "💎  Generando cliente de Prisma..."
# Usamos npx para que encuentre el ejecutable de prisma automáticamente
npx prisma generate

# 3. Reiniciar la aplicación Node.js (Phusion Passenger)
echo "🔄  Reiniciando servidor..."
mkdir -p tmp
touch tmp/restart.txt

echo "✅  ¡Despliegue completado con éxito!"