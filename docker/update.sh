#!/bin/bash
# Script ejecutado por cron para actualizar el catálogo

# Cargar variables de entorno guardadas por entrypoint.sh
if [ -f /etc/dilve-env ]; then
    . /etc/dilve-env
fi

# Asegurar PATH para que encuentre python3
export PATH="/usr/local/bin:/usr/bin:/bin"
export PYTHONUNBUFFERED=1

# Cargar variables de entorno (fallback si no se cargó desde /etc/dilve-env)
if [ -f /etc/environment ]; then
    . /etc/environment
fi

cd /app

# Obtener fecha del último CSV
LAST_CSV=$(ls -1 /data/catalog/*.csv 2>/dev/null | sort -r | head -n1)
if [ -n "$LAST_CSV" ]; then
    basename=$(basename "$LAST_CSV" .csv)
    date_part=${basename%-*}
    if [[ $date_part =~ ^([0-9]{4})([0-9]{2})([0-9]{2})$ ]]; then
        FROM_DATE="${BASH_REMATCH[1]}-${BASH_REMATCH[2]}-${BASH_REMATCH[3]}"
        export FROM_DATE
        echo "Actualización incremental desde $FROM_DATE"
    else
        export FROM_DATE=""
        echo "No se pudo extraer fecha. Se ejecutará modo completo."
    fi
else
    export FROM_DATE=""
    echo "No hay CSV previo. Modo completo."
fi

# Ejecutar extracción (creará /data/catalog.csv automáticamente)
python3 main.py

# Mostrar el último log generado para dar contexto (opcional)
# echo "Log detallado guardado en: $(ls -1t /data/logs/*.log | head -1)"
