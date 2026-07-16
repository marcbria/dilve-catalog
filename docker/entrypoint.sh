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

# --- Función para obtener contenido de un fragmento con fallback ---
get_fragment() {
    local theme_dir="/usr/share/nginx/html/theme/${THEME}"
    local default_dir="/usr/share/nginx/html/theme/default"
    local fragment_name="$1"
    local fragment_file="${theme_dir}/${fragment_name}"
    local default_file="${default_dir}/${fragment_name}"
    if [ -f "$fragment_file" ]; then
        cat "$fragment_file"
    elif [ -f "$default_file" ]; then
        cat "$default_file"
    else
        echo ""
    fi
}

# --- Ensamblar index.html ---
BASE_INDEX="/usr/share/nginx/html/theme/${THEME}/index.html"
DEFAULT_INDEX="/usr/share/nginx/html/theme/default/index.html"
if [ -f "$BASE_INDEX" ]; then
    INDEX_TEMPLATE="$BASE_INDEX"
else
    INDEX_TEMPLATE="$DEFAULT_INDEX"
fi

# Leer fragmentos
HEADER_CONTENT=$(get_fragment "header.html")
FOOTER_CONTENT=$(get_fragment "footer.html")
STYLES_CONTENT=$(get_fragment "styles.css")
HEAD_EXTRA_CONTENT=$(get_fragment "head_extra.html")

# Reemplazar marcadores en la plantilla
# Usamos un delimitador diferente para sed (|) para evitar problemas con /
sed -e "s|{{HEADER}}|$HEADER_CONTENT|g" \
    -e "s|{{FOOTER}}|$FOOTER_CONTENT|g" \
    -e "s|{{STYLES}}|$STYLES_CONTENT|g" \
    -e "s|{{HEAD_EXTRA}}|$HEAD_EXTRA_CONTENT|g" \
    "$INDEX_TEMPLATE" > /usr/share/nginx/html/index.html

echo "Index.html ensamblado para el tema: $THEME"

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
