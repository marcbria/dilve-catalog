# Catálogo editorial – Descarga y visualización desde DILVE

Este proyecto permite descargar el catálogo de una editorial desde la API de DILVE y mostrarlo en una interfaz web. Consta de dos partes integradas:

- **Extracción de datos**: script en Python que descarga los metadatos y las imágenes de cubierta desde la API de DILVE, y los guarda en archivos CSV y carpetas de imágenes.
- **Visualización**: interfaz web (HTML + CSS + JS) que muestra el catálogo en forma de cuadrícula, con filtros, búsqueda y modal de detalle.

El sistema está diseñado para ejecutarse de forma periódica (por ejemplo, diariamente mediante cron) para mantener actualizada la copia local del catálogo, y la interfaz web siempre muestra la última versión disponible. Todo el entorno se puede desplegar fácilmente con Docker.

## TL;DR – Instalación y uso rápido con Docker

1. Clona o descarga los ficheros del proyecto.
2. Edita `extract/config.py` con tus credenciales de DILVE y el código de la editorial.
3. Ejecuta con Docker Compose:

       docker-compose up -d

4. Accede a `http://localhost:8080` para ver el catálogo.

La primera vez, el contenedor descargará automáticamente todo el catálogo. A partir de entonces, se actualizará cada día a las 2:00 AM (solo los cambios).

## Estructura del proyecto

    .
    ├── README.md
    ├── docker-compose.yml       # Orquestación del contenedor
    ├── Dockerfile               # Construcción de la imagen
    ├── docker/                  # Scripts de inicio y actualización
    │   ├── entrypoint.sh
    │   └── update.sh
    ├── extract/
    │   ├── api_dilve.py         # Script principal de extracción
    │   ├── config.py            # Configuración (lee variables de entorno)
    │   └── requirements.txt     # Dependencias Python
    └── public/                  # Frontend estático
        ├── index.html
        ├── css/styles.css
        └── js/app.js

Los directorios `data/` (catalog, covers, logs) se crean automáticamente dentro del contenedor y se persisten mediante un volumen.

## Instalación detallada

### Requisitos previos

- Docker y Docker Compose instalados.
- Credenciales válidas de DILVE (usuario y contraseña).
- Conocer el código interno de la editorial (formato `DLV0000XXXX` o solo el número). Pueden ser varios separados por `|`.

### Pasos para el despliegue con Docker

1. **Clona o descarga los ficheros** del proyecto en una carpeta de tu equipo.

2. **Edita el archivo de configuración** `extract/config.py` con tus credenciales y el código de la editorial:

       DILVE_USER = "tu_usuario"
       DILVE_PASS = "tu_contraseña"
       EDITORIAL_CODE = "DLV00006221|DLV00036383"

   El resto de parámetros (rutas, tamaños de lote, etc.) ya están preconfigurados y se pueden dejar como están.

3. **Inicia el contenedor** con Docker Compose:

       docker-compose up -d

   Esto construirá la imagen (si no existe) y arrancará el contenedor en segundo plano.

4. **Verifica que todo funciona** accediendo a `http://localhost:8080`.

   La primera vez, el contenedor descargará el catálogo completo (puede tardar varios minutos). Durante la descarga, la página web mostrará un mensaje de error hasta que el archivo CSV esté disponible. Una vez finalizada, la interfaz mostrará el catálogo.

### Configuración mediante variables de entorno

Si prefieres no modificar `config.py`, puedes pasar las credenciales y otros parámetros como variables de entorno en `docker-compose.yml`. Por ejemplo:

    environment:
      - DILVE_USER=mi_usuario
      - DILVE_PASS=mi_contraseña
      - EDITORIAL_CODE=DLV00001234
      - CRON_SCHEDULE=0 2 * * *

Las variables disponibles son:

