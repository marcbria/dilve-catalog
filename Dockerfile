FROM python:3.12-slim

# Instalar nginx, cron, coreutils y jinja2
RUN apt-get update && apt-get install -y \
    nginx \
    cron \
    coreutils \
    && rm -rf /var/lib/apt/lists/*

# Instalar Jinja2
RUN pip install --no-cache-dir jinja2

# Eliminar configuración por defecto de Nginx
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

# Copiar script de generación de diccionario Thema
COPY docker/generate_thema_dict.py /app/docker/generate_thema_dict.py

# Instalar dependencias Python de la extracción
RUN pip install --no-cache-dir -r /app/requirements.txt

# Crear directorios de datos (volumen)
RUN mkdir -p /data/catalog /data/covers /data/logs

# Configurar Nginx
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
