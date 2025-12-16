#!/bin/bash

# deploy.sh - Script para automatizar el despliegue de Tecnotitlan en el VPS.
# Este script simplifica las actualizaciones al obtener el código más reciente
# y reconstruir los servicios de Docker.

# Salir inmediatamente si un comando falla para evitar un estado inconsistente.
set -e

echo "🚀  Iniciando el despliegue de Tecnotitlan..."

# 1. Obtener los últimos cambios desde el repositorio de Git.
echo "🔄  Actualizando el código desde la rama 'main'..."
git pull origin main

# 2. Reconstruir y reiniciar los contenedores de Docker en segundo plano.
echo "🐳  Reconstruyendo y reiniciando los servicios con Docker Compose..."
sudo docker compose up --build -d

# 3. (Opcional pero recomendado) Limpiar imágenes de Docker no utilizadas para liberar espacio.
echo "🧹  Limpiando imágenes de Docker antiguas..."
sudo docker image prune -f

echo "✅  ¡Despliegue completado con éxito!"