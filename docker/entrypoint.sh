#!/bin/bash
set -e

export DILVE_USER="${DILVE_USER:-}"
export DILVE_PASS="${DILVE_PASS:-}"
export EDITORIAL_CODE="${EDITORIAL_CODE:-}"
export BATCH_SIZE="${BATCH_SIZE:-128}"
export ACTIVE_STATUS_CODES="${ACTIVE_STATUS_CODES:-04,02,13,18}"
export CRON_SCHEDULE="${CRON_SCHEDULE:-0 2 * * *}"
export TZ="${TZ:-UTC}"
export BASE_PATH="${BASE_PATH:-/}"

ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Sustituir el placeholder {{BASE_PATH}} en el index.html
sed -i "s|{{BASE_PATH}}|$BASE_PATH|g" /usr/share/nginx/html/index.html

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

# Ejecutar main.py en segundo plano para no bloquear Nginx
cd /app
python main.py >> /data/logs/startup.log 2>&1 &

echo "Configurando cron con la programación: $CRON_SCHEDULE"
echo "$CRON_SCHEDULE root /app/update.sh >> /data/logs/cron.log 2>&1" > /etc/cron.d/dilve-update
chmod 0644 /etc/cron.d/dilve-update
crontab /etc/cron.d/dilve-update

# Iniciar cron en segundo plano
cron &

# Iniciar Nginx en primer plano (mantiene el contenedor vivo)
echo "Iniciando Nginx..."
nginx -g "daemon off;"
