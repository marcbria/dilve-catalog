#!/bin/bash
# run.sh - Script de arranque y actualización del catálogo

show_help() {
    cat <<EOF
Uso: ./run.sh <comando> [opciones]

Comandos:
  dev               - Arranca el entorno de desarrollo (compose.yml)
  prod              - Arranca el entorno de producción (compose.yml + compose.traefik.yml)
  update [opciones] - Ejecuta la actualización del catálogo dentro del contenedor
  help              - Muestra esta ayuda

Opciones para 'update':
  --metadata        - Actualiza solo los metadatos (sin cubiertas)
  --covers          - Actualiza solo las cubiertas (sin metadatos)
  --from-date DATE  - Actualización incremental desde DATE (formato YYYY-MM-DD)
  --all             - Fuerza actualización completa (modo completo)
  --env ENV         - Entorno a usar: dev (por defecto) o prod

Si no se especifica --metadata ni --covers, se actualizan ambos.
Si no se especifica --from-date ni --all, se usa la fecha del último CSV.

Ejemplos:
  ./run.sh dev
  ./run.sh prod
  ./run.sh update --metadata --from-date 2026-01-01
  ./run.sh update --covers --all --env prod
  ./run.sh update --from-date 2026-01-01   (metadatos + cubiertas)
EOF
}

# Determinar el comando principal
CMD="$1"
shift

# Variables para update
UPDATE_METADATA=""
UPDATE_COVERS=""
FROM_DATE=""
FORCE_ALL=""
ENV="dev"

# Parsear opciones de update
while [[ $# -gt 0 ]]; do
    case "$1" in
        --metadata)
            UPDATE_METADATA="--update-metadata"
            shift
            ;;
        --covers)
            UPDATE_COVERS="--update-covers"
            shift
            ;;
        --from-date)
            FROM_DATE="$2"
            shift 2
            ;;
        --all)
            FORCE_ALL="--from-date all"
            shift
            ;;
        --env)
            ENV="$2"
            shift 2
            ;;
        *)
            echo "Opcion desconocida: $1"
            show_help
            exit 1
            ;;
    esac
done

# Función para obtener los archivos compose según entorno
get_compose_files() {
    local env="$1"
    if [ "$env" = "prod" ]; then
        echo "-f compose.yml -f compose.traefik.yml"
    else
        echo "-f compose.yml"
    fi
}

# Función para asegurar que el contenedor está corriendo
ensure_running() {
    local env="$1"
    local compose_files=$(get_compose_files "$env")
    # Comprobar si el contenedor está en ejecución
    if ! docker compose $compose_files ps --format json | grep -q '"State":"running"'; then
        echo "El contenedor no esta corriendo. Levantando entorno $env..."
        docker compose $compose_files up -d --build
        if [ $? -ne 0 ]; then
            echo "Error al levantar el contenedor."
            exit 1
        fi
        # Esperar unos segundos para que el contenedor esté listo
        sleep 5
        echo "Contenedor levantado."
    fi
}

# Función para actualizar el enlace simbólico al último CSV
update_symlink() {
    local env="$1"
    local compose_files=$(get_compose_files "$env")
    echo "Actualizando enlace simbólico /data/catalog.csv..."
    docker compose $compose_files exec -T app bash -c '
        LATEST_CSV=$(find /data/catalog -maxdepth 1 -type f -name "*.csv" 2>/dev/null | sort | tail -1)
        if [ -n "$LATEST_CSV" ]; then
            ln -sf "$LATEST_CSV" /data/catalog.csv
            echo "Enlace actualizado: /data/catalog.csv -> $LATEST_CSV"
        else
            echo "ADVERTENCIA: No se encontró ningún CSV en /data/catalog"
        fi
    '
}

case "$CMD" in
    dev)
        echo "Arrancando entorno de desarrollo..."
        docker compose down
        docker compose up -d --build
        echo "Mostrando logs (Ctrl+C para salir sin detener)..."
        docker compose logs -f
        ;;
    prod)
        echo "Arrancando entorno de produccion (con Traefik)..."
        docker compose -f compose.yml -f compose.traefik.yml down
        docker compose -f compose.yml -f compose.traefik.yml up -d --build
        echo "Mostrando logs (Ctrl+C para salir sin detener)..."
        docker compose -f compose.yml -f compose.traefik.yml logs -f
        ;;
    update)
        # Asegurar que el contenedor está en ejecución
        ensure_running "$ENV"

        # Construir los argumentos para main.py
        ARGS=""
        if [ -n "$UPDATE_METADATA" ]; then
            ARGS="$ARGS $UPDATE_METADATA"
        fi
        if [ -n "$UPDATE_COVERS" ]; then
            ARGS="$ARGS $UPDATE_COVERS"
        fi
        # Si no se especificó ni metadata ni covers, ejecutar ambos (por defecto sin flags)
        if [ -z "$UPDATE_METADATA" ] && [ -z "$UPDATE_COVERS" ]; then
            ARGS=""  # main.py sin flags hace ambos
        fi
        # Fecha
        if [ -n "$FORCE_ALL" ]; then
            ARGS="$ARGS $FORCE_ALL"
        elif [ -n "$FROM_DATE" ]; then
            ARGS="$ARGS --from-date $FROM_DATE"
        fi

        compose_files=$(get_compose_files "$ENV")
        echo "Ejecutando actualización en entorno $ENV..."
        echo "Comando: docker compose $compose_files exec app python3 main.py $ARGS"
        
        # Ejecutar main.py dentro del contenedor
        if ! docker compose $compose_files exec app python3 main.py $ARGS; then
            echo "ERROR: falló la ejecución de main.py"
            exit 1
        fi

        # Actualizar el enlace simbólico después de la ejecución
        update_symlink "$ENV"

        # Mostrar logs recientes del contenedor (opcional)
        echo "Mostrando logs recientes del contenedor:"
        docker compose $compose_files logs --tail=20 app
        ;;
    help|"")
        show_help
        ;;
    *)
        echo "Comando desconocido: $CMD"
        show_help
        exit 1
        ;;
esac
