FROM python:3.12-slim

# ── Dependencias del sistema ────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        nginx \
        cron \
        coreutils \
    && rm -rf /var/lib/apt/lists/*

# ── Directorio de trabajo ───────────────────────────────────────────
WORKDIR /app

# ── Dependencias Python (capa cacheable) ────────────────────────────
# Se copian e instalan los requisitos ANTES que el resto del código,
# para que cambios en extract/ no invaliden esta capa.
# requirements.txt ya incluye jinja2 (usado por generate_thema_dict.py).
COPY extract/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# ── Código de la aplicación ─────────────────────────────────────────
COPY extract/ /app/
COPY public/ /usr/share/nginx/html/
COPY theme/ /usr/share/nginx/html/theme/

# ── Scripts de entrada, actualización y generación de Thema ─────────
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/update.sh /app/update.sh
COPY docker/generate_thema_dict.py /app/docker/generate_thema_dict.py
RUN chmod +x /entrypoint.sh /app/update.sh

# ── Nginx: eliminar config por defecto y añadir la del proyecto ─────
RUN rm -f /etc/nginx/sites-enabled/default
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# ── Directorios de datos persistidos por volumen ────────────────────
RUN mkdir -p /data/catalog /data/covers /data/logs

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
