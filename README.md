# Catálogo editorial – Descarga y visualización desde DILVE

Este proyecto permite descargar el catálogo de una editorial desde la API de DILVE y mostrarlo en una interfaz web. Consta de dos partes integradas:

- **Extracción de datos**: script en Python que descarga los metadatos y las imágenes de cubierta desde la API de DILVE, y los guarda en archivos CSV y carpetas de imágenes.
- **Visualización**: interfaz web (HTML + CSS + JS) que muestra el catálogo en forma de cuadrícula, con filtros, búsqueda y modal de detalle.

El sistema está diseñado para ejecutarse de forma periódica (por ejemplo, diariamente mediante cron) para mantener actualizada la copia local del catálogo, y la interfaz web siempre muestra la última versión disponible. Todo el entorno se puede desplegar fácilmente con Docker.

## TL;DR – Instalación y uso rápido con Docker

1. Clona o descarga los ficheros del proyecto.
2. (Opcional) Crea un archivo `.env` en la raíz del proyecto con tus credenciales (ver sección "Configuración").
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
        │   ├── main.py              # Script principal de extracción
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

2. **Configura las credenciales** (elige una de las siguientes opciones):

    - **Opción A (recomendada)**: crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

            DILVE_USER=tu_usuario
            DILVE_PASS=tu_contraseña
            EDITORIAL_CODE=DLV00006221|DLV00036383

        Docker Compose leerá automáticamente este archivo y lo inyectará como variables de entorno al contenedor.

    - **Opción B**: edita directamente `extract/config.py` y establece los valores en el código:

            DILVE_USER = "tu_usuario"
            DILVE_PASS = "tu_contraseña"
            EDITORIAL_CODE = "DLV00006221|DLV00036383"

    - **Opción C**: define las variables de entorno en el propio `docker-compose.yml` (no recomendado si quieres mantenerlas fuera del control de versiones).

3. **Inicia el contenedor** con Docker Compose:

        docker-compose up -d

    Esto construirá la imagen (si no existe) y arrancará el contenedor en segundo plano.

4. **Verifica que todo funciona** accediendo a `http://localhost:8080`.

    La primera vez, el contenedor descargará el catálogo completo (puede tardar varios minutos). Durante la descarga, la página web mostrará un mensaje de error hasta que el archivo CSV esté disponible. Una vez finalizada, la interfaz mostrará el catálogo.

### Configuración mediante variables de entorno

El script de extracción lee la configuración de las siguientes variables de entorno. Puedes definirlas en un archivo `.env` (recomendado), en el `docker-compose.yml` o en el sistema.

| Variable              | Descripción                                                      | Valor por defecto        |
|-----------------------|------------------------------------------------------------------|--------------------------|
| `DILVE_USER`          | Usuario de DILVE                                                 | (requerido)              |
| `DILVE_PASS`          | Contraseña de DILVE                                              | (requerido)              |
| `EDITORIAL_CODE`      | Código de la editorial (varios separados por `\|`)               | (requerido)              |
| `BATCH_SIZE`          | Número de ISBN por petición (máximo 128)                        | 128                      |
| `ACTIVE_STATUS_CODES` | Códigos de estado activos (lista 64 de ONIX), separados por coma | "04,02,13,18"            |
| `CRON_SCHEDULE`       | Expresión cron para la actualización automática                  | "0 2 * * *" (diario 2 AM) |
| `TZ`                  | Zona horaria (ej. "Europe/Madrid")                               | "UTC"                    |
| `THEME`               | Tema a utilizar (nombre de la carpeta en `theme/`)               | "default"                |
| `LOGO`                | URL o nombre de archivo del logo (opcional)                      | (vacío)                  |
| `BASE_PATH`           | Ruta base si se sirve desde un subdirectorio                     | "/"                      |
| `ORGANIZATION`        | Nombre de la institución (se usa en el título y el footer)       | "Universitat Autònoma de Barcelona" |

