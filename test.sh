#!/bin/bash
# =====================================================================
# BATERÍA DE PRUEBAS PARA api_dilve.py (fecha dinámica: 1 mes atrás)
# =====================================================================
# Requisitos: contenedor en ejecución (docker compose up -d)
# =====================================================================

# ─── Constantes ──────────────────────────────────────────────────────
CONTAINER_NAME="catalog"
COVERS_PATH="/data/covers"
API_SCRIPT="/app/api_dilve.py"

# ─── Colores ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'
BOLD='\033[1m'

PASS=0
FAIL=0
WARN=0

# ─── Fecha dinámica (un mes atrás) ─────────────────────────────────
if date -d "1 month ago" +%Y-%m-%d >/dev/null 2>&1; then
    ONE_MONTH_AGO=$(date -d "1 month ago" +%Y-%m-%d)
elif date -v-1m +%Y-%m-%d >/dev/null 2>&1; then
    ONE_MONTH_AGO=$(date -v-1m +%Y-%m-%d)
else
    ONE_MONTH_AGO=$(date -d "30 days ago" +%Y-%m-%d 2>/dev/null || echo "2026-01-01")
fi
echo "Fecha de referencia (1 mes atrás): $ONE_MONTH_AGO"
echo ""

# ─── Función para imprimir resultado ──────────────────────────────
test_result() {
    local name="$1"
    local status="$2"
    local msg="$3"
    if [ "$status" == "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC} $name: $msg"
        ((PASS++))
    elif [ "$status" == "WARN" ]; then
        echo -e "${YELLOW}⚠️ WARN${NC} $name: $msg"
        ((WARN++))
    else
        echo -e "${RED}❌ FAIL${NC} $name: $msg"
        ((FAIL++))
    fi
}

# ─── Obtener imágenes reales del último CSV ──────────────────────
get_real_images() {
    local count=${1:-3}
    local last_csv=$(ls -1 data/catalog/*.csv 2>/dev/null | tail -1)
    [ -z "$last_csv" ] && return 1
    python3 -c "
import csv, sys
with open('$last_csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    images = []
    for row in reader:
        img = row.get('imagen_cubierta', '').strip()
        if img:
            images.append(img)
            if len(images) >= $count:
                break
    print('\n'.join(images))
" 2>/dev/null
}

# ─── Preparación ──────────────────────────────────────────────────
echo "=== Preparando batería de pruebas ==="
LATEST_CSV=$(ls -1 data/catalog/*.csv 2>/dev/null | tail -1)
if [ -z "$LATEST_CSV" ]; then
    echo "ERROR: No hay ningún CSV. Ejecuta primero:"
    echo "docker compose exec $CONTAINER_NAME python $API_SCRIPT --from-date all"
    exit 1
fi
echo "CSV encontrado: $(basename "$LATEST_CSV")"

IMAGES=($(get_real_images 4))
if [ ${#IMAGES[@]} -lt 1 ]; then
    echo "No se encontraron imágenes en el CSV. Las pruebas de descarga se omitirán."
else
    echo "Imágenes disponibles:"
    for img in "${IMAGES[@]}"; do echo "   - $img"; done
fi
echo ""

# ─── Asignar imágenes ──────────────────────────────────────────────
TEST_IMAGE_1="${IMAGES[0]:-}"
TEST_IMAGE_2_1="${IMAGES[0]:-}"
TEST_IMAGE_2_2="${IMAGES[1]:-}"
TEST_IMAGE_2_3="${IMAGES[2]:-}"
TEST_IMAGE_3="${IMAGES[1]:-}"
TEST_IMAGE_5="${IMAGES[2]:-}"
TEST_IMAGE_6="${IMAGES[3]:-}"
TEST_IMAGE_7_1="${IMAGES[0]:-}"
TEST_IMAGE_7_2="${IMAGES[1]:-}"
TEST_IMAGE_7_3="${IMAGES[2]:-}"

# ─── Inicio de pruebas ──────────────────────────────────────────────
echo "=== INICIANDO BATERÍA DE PRUEBAS ==="
echo ""

# Prueba 1: Modo por defecto
echo ">>> Prueba 1: Modo por defecto (incremental desde último CSV)"
if docker compose exec -T $CONTAINER_NAME python $API_SCRIPT > /tmp/test1.out 2>&1; then
    if [ -n "$(find data/catalog -name "*.csv" -newer /tmp/test1.out 2>/dev/null)" ]; then
        test_result "Prueba 1" "PASS" "Script OK, CSV generado"
    else
        test_result "Prueba 1" "WARN" "Script OK, sin cambios (no se generó CSV)"
    fi
else
    test_result "Prueba 1" "FAIL" "Script falló (código $?)"
fi

# Prueba 2: Modo completo
echo ">>> Prueba 2: Modo completo con --from-date all"
if [ -n "$TEST_IMAGE_2_1" ] && [ -n "$TEST_IMAGE_2_2" ] && [ -n "$TEST_IMAGE_2_3" ]; then
    for img in "$TEST_IMAGE_2_1" "$TEST_IMAGE_2_2" "$TEST_IMAGE_2_3"; do
        docker compose exec -T $CONTAINER_NAME rm -f ${COVERS_PATH}/$img 2>/dev/null || true
    done
    if docker compose exec -T $CONTAINER_NAME python $API_SCRIPT --from-date all > /tmp/test2.out 2>&1; then
        OK=0
        for img in "$TEST_IMAGE_2_1" "$TEST_IMAGE_2_2" "$TEST_IMAGE_2_3"; do
            if docker compose exec -T $CONTAINER_NAME ls ${COVERS_PATH}/$img >/dev/null 2>&1; then
                ((OK++))
            fi
        done
        if [ $OK -eq 3 ]; then
            test_result "Prueba 2" "PASS" "Todas las imágenes descargadas"
        elif [ $OK -gt 0 ]; then
            test_result "Prueba 2" "WARN" "Solo $OK de 3 imágenes descargadas"
        else
            test_result "Prueba 2" "FAIL" "Ninguna imagen descargada"
        fi
    else
        test_result "Prueba 2" "FAIL" "Script falló (código $?)"
    fi
else
    test_result "Prueba 2" "WARN" "No hay suficientes imágenes para probar"
fi

# Prueba 3: Solo metadatos
echo ">>> Prueba 3: Solo metadatos (sin cubiertas)"
if [ -n "$TEST_IMAGE_3" ]; then
    docker compose exec -T $CONTAINER_NAME rm -f ${COVERS_PATH}/${TEST_IMAGE_3} 2>/dev/null || true
    if docker compose exec -T $CONTAINER_NAME python $API_SCRIPT --update-metadata > /tmp/test3.out 2>&1; then
        if docker compose exec -T $CONTAINER_NAME ls ${COVERS_PATH}/${TEST_IMAGE_3} >/dev/null 2>&1; then
            test_result "Prueba 3" "FAIL" "Imagen descargada (no debería)"
        else
            if [ -n "$(find data/catalog -name "*.csv" -newer /tmp/test3.out 2>/dev/null)" ]; then
                test_result "Prueba 3" "PASS" "Imagen no descargada, CSV generado"
            else
                test_result "Prueba 3" "WARN" "Imagen no descargada pero no se detectó CSV"
            fi
        fi
    else
        test_result "Prueba 3" "FAIL" "Script falló (código $?)"
    fi
else
    test_result "Prueba 3" "WARN" "No hay imagen disponible"
fi

# Prueba 4: Metadatos con fecha dinámica
echo ">>> Prueba 4: Solo metadatos con fecha dinámica ($ONE_MONTH_AGO)"
if docker compose exec -T $CONTAINER_NAME python $API_SCRIPT --update-metadata --from-date "$ONE_MONTH_AGO" > /tmp/test4.out 2>&1; then
    if grep -q "$ONE_MONTH_AGO" /tmp/test4.out; then
        test_result "Prueba 4" "PASS" "Log contiene la fecha"
    else
        test_result "Prueba 4" "WARN" "Fecha no encontrada en log (puede ser normal si no hay cambios)"
    fi
else
    test_result "Prueba 4" "FAIL" "Script falló (código $?)"
fi

# Prueba 5: Cubiertas sin fecha
echo ">>> Prueba 5: Solo cubiertas desde CSV (sin fecha)"
if [ -n "$TEST_IMAGE_5" ]; then
    docker compose exec -T $CONTAINER_NAME rm -f ${COVERS_PATH}/${TEST_IMAGE_5} 2>/dev/null || true
    if docker compose exec -T $CONTAINER_NAME python $API_SCRIPT --update-covers > /tmp/test5.out 2>&1; then
        if docker compose exec -T $CONTAINER_NAME ls ${COVERS_PATH}/${TEST_IMAGE_5} >/dev/null 2>&1; then
            test_result "Prueba 5" "PASS" "Imagen descargada correctamente"
        else
            test_result "Prueba 5" "FAIL" "Imagen no descargada"
        fi
    else
        test_result "Prueba 5" "FAIL" "Script falló (código $?)"
    fi
else
    test_result "Prueba 5" "WARN" "No hay imagen disponible"
fi

# Prueba 6: Cubiertas con fecha dinámica
echo ">>> Prueba 6: Solo cubiertas con fecha dinámica ($ONE_MONTH_AGO)"
if [ -n "$TEST_IMAGE_6" ]; then
    docker compose exec -T $CONTAINER_NAME rm -f ${COVERS_PATH}/${TEST_IMAGE_6} 2>/dev/null || true
    if docker compose exec -T $CONTAINER_NAME python $API_SCRIPT --update-covers --from-date "$ONE_MONTH_AGO" > /tmp/test6.out 2>&1; then
        if docker compose exec -T $CONTAINER_NAME ls ${COVERS_PATH}/${TEST_IMAGE_6} >/dev/null 2>&1; then
            test_result "Prueba 6" "PASS" "Imagen descargada"
        else
            test_result "Prueba 6" "WARN" "Imagen no descargada (puede que no exista en la fecha)"
        fi
    else
        test_result "Prueba 6" "FAIL" "Script falló (código $?)"
    fi
else
    test_result "Prueba 6" "WARN" "No hay imagen disponible"
fi

# Prueba 7: Cubiertas completo
echo ">>> Prueba 7: Solo cubiertas con --from-date all"
if [ -n "$TEST_IMAGE_7_1" ] && [ -n "$TEST_IMAGE_7_2" ] && [ -n "$TEST_IMAGE_7_3" ]; then
    for img in "$TEST_IMAGE_7_1" "$TEST_IMAGE_7_2" "$TEST_IMAGE_7_3"; do
        docker compose exec -T $CONTAINER_NAME rm -f ${COVERS_PATH}/$img 2>/dev/null || true
    done
    if docker compose exec -T $CONTAINER_NAME python $API_SCRIPT --update-covers --from-date all > /tmp/test7.out 2>&1; then
        OK=0
        for img in "$TEST_IMAGE_7_1" "$TEST_IMAGE_7_2" "$TEST_IMAGE_7_3"; do
            if docker compose exec -T $CONTAINER_NAME ls ${COVERS_PATH}/$img >/dev/null 2>&1; then
                ((OK++))
            fi
        done
        if [ $OK -eq 3 ]; then
            test_result "Prueba 7" "PASS" "Todas las imágenes descargadas"
        elif [ $OK -gt 0 ]; then
            test_result "Prueba 7" "WARN" "Solo $OK de 3 imágenes descargadas"
        else
            test_result "Prueba 7" "FAIL" "Ninguna imagen descargada"
        fi
    else
        test_result "Prueba 7" "FAIL" "Script falló (código $?)"
    fi
else
    test_result "Prueba 7" "WARN" "No hay suficientes imágenes"
fi

# Prueba 8: Symlink catalog.csv
echo ">>> Prueba 8: Verificar symlink catalog.csv"
LATEST_CSV=$(ls -1 data/catalog/*.csv | tail -1)
LATEST_NAME=$(basename "$LATEST_CSV")
if [ -L public/catalog.csv ]; then
    SYMLINK_TARGET=$(readlink public/catalog.csv)
    if [ "$SYMLINK_TARGET" == "$LATEST_NAME" ]; then
        test_result "Prueba 8" "PASS" "Symlink OK"
    else
        test_result "Prueba 8" "WARN" "Symlink apunta a $SYMLINK_TARGET, último es $LATEST_NAME"
    fi
else
    test_result "Prueba 8" "WARN" "Symlink catalog.csv no existe (puede que no se haya creado)"
fi

# Prueba 9: Symlink covers
echo ">>> Prueba 9: Verificar symlink covers"
if [ -L public/covers ]; then
    SYMLINK_COVERS=$(readlink public/covers)
    if [ "$SYMLINK_COVERS" == "../data/covers" ]; then
        test_result "Prueba 9" "PASS" "Symlink covers correcto"
    else
        test_result "Prueba 9" "FAIL" "Symlink covers incorrecto: apunta a $SYMLINK_COVERS"
    fi
else
    test_result "Prueba 9" "WARN" "Symlink covers no existe (puede que no se haya creado)"
fi

# Prueba 10: Logs
echo ">>> Prueba 10: Verificar generación de logs"
LATEST_LOG=$(ls -1 data/logs/*.log 2>/dev/null | tail -1)
if [ -n "$LATEST_LOG" ] && [ -f "$LATEST_LOG" ]; then
    test_result "Prueba 10" "PASS" "Log generado: $(basename "$LATEST_LOG")"
else
    test_result "Prueba 10" "FAIL" "No se encontró ningún log"
fi

# ─── RESUMEN FINAL ──────────────────────────────────────────────────
echo ""
echo "=== RESUMEN DE PRUEBAS ==="
echo -e "${GREEN}✅ PASS: $PASS${NC}"
echo -e "${YELLOW}⚠️ WARN: $WARN${NC}"
echo -e "${RED}❌ FAIL: $FAIL${NC}"
echo ""
if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}Todas las pruebas críticas han pasado.${NC}"
else
    echo -e "${RED}Hay pruebas fallidas. Revisa los logs en /tmp/test*.out${NC}"
fi
echo ""
echo "Logs detallados: /tmp/test1.out ... /tmp/test10.out"
echo "Fin de la batería de pruebas."
