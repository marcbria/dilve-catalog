# Catálogo editorial – Descarga y visualización desde DILVE

Este proyecto permite descargar el catálogo de una editorial desde la API de DILVE y mostrarlo en una interfaz web. Consta de dos partes integradas:

- **Extracción de datos**: script en Python que descarga los metadatos y las imágenes de cubierta desde la API de DILVE, y los guarda en archivos CSV y carpetas de imágenes.
- **Visualización**: interfaz web (HTML + CSS + JS) que muestra el catálogo en forma de cuadrícula, con filtros, búsqueda y modal de detalle.

El sistema está diseñado para ejecutarse de forma periódica (por ejemplo, diariamente mediante cron) para mantener actualizada la copia local del catálogo, y la interfaz web siempre muestra la última versión disponible. Todo el entorno se puede desplegar fácilmente con Docker.

## TL;DR – Instalación y uso rápido

1. Clona o descarga los ficheros del proyecto.
2. Crea un archivo `.env` en la raíz del proyecto con tus credenciales (ver sección «Configuración»).
3. Arranca el contenedor:

        ./run.sh dev

4. Accede a `http://localhost:8080` para ver el catálogo.

La primera vez, el contenedor descargará automáticamente todo el catálogo. A partir de entonces, se actualizará cada día a las 2:00 AM (solo los cambios).

## Estructura del proyecto

    .
    ├── README.md
    ├── compose.yml              # Orquestación del contenedor (dev)
    ├── compose.traefik.yml      # Overlay de producción con Traefik
    ├── Dockerfile               # Construcción de la imagen
    ├── run.sh                   # Script de arranque y actualización
    ├── test.sh                  # Batería de pruebas de la extracción
    ├── .env                     # (no versionado) credenciales y configuración
    ├── docker/                  # Scripts de inicio, cron y Nginx
    │   ├── entrypoint.sh
    │   ├── update.sh
    │   ├── nginx.conf
    │   └── generate_thema_dict.py
    ├── extract/                 # Código de extracción de datos
    │   ├── main.py              # Script principal
    │   ├── config.py            # Configuración (lee variables de entorno)
    │   └── requirements.txt     # Dependencias Python
    ├── public/                  # Frontend estático
    │   ├── index.html
    │   ├── css/styles.css
    │   └── js/app.js
    └── theme/                   # Temas visuales
        ├── default/
        └── uab/

Los directorios `data/` (catalog, covers, logs) se crean automáticamente dentro del contenedor y se persisten mediante un volumen.

## Instalación detallada

### Requisitos previos

- Docker y Docker Compose (v2, comando `docker compose`) instalados.
- Credenciales válidas de DILVE (usuario y contraseña).
- Conocer el código interno de la editorial (formato `DLV0000XXXX` o solo el número). Pueden ser varios separados por `|`.

### Pasos para el despliegue

1. **Clona o descarga los ficheros** del proyecto en una carpeta de tu equipo.

2. **Configura las credenciales** creando un archivo `.env` en la raíz del proyecto (ver «Configuración» más abajo). Ejemplo mínimo:

        DILVE_USER=tu_usuario
        DILVE_PASS=tu_contraseña
        EDITORIAL_CODE=DLV00006221|DLV00036383

   `compose.yml` lee automáticamente este archivo y lo inyecta como variables de entorno al contenedor. **No es necesario editar ningún fichero Python ni el `compose.yml`**: toda la configuración se realiza mediante `.env`.

3. **Arranca el contenedor**:

        ./run.sh dev

   Esto construye la imagen (si no existe) y arranca el contenedor en segundo plano, mostrando los logs en primer plano. Pulsa `Ctrl+C` para salir de los logs sin detener el contenedor.

   Para producción con Traefik:

        ./run.sh prod

4. **Verifica que todo funciona** accediendo a `http://localhost:8080`.

    La primera vez, el contenedor descargará el catálogo completo (puede tardar varios minutos). Durante la descarga, la página web mostrará un mensaje de error hasta que el archivo CSV esté disponible. Una vez finalizada, la interfaz mostrará el catálogo.

### Configuración mediante variables de entorno

El script de extracción lee toda su configuración de variables de entorno (nunca de ficheros Python con secretos). El modo recomendado —y único soportado oficialmente— es definirlas en un archivo `.env` en la raíz del proyecto; Docker Compose las inyecta automáticamente en el contenedor.