| Variable              | Descripción                                                      | Valor por defecto        |
|-----------------------|------------------------------------------------------------------|--------------------------|
| `DILVE_USER`          | Usuario de DILVE                                                 | (requerido)              |
| `DILVE_PASS`          | Contraseña de DILVE                                              | (requerido)              |
| `EDITORIAL_CODE`      | Código de la editorial (varios separados por `\|`)               | (requerido)              |
| `BATCH_SIZE`          | Número de ISBN por petición (máximo 128)                        | 128                      |
| `ACTIVE_STATUS_CODES` | Códigos de estado activos (lista 64 de ONIX), separados por coma | "04,02,13,18"            |
| `CRON_SCHEDULE`       | Expresión cron para la actualización automática                  | "0 2 * * *" (diario 2 AM) |
| `TZ`                  | Zona horaria (ej. "Europe/Madrid")                               | "UTC"                    |

### Actualización manual

Si deseas forzar una actualización en cualquier momento, puedes ejecutar dentro del contenedor:

    docker exec -it <nombre_contenedor> /app/update.sh

## Funcionamiento interno del contenedor

Al arrancar, el contenedor realiza las siguientes tareas automáticamente:

1. **Verifica si existe algún CSV previo** en `data/catalog/`.
   - Si **no existe** → ejecuta `api_dilve.py` en **modo completo** (descarga todo el catálogo).
   - Si **existe** → toma la fecha del último CSV (ej. `20260708-1430.csv` → `2026-07-08`) y ejecuta `api_dilve.py` en **modo incremental** con `FROM_DATE` igual a esa fecha. Así solo descarga los cambios desde la última ejecución.

2. **Crea/actualiza enlaces simbólicos** en `public/`:
   - `public/catalog.csv` → apunta al último CSV generado.
   - `public/covers` → apunta a `data/covers`.

3. **Guarda el registro** de la ejecución en `data/logs/YYYYMMDD.log`.

4. **Configura el cron** con la tarea programada (por defecto a las 2:00 AM) para ejecutar el script de actualización diariamente.

5. **Arranca el servidor web** (Nginx) en primer plano para servir la interfaz.

El script de actualización (`update.sh`) repite el proceso de manera incremental cada vez que se ejecuta (bien por cron o manualmente).

## Modo de ejecución sin Docker (solo extracción)

Si no deseas usar Docker para la extracción, puedes ejecutar el script directamente en un entorno Python:

1. Navega al directorio `extract/` y crea un entorno virtual:

       cd extract
       python3 -m venv venv
       source venv/bin/activate
       pip install -r requirements.txt

2. Edita `config.py` con tus credenciales (o usa variables de entorno).

3. Ejecuta:

       python api_dilve.py

   La primera vez, descargará todo el catálogo. Las ejecuciones posteriores, si `FROM_DATE` está definido, solo descargarán los cambios.

## Personalización del frontend

- **Estilos**: modifica `public/css/styles.css`.
- **Lógica**: edita `public/js/app.js`.
- **Descripciones de colecciones**: coloca un archivo `data/colections.csv` con columnas `titulo` e `intro`. El frontend lo cargará automáticamente y mostrará la introducción al seleccionar una colección.

## Solución de problemas comunes

| Problema                                      | Posible causa y solución                                                                 |
|-----------------------------------------------|------------------------------------------------------------------------------------------|
| La web no muestra datos tras el despliegue    | La primera descarga puede tardar. Revisa los logs con `docker logs <contenedor>`.          |
| Error de autenticación en los logs            | Credenciales incorrectas en `config.py` o variables de entorno. Verifícalas.              |
| El cron no se ejecuta                         | Comprueba la variable `CRON_SCHEDULE` y la zona horaria (`TZ`).                           |
| Las imágenes no se ven en la web              | Asegúrate de que el enlace simbólico `public/covers` apunta a `data/covers`.              |
| "No se encontraron productos"                 | El código de editorial es incorrecto. Obtén el código correcto de DILVE.                  |

## Licencia y derechos

Este software se distribuye bajo la licencia **GNU General Public License v3.0 (GPLv3)**. El código fuente está disponible para su uso, modificación y redistribución, siempre que se mantenga la misma licencia y se haga referencia al autor original.

Todos los derechos de propiedad intelectual y de explotación de este desarrollo pertenecen al **Servei de Publicacions de la Universitat Autònoma de Barcelona (UAB)**.

---

Desarrollado por Marc Bria Ramírez para el Servei de Publicacions de la Universitat Autònoma de Barcelona (UAB).
