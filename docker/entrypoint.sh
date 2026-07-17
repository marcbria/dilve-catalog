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
export LOGO="${LOGO:-}"
export BASE_PATH="${BASE_PATH:-/}"
export ORGANIZATION="${ORGANIZATION:-Universitat Autònoma de Barcelona}"

# Establecer zona horaria
ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# --- Obtener fecha de build ---
BUILD_DATE=$(date +"%Y-%m-%d %H:%M:%S %Z")

# --- Generar configuración del tema para el frontend ---
mkdir -p /usr/share/nginx/html/js
cat > /usr/share/nginx/html/js/theme-config.js <<EOF
// Configuración del tema inyectada desde el contenedor
window.THEME = "${THEME}";
EOF

# --- Ensamblar index.html usando Jinja2 con herencia ---
python3 <<EOF
import os
import sys
from jinja2 import Environment, FileSystemLoader, ChoiceLoader
from datetime import datetime

print("=== Iniciando ensamblado de index.html ===", flush=True)

theme = "$THEME"
base_dir = "/usr/share/nginx/html/theme"
default_theme = "default"
logo_env = os.environ.get("LOGO", "")
base_path = os.environ.get("BASE_PATH", "/")
organization = os.environ.get("ORGANIZATION", "Universitat Autònoma de Barcelona")
build_date = "$BUILD_DATE"

print(f"Tema: {theme}", flush=True)
print(f"LOGO: {logo_env}", flush=True)
print(f"BASE_PATH: {base_path}", flush=True)
print(f"ORGANIZATION: {organization}", flush=True)

def get_fragment_content(fragment_name):
    """Lee el contenido de un fragmento (header, footer, styles, head_extra)."""
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

# Determinar la URL del logo o generar un SVG
logo_html = ""
if logo_env:
    # Si se definió LOGO, usarlo como imagen
    if logo_env.startswith(('http://', 'https://')):
        logo_url = logo_env
        logo_html = f'<img src="{logo_url}" alt="Logo" />'
    else:
        # Buscar en el tema activo y luego en default
        logo_path = os.path.join(base_dir, theme, "img", logo_env)
        if os.path.exists(logo_path):
            base = base_path.rstrip('/')
            logo_url = f"{base}/theme/{theme}/img/{logo_env}"
            logo_html = f'<img src="{logo_url}" alt="Logo" />'
            print(f"Logo encontrado en: {logo_path}", flush=True)
        else:
            logo_path_default = os.path.join(base_dir, default_theme, "img", logo_env)
            if os.path.exists(logo_path_default):
                base = base_path.rstrip('/')
                logo_url = f"{base}/theme/{default_theme}/img/{logo_env}"
                logo_html = f'<img src="{logo_url}" alt="Logo" />'
                print(f"Logo encontrado en default: {logo_path_default}", flush=True)
            else:
                print(f"Advertencia: Logo '{logo_env}' no encontrado. Se generará SVG.", flush=True)
                logo_html = ""
else:
    # Generar SVG con el nombre de la organización
    # Escapar caracteres especiales para SVG
    safe_org = organization.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    logo_html = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 80" width="400" height="80" style="max-height:52px; height:auto; width:auto;">
        <rect width="400" height="80" fill="#ffffff" rx="4"/>
        <text x="20" y="50" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#007e11">{safe_org}</text>
    </svg>'''
    print("Logo SVG generado automáticamente", flush=True)

# Contexto con fragmentos
context = {
    'HEADER': get_fragment_content('header.html'),
    'FOOTER': get_fragment_content('footer.html'),
    'STYLES': get_fragment_content('styles.css'),
    'HEAD_EXTRA': get_fragment_content('head_extra.html'),
    'LOGO_HTML': logo_html,
    'BASE_PATH': base_path,
    'ORGANIZATION': organization,
    'BUILD_DATE': build_date,
}

# Configurar el loader para buscar en el tema activo y luego en default
theme_dir = os.path.join(base_dir, theme)
default_dir = os.path.join(base_dir, default_theme)

loader = ChoiceLoader([
    FileSystemLoader(theme_dir),
    FileSystemLoader(default_dir),
])

env = Environment(
    loader=loader,
    autoescape=False,
)

# Determinar qué plantilla usar
template_name = "index.html.j2"
try:
    template = env.get_template(template_name)
    print(f"Usando plantilla: {template_name} (tema o default)", flush=True)
except Exception as e:
    print(f"No se encontró {template_name}, usando layout.j2: {e}", flush=True)
    template = env.get_template("layout.j2")

# Renderizar
output = template.render(**context)

# Guardar en la ubicación final
output_file = "/usr/share/nginx/html/index.html"
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(output)

print(f"Index.html ensamblado correctamente en {output_file}", flush=True)

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
