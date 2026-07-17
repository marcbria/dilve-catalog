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

# Establecer zona horaria
ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

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

print("=== Iniciando ensamblado de index.html ===", flush=True)

theme = "$THEME"
base_dir = "/usr/share/nginx/html/theme"
default_theme = "default"
logo_env = os.environ.get("LOGO", "")
base_path = os.environ.get("BASE_PATH", "/")

print(f"Tema: {theme}", flush=True)
print(f"LOGO: {logo_env}", flush=True)
print(f"BASE_PATH: {base_path}", flush=True)

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

# Determinar la URL del logo
logo_url = ""
if logo_env:
    if logo_env.startswith(('http://', 'https://')):
        logo_url = logo_env
    else:
        # Buscar en el tema activo y luego en default
        logo_path = os.path.join(base_dir, theme, "img", logo_env)
        if os.path.exists(logo_path):
            # Construir URL con BASE_PATH
            base = base_path.rstrip('/')
            logo_url = f"{base}/theme/{theme}/img/{logo_env}"
            print(f"Logo encontrado en: {logo_path}", flush=True)
        else:
            logo_path_default = os.path.join(base_dir, default_theme, "img", logo_env)
            if os.path.exists(logo_path_default):
                base = base_path.rstrip('/')
                logo_url = f"{base}/theme/{default_theme}/img/{logo_env}"
                print(f"Logo encontrado en default: {logo_path_default}", flush=True)
            else:
                print(f"Advertencia: Logo '{logo_env}' no encontrado en theme/{theme}/img/ ni en theme/{default_theme}/img/", flush=True)
                logo_url = ""
else:
    # Logo por defecto (URL externa)
    logo_url = "https://publicacions.uab.cat/sites/default/files/styles/d03/public/2024-02/logoservei-publicacions-v6-horitz-2lin-gran-negre_0.webp"
    print(f"Usando logo por defecto: {logo_url}", flush=True)

print(f"Logo URL final: {logo_url}", flush=True)

logo_html = f'<img src="{logo_url}" alt="Logo" />'

# Contexto con fragmentos
context = {
    'HEADER': get_fragment_content('header.html'),
    'FOOTER': get_fragment_content('footer.html'),
    'STYLES': get_fragment_content('styles.css'),
    'HEAD_EXTRA': get_fragment_content('head_extra.html'),
    'LOGO_URL': logo_url,
    'LOGO_HTML': logo_html,
    'BASE_PATH': base_path,
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

# Mostrar primeras líneas para depuración
lines = output.split('\n')[:15]
print("Primeras 15 líneas del index.html generado:", flush=True)
for line in lines:
    print(line, flush=True)
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
