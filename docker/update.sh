#!/bin/bash

if [ -f /etc/environment ]; then
    . /etc/environment
fi

cd /app

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

python main.py