| Variable              | Descripción                                                       | Valor por defecto                            |
|-----------------------|-------------------------------------------------------------------|----------------------------------------------|
| `DILVE_USER`          | Usuario de DILVE                                                  | (requerido)                                  |
| `DILVE_PASS`          | Contraseña de DILVE                                               | (requerido)                                  |
| `EDITORIAL_CODE`      | Código de la editorial (varios separados por `\|`)                | (requerido)                                  |
| `BATCH_SIZE`          | Número de ISBN por petición (máximo 128)                          | `128`                                        |
| `ACTIVE_STATUS_CODES` | Códigos de estado activos (lista 64 de ONIX), separados por coma  | `04,02,13,18`                                |
| `CRON_SCHEDULE`       | Expresión cron para la actualización automática                   | `0 2 * * *` (diario a las 2 AM)              |
| `TZ`                  | Zona horaria (ej. `Europe/Madrid`)                                | `UTC`                                        |
| `THEME`               | Tema a utilizar (nombre de la carpeta dentro de `theme/`)         | `default`                                    |
| `LOGO`                | URL o nombre de archivo del logo (opcional)                       | (vacío)                                      |
| `BASE_PATH`           | Ruta base si se sirve desde un subdirectorio                      | `/`                                          |
| `ORGANIZATION`        | Nombre de la institución (se usa en el título y el footer)        | `Universitat Autònoma de Barcelona`          |
| `DEFAULT_LANG`        | Idioma por defecto de la interfaz                                 | `ca`                                         |

Ejemplo de `.env` completo:

    DILVE_USER=mi_usuario
    DILVE_PASS=mi_contraseña
    EDITORIAL_CODE=DLV00001234|DLV00005678
    CRON_SCHEDULE=0 3 * * *
    TZ=Europe/Madrid
    THEME=uab
    ORGANIZATION="Universitat Autònoma de Barcelona"
    LOGO=logo-uab.png
    BASE_PATH=/llibres/cataleg
    DEFAULT_LANG=ca

### Actualización manual

Si deseas forzar una actualización en cualquier momento, puedes usar el script `run.sh` desde el host:

    # Actualización incremental (metadatos + cubiertas) desde el último CSV
    ./run.sh update

    # Actualización completa
    ./run.sh update --from-date all

    # Solo metadatos desde una fecha concreta
    ./run.sh update --metadata --from-date 2026-01-01

    # Solo cubiertas en producción
    ./run.sh update --covers --env prod

O directamente dentro del contenedor:

    docker compose exec app /app/update.sh

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

### `collections.csv`

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

| Problema                                      | Posible causa y solución                                                                                     |
|-----------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| La web no muestra datos tras el despliegue    | La primera descarga puede tardar. Revisa los logs con `./run.sh dev` o `docker compose logs -f app`.          |
| `ModuleNotFoundError: No module named 'config'` | El fichero `extract/config.py` no está en la imagen. Verifica que no esté excluido por `.dockerignore` ni por `.gitignore` y que exista en `extract/`. |
| `RuntimeError: Falta la variable de entorno requerida 'DILVE_USER'` | No se ha creado el `.env`, está mal ubicado (debe estar en la raíz) o le faltan variables. Revisa «Configuración». |
| Error de autenticación en los logs            | Credenciales incorrectas en `.env`. Verifícalas.                                                              |
| El cron no se ejecuta                         | Comprueba la variable `CRON_SCHEDULE` y la zona horaria (`TZ`).                                               |
| Las imágenes no se ven en la web              | Asegúrate de que el enlace simbólico `public/covers` apunta a `data/covers` y que las cubiertas se descargaron. |
| «No se encontraron productos»                 | El código de editorial es incorrecto. Obtén el código correcto de DILVE.                                      |
| Los logs no se generan                        | Comprueba que el directorio `data/logs` existe y tiene permisos de escritura.                                 |

## Licencia y derechos

Este software se distribuye bajo la licencia **GNU General Public License v3.0 (GPLv3)**. El código fuente está disponible para su uso, modificación y redistribución, siempre que se mantenga la misma licencia y se haga referencia al autor original.

El *copyright* del código pertenece al **Servei de Publicacions de la Universitat Autònoma de Barcelona (UAB)**, que lo publica bajo los términos de la GPLv3.

---

Desarrollado por Marc Bria Ramírez para el Servei de Publicacions de la Universitat Autònoma de Barcelona (UAB).
