#!/bin/bash
# Script ejecutado por cron para actualizar el catálogo

# Definir colores ANSI
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Cargar variables de entorno guardadas por entrypoint.sh
if [ -f /etc/dilve-env ]; then
    . /etc/dilve-env
fi

# Asegurar PATH para que encuentre python3
export PATH="/usr/local/bin:/usr/bin:/bin"
export PYTHONUNBUFFERED=1

# Activar modo silencioso para el logger
export LOG_QUIET=1

cd /app

# Mostrar mensaje de inicio
echo -n "[$(date +'%Y-%m-%d %H:%M:%S')] Actualizando catálogo... "

# Ejecutar main.py silenciosamente (su salida va al archivo de log, no a stdout)
python3 main.py > /dev/null 2>&1
EXIT_CODE=$?

# Obtener el archivo de log más reciente
LATEST_LOG=$(ls -1 /data/logs/*.log 2>/dev/null | sort -r | head -1)

if [ $EXIT_CODE -eq 0 ]; then
    if [ -n "$LATEST_LOG" ]; then
        ACTUALIZACIONES=$(grep "Actualizaciones:" "$LATEST_LOG" | tail -1 | sed 's/.*: //')
        CATALOGO=$(grep "Catálogo actual:" "$LATEST_LOG" | tail -1 | sed 's/.*: //')
        CUBIERTAS_DILVE=$(grep "Cubiertas descargadas de DILVE:" "$LATEST_LOG" | tail -1 | sed 's/.*: //')
        CUBIERTAS_EXTERNAS=$(grep "Cubiertas descargadas de URLs externas:" "$LATEST_LOG" | tail -1 | sed 's/.*: //')
        ERRORES=$(grep "Libros con errores:" "$LATEST_LOG" | tail -1 | sed 's/.*: //')
        
        CUBIERTAS=$((CUBIERTAS_DILVE + CUBIERTAS_EXTERNAS))
        
        echo -e "${GREEN}✅ OK${NC} (catalogo: $CATALOGO, metadatos: $ACTUALIZACIONES, cubiertas: $CUBIERTAS, errores: $ERRORES)"
    else
        echo -e "${GREEN}✅ OK${NC}"
    fi
else
    if [ -n "$LATEST_LOG" ]; then
        echo -e "${RED}❌ ERROR (código $EXIT_CODE). Revisa el log detallado en: $LATEST_LOG${NC}" >&2
    else
        echo -e "${RED}❌ ERROR (código $EXIT_CODE). No se generó log detallado.${NC}" >&2
    fi
fi

# Actualizar el enlace simbólico al último CSV (por si main.py no lo hizo)
LATEST_CSV=$(find /data/catalog -maxdepth 1 -type f -name "*.csv" 2>/dev/null | sort | tail -1)
if [ -n "$LATEST_CSV" ]; then
    ln -sf "$LATEST_CSV" /data/catalog.csv
fi

# Salir con el código de retorno de main.py
exit $EXIT_CODE