Si usas el archivo `.env`, su contenido debería ser similar a:

        DILVE_USER=mi_usuario
        DILVE_PASS=mi_contraseña
        EDITORIAL_CODE=DLV00001234|DLV00005678
        CRON_SCHEDULE=0 3 * * *
        TZ=Europe/Madrid
        THEME=uab
        ORGANIZATION="Universitat Autònoma de Barcelona"
        LOGO=logo-uab.png
        BASE_PATH=/llibres/cataleg

### Actualización manual

Si deseas forzar una actualización en cualquier momento, puedes ejecutar dentro del contenedor:

        docker exec -it <nombre_contenedor> /app/update.sh

## Personalización del frontend

### Temas (theming)

El proyecto soporta diferentes temas visuales. Cada tema es una carpeta dentro de `theme/`. Puedes cambiar el tema activo mediante la variable de entorno `THEME`.

Cada tema puede definir los siguientes fragmentos, que se ensamblan automáticamente:

- `header.html`: cabecera del sitio.
- `footer.html`: pie de página.
- `styles.css`: estilos adicionales.
- `head_extra.html`: contenido extra para el `<head>` (ej. enlaces a CSS externos).
- `img/`: directorio para imágenes del tema.

Si un fragmento no existe en el tema activo, se usa el del tema `default`.

#### Tema `default`

- Cabecera simple con el logo de la UAB (o el SVG generado con `ORGANIZATION`).
- Pie de página genérico.
- Sin estilos adicionales.

#### Tema `uab`

- Cabecera completa con prenavegación, menú y logo de la UAB.
- Pie de página específico.
- Estilos para el header (incluye un archivo `css/header-styles.css` con los estilos extraídos de la web de la UAB).

### Collections.csv

Puedes añadir un archivo `data/collections.csv` para que las colecciones tengan una descripción. Debe tener dos columnas: `titulo` e `intro`. Cuando se selecciona una colección en el filtro, se muestra la introducción correspondiente.

### Script `run.sh`

El script `run.sh` facilita el arranque en diferentes entornos y la ejecución de actualizaciones:

        # Arrancar en modo desarrollo (solo compose.yml)
        ./run.sh dev

        # Arrancar en modo producción (compose.yml + compose.traefik.yml)
        ./run.sh prod

        # Actualizar metadatos y cubiertas (incremental)
        ./run.sh update --from-date 2026-01-01

        # Actualizar solo metadatos en producción
        ./run.sh update --metadata --env prod

        # Actualizar solo cubiertas (completo)
        ./run.sh update --covers --all

        # Ver ayuda
        ./run.sh help

## Solución de problemas comunes

| Problema                                      | Posible causa y solución                                                                 |
|-----------------------------------------------|------------------------------------------------------------------------------------------|
| La web no muestra datos tras el despliegue    | La primera descarga puede tardar. Revisa los logs con `docker logs <contenedor>`.          |
| Error de autenticación en los logs            | Credenciales incorrectas en `config.py` o en las variables de entorno. Verifícalas.        |
| El cron no se ejecuta                         | Comprueba la variable `CRON_SCHEDULE` y la zona horaria (`TZ`).                           |
| Las imágenes no se ven en la web              | Asegúrate de que el enlace simbólico `public/covers` apunta a `data/covers`.              |
| "No se encontraron productos"                 | El código de editorial es incorrecto. Obtén el código correcto de DILVE.                  |
| Los logs no se generan                        | Comprueba que el directorio `data/logs` existe y tiene permisos de escritura.             |

## Licencia y derechos

Este software se distribuye bajo la licencia **GNU General Public License v3.0 (GPLv3)**. El código fuente está disponible para su uso, modificación y redistribución, siempre que se mantenga la misma licencia y se haga referencia al autor original.

Todos los derechos de propiedad intelectual y de explotación de este desarrollo pertenecen al **Servei de Publicacions de la Universitat Autònoma de Barcelona (UAB)**.

---

Desarrollado por Marc Bria Ramírez para el Servei de Publicacions de la Universitat Autònoma de Barcelona (UAB).
