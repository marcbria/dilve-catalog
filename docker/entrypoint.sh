#!/bin/bash
set -e

# --- Configuración de variables de entorno ---
export DILVE_USER="${DILVE_USER:-}"
export DILVE_PASS="${DILVE_PASS:-}"
export EDITORIAL_CODE="${EDITORIAL_CODE:-}"
export BATCH_SIZE="${BATCH_SIZE:-128}"
export ACTIVE_STATUS_CODES="${ACTIVE_STATUS_CODES:-04,02,13,18}"
export CRON_SCHEDULE="${CRON_SCHEDULE:-0 2 * * *}"
export TZ="${TZ:-UTC}"
export THEME="${THEME:-default}"

# Establecer zona horaria
ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# --- Generar configuración del tema para el frontend ---
mkdir -p /usr/share/nginx/html/js
cat > /usr/share/nginx/html/js/theme-config.js <<EOF
// Configuración del tema inyectada desde el contenedor
window.THEME = "${THEME}";
EOF

# --- Ensamblar index.html usando Jinja2 ---
python3 <<EOF
import os
import sys
from jinja2 import Environment, FileSystemLoader, TemplateNotFound

theme = "$THEME"
base_dir = "/usr/share/nginx/html/theme"
default_theme = "default"

def get_fragment_content(fragment_name):
    theme_file = os.path.join(base_dir, theme, fragment_name)
    default_file = os.path.join(base_dir, default_theme, fragment_name)
    if os.path.exists(theme_file):
        with open(theme_file, 'r', encoding='utf-8') as f:
            return f.read()
    elif os.path.exists(default_file):
        with open(default_file, 'r', encoding='utf-8') as f:
            return f.read()
    else:
        return ""

# Contexto para la plantilla
context = {
    'HEADER': get_fragment_content('header.html'),
    'FOOTER': get_fragment_content('footer.html'),
    'STYLES': get_fragment_content('styles.css'),
    'HEAD_EXTRA': get_fragment_content('head_extra.html'),
}

# Determinar la plantilla base (layout.j2)
theme_layout = os.path.join(base_dir, theme, "layout.j2")
default_layout = os.path.join(base_dir, default_theme, "layout.j2")
if os.path.exists(theme_layout):
    template_file = theme_layout
else:
    template_file = default_layout

# Usar el directorio de la plantilla para el loader
template_dir = os.path.dirname(template_file)
template_name = os.path.basename(template_file)

env = Environment(
    loader=FileSystemLoader(template_dir),
    autoescape=False,  # contenido HTML ya renderizado
)
try:
    template = env.get_template(template_name)
except TemplateNotFound:
    print(f"Error: No se encontró la plantilla {template_file}")
    sys.exit(1)

# Renderizar y guardar
output = template.render(**context)
output_file = "/usr/share/nginx/html/index.html"
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(output)

print(f"Index.html ensamblado para el tema: {theme}")
EOF

# --- Función para obtener la fecha del último CSV ---
get_last_csv_date() {
    local last_csv=$(ls -1 /data/catalog/*.csv 2>/dev/null | sort -r | head -n1)
    if [ -n "$last_csv" ]; then
        local basename=$(basename "$last_csv" .csv)
        local date_part=${basename%-*}
        if [[ $date_part =~ ^([0-9]{4})([0-9]{2})([0-9]{2})$ ]]; then
            echo "${BASH_REMATCH[1]}-${BASH_REMATCH[2]}-${BASH_REMATCH[3]}"
            return 0
        fi
    fi
    return 1
}

# --- Ejecutar actualización inicial ---
echo "=== Inicializando catálogo ==="
if [ -n "$(ls -1 /data/catalog/*.csv 2>/dev/null)" ]; then
    last_date=$(get_last_csv_date)
    if [ -n "$last_date" ]; then
        echo "Modo incremental: descargando cambios desde $last_date"
        export FROM_DATE="$last_date"
    else
        echo "No se pudo determinar la fecha del último CSV. Se ejecutará modo completo."
        export FROM_DATE=""
    fi
else
    echo "No se encontró ningún CSV previo. Modo completo."
    export FROM_DATE=""
fi

# Ejecutar la descarga (esto creará /data/catalog.csv automáticamente)
cd /app
python3 main.py

# --- Configurar cron ---
echo "Configurando cron con la programación: $CRON_SCHEDULE"
printf "%s root /app/update.sh >> /data/logs/cron.log 2>&1\n" "$CRON_SCHEDULE" > /etc/cron.d/dilve-update
chmod 0644 /etc/cron.d/dilve-update
crontab /etc/cron.d/dilve-update

# Arrancar cron en segundo plano
cron

# Arrancar nginx en primer plano
echo "Iniciando servidor web Nginx..."
nginx -g "daemon off;"
