FROM python:3.12-slim

# Instalar nginx, cron y otras utilidades
RUN apt-get update && apt-get install -y \
    nginx \
    cron \
    && rm -rf /var/lib/apt/lists/*

# Eliminar la configuración por defecto de Nginx
RUN rm -f /etc/nginx/sites-enabled/default

# Configurar directorios
WORKDIR /app

# Copiar código de extracción
COPY extract/ /app/
COPY public/ /usr/share/nginx/html/
COPY theme/ /usr/share/nginx/html/theme/

# Copiar scripts de entrada y actualización
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/update.sh /app/update.sh
RUN chmod +x /entrypoint.sh /app/update.sh

# Instalar dependencias Python
RUN pip install --no-cache-dir -r /app/requirements.txt

# Crear directorios de datos (volumen)
RUN mkdir -p /data/catalog /data/covers /data/logs

# Configurar Nginx
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
