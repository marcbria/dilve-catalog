# Catálogo DILVE - Descarga de metadatos y cubiertas

## Resumen

Esta herramienta permite descargar automáticamente el catálogo completo de una o varias editoriales desde la API de DILVE (Distribuidor de Información del Libro Español en Venta). Obtiene todos los libros activos, extrae más de 60 campos de metadatos (título, autores, ISBN, precios, fechas, materias, etc.) y genera un archivo CSV estructurado. Además, descarga las imágenes de cubierta asociadas a cada libro, organizándolas en una carpeta independiente. Soporta tanto imágenes alojadas en DILVE como URLs externas.

El script está escrito en Python y utiliza la API REST de DILVE (DAPI v1.0) para recuperar la información en formato ONIX 3.0. Está diseñado para ser ejecutado de forma periódica, permitiendo mantener actualizada una copia local del catálogo de la editorial.

## TL;DR - Instalación y uso rápido

1. Clona o descarga los ficheros del proyecto.
2. Crea un entorno virtual (recomendado) e instala la dependencia:

       python3 -m venv venv
       source venv/bin/activate   # En Windows: venv\Scripts\activate
       pip install -r requirements.txt

3. Edita el fichero `config.py` con tus credenciales de DILVE, el código de la editorial y el modo de ejecución.
4. Ejecuta el script:

       python catalog_dilve.py

5. El resultado se guardará en la carpeta `catalog/` con un nombre del tipo `YYYYMMDD-HHMM.csv` y las imágenes en `covers/`.

## Instalación detallada

### Requisitos previos

- Python 3.6 o superior.
- Acceso a Internet para conectarse a la API de DILVE.
- Credenciales válidas de DILVE (usuario y contraseña).
- Conocer el código interno de la editorial (formato `DLV0000XXXX` o solo el número). Pueden ser varios separados por `|`.

### Pasos

1. Descarga todos los ficheros del proyecto en una carpeta de tu equipo.
2. Abre una terminal y navega hasta esa carpeta.

3. **Crear un entorno virtual (recomendado encarecidamente)**

   En sistemas Linux/macOS:

       python3 -m venv venv
       source venv/bin/activate

   En Windows:

       python -m venv venv
       venv\Scripts\activate

   Esto aísla las dependencias del sistema y evita conflictos con paquetes del sistema operativo.

4. **Instalar la dependencia**

   Una vez activado el entorno virtual, ejecuta:

       pip install -r requirements.txt

   Esto instalará la librería `requests`, necesaria para realizar las llamadas HTTP a la API.

5. **Verificar los ficheros**

   Asegúrate de que tienes los siguientes archivos en la carpeta:

   - `catalog_dilve.py` (script principal)
   - `config.py` (archivo de configuración)
   - `requirements.txt` (lista de dependencias)
   - `README.md` (este documento)

6. **Salir del entorno virtual (cuando hayas terminado)**

       deactivate

### Estructura de directorios (se crean automáticamente al ejecutar)

- `catalog/` – contiene el archivo CSV con los metadatos. Cada ejecución genera un nuevo archivo con marca de tiempo.
- `covers/` – contiene todas las imágenes de cubierta descargadas. Se sobrescriben en cada ejecución (si existe una imagen con el mismo nombre, se reemplaza).

## Configuración

El fichero `config.py` contiene todas las variables ajustables. Abre este archivo con un editor de texto y modifica los valores según tus necesidades.

### Tabla de variables de configuración

| Variable               | Descripción                                                                                     | Ejemplo                                 |
|------------------------|-------------------------------------------------------------------------------------------------|-----------------------------------------|
| `DILVE_USER`           | Nombre de usuario de DILVE                                                                      | `"usuario_ejemplo"`                     |
| `DILVE_PASS`           | Contraseña de DILVE                                                                             | `"contraseña_secreta"`                  |
| `EDITORIAL_CODE`       | Código de la editorial (pueden ser varios separados por `\|`)                                   | `"DLV00006221\|DLV00036383"`            |
| `BASE_URL`             | URL base de la API (no modificar a menos que cambie el servicio)                               | `"https://www.dilve.es/dilve/dilve/"`   |
| `OUTPUT_DIR`           | Carpeta donde se guardará el CSV                                                                | `"catalog"`                             |
| `COVERS_DIR`           | Carpeta donde se guardarán las imágenes                                                         | `"covers"`                              |
| `BATCH_SIZE`           | Número de ISBN por petición (máximo 128)                                                       | `128`                                   |
| `FROM_DATE`            | Fecha de inicio para modo incremental (formato `YYYY-MM-DD` o `YYYY-MM-DDTHH:MM:SSZ`).          | `None` (completo) o `"2026-01-01"`      |
| `ACTIVE_STATUS_CODES`  | Lista de códigos ONIX (lista 64) que se consideran activos                                     | `["04","02","13","18"]`                 |
| `CSV_COLUMNS`          | Lista de columnas del CSV en el orden deseado (no tocar a menos que se sepa qué hacer)          | (ver fichero)                           |

### Modos de ejecución

El script puede ejecutarse en dos modos, controlados por la variable `FROM_DATE`:

- **Modo completo**: si `FROM_DATE` es `None` o una cadena vacía, el script descarga **todo el catálogo** actual de la editorial. Es el modo recomendado para la primera ejecución o para obtener una copia completa.

- **Modo incremental**: si `FROM_DATE` tiene un valor de fecha, el script obtiene **solo los libros nuevos o modificados** a partir de esa fecha (usando `getRecordStatusX`). Es ideal para actualizaciones periódicas (ej. ejecución diaria desde un cron job). Los libros eliminados no se incluyen (no se pueden obtener metadatos), por lo que si se desea mantener un histórico, se debe gestionar externamente.

**Configuración para ejecución completa** (en `config.py`):

    FROM_DATE = None

**Configuración para ejecución incremental** (ej. cambios desde el 1 de enero de 2026):

    FROM_DATE = "2026-01-01"

**Importante**: Si se ejecuta el script en modo incremental, el CSV contendrá únicamente los libros que han cambiado desde esa fecha. Para mantener el catálogo completo, se debe combinar con un histórico previo o ejecutar el modo completo periódicamente (ej. mensualmente).

### Ejecución programada (cron job)

Para automatizar la actualización diaria, se puede añadir una entrada al crontab (Linux/macOS) que ejecute el script en modo incremental. Ejemplo para ejecutar todos los días a las 2:00 AM:

    0 2 * * * cd /ruta/del/proyecto && /ruta/al/venv/bin/python catalog_dilve.py

Asegúrate de que el fichero `config.py` tenga `FROM_DATE` con la fecha de la última ejecución (se puede actualizar automáticamente con un script auxiliar, o simplemente usar una fecha fija como "2026-01-01" y asumir que todos los cambios posteriores se capturan).

### Cómo obtener el código de editorial

El código de editorial es un identificador interno que DILVE asigna a cada participante. Puedes obtenerlo de varias formas:

- En la ficha de la editorial dentro de DILVE, bajo el epígrafe "Código interno DILVE".
- En el listado de participantes disponible en la web de DILVE (columna CODIGO).
- A partir de los metadatos ONIX de cualquier libro de la editorial, en el campo `NameCodeValue` con `NameCodeType=02` y `NameCodeTypeName=DILVE_PUBLID`.

Si solo dispones del número numérico (sin el prefijo `DLV0000`), el script lo acepta igualmente.

### Múltiples editoriales

El script acepta varios códigos de editorial separados por el carácter `|` (barra vertical). Por ejemplo, para los códigos de la UAB:

    EDITORIAL_CODE = "DLV00006221|DLV00036383"

De esta forma, se obtendrá la lista combinada de todos los ISBN de ambas editoriales, se eliminarán duplicados y se generará un único CSV con el catálogo completo. No es necesario modificar el código principal.

### Control de estado activo

La variable `ACTIVE_STATUS_CODES` define qué códigos de estado en el catálogo (lista 64 de ONIX) se consideran activos. Por defecto incluye:

- `04` – Activo
- `02` – Próxima aparición
- `13` – Activo pero no se vende por separado
- `18` – Activo, pero no se vende como conjunto

Si deseas incluir otros estados (por ejemplo, `01` – Cancelado), añádelos a la lista en `config.py`.

### Modificación de columnas

Si necesitas añadir o quitar campos del CSV, edita la lista `CSV_COLUMNS` en `config.py`. Debes asegurarte de que los nombres coincidan exactamente con los que se extraen en `parsear_producto()`. No se recomienda modificar esta lista a menos que tengas experiencia con el código.

## Uso detallado

### Ejecución básica

Desde la terminal, con el entorno virtual activado, ejecuta:

    python catalog_dilve.py

El script realizará las siguientes acciones en orden:

1. Conecta a la API de DILVE y solicita la lista de ISBN según el modo configurado (completo o incremental).
2. Muestra por pantalla el número total de ISBN encontrados.
3. Divide la lista en lotes del tamaño definido en `BATCH_SIZE` (por defecto 128).
4. Para cada lote, realiza una petición `getRecordsX` para obtener los metadatos en ONIX 3.0.
5. Analiza el XML de cada producto y extrae todos los campos definidos.
6. Filtra los libros que no están activos según los códigos definidos en `ACTIVE_STATUS_CODES`.
7. Para cada libro activo que tenga una imagen de cubierta, descarga la imagen:
   - Si la imagen es una URL externa, se descarga directamente desde esa URL.
   - Si es un recurso interno de DILVE, se usa `getResourceX` con el nombre del archivo.
8. Una vez procesados todos los lotes, genera un archivo CSV con la marca de tiempo actual (formato `YYYYMMDD-HHMM.csv`) dentro de la carpeta `OUTPUT_DIR`.
9. Muestra un mensaje final con la ubicación del CSV.

### Mensajes en consola

Durante la ejecución, el script muestra información de progreso:

- Número total de ISBN.
- Lote actual y número de ISBN en ese lote.
- Advertencias cuando un libro no está activo (se omite).
- Errores (si los hay) al descargar una imagen o al procesar un lote (el script continúa con el siguiente).
- Confirmación de cada imagen descargada (indicando si es externa o de DILVE).

### Manejo de errores

- Si falla la autenticación, el script lanza una excepción y se detiene.
- Si un lote completo falla (por ejemplo, por un error en la API), se muestra el error pero se continúa con el siguiente lote.
- Si una imagen no se puede descargar (error 404, etc.), se registra el error y se sigue con el siguiente libro.
- Al final, se genera el CSV con todos los libros que se pudieron procesar correctamente.

### Imágenes externas

Si un libro tiene una cubierta alojada en un servidor externo (el campo `ResourceLink` es una URL que comienza con `http://` o `https://`), el script descargará la imagen directamente desde esa URL, sin pasar por la API de DILVE. Esto es útil para editoriales que utilizan servicios externos de almacenamiento de imágenes.

### Sobrescritura de archivos

- **Imágenes**: si un archivo de imagen ya existe en `covers/`, se sobrescribirá con la nueva versión descargada en la ejecución actual. Esto asegura que siempre se tenga la última versión disponible.
- **CSV**: cada ejecución genera un nuevo archivo CSV con un nombre único basado en la fecha y hora de ejecución. No se sobrescriben CSVs anteriores, permitiendo mantener un historial.

## Estructura del CSV de salida

El archivo CSV generado contiene las siguientes columnas (en el orden definido en `config.py`):

| Columna                          | Descripción                                                                 |
|----------------------------------|-----------------------------------------------------------------------------|
| `libro_publico`                  | Siempre "Sí" (todos los registros obtenidos son públicos).                   |
| `isbn13`                         | ISBN-13 sin guiones.                                                         |
| `ISBN13_guiones`                 | ISBN-13 con guiones (formato aproximado).                                   |
| `editorial`                      | Nombre de la editorial principal.                                            |
| `sello`                          | Sello editorial (si existe).                                                 |
| `titulo`                         | Título completo del libro.                                                  |
| `subtitulo`                      | Subtítulo (si existe).                                                       |
| `autor`                          | Nombre del autor o autores (hasta 3, separados por punto y coma).            |
| `autor_entidad`                  | (No se utiliza actualmente).                                                |
| `nota_biografica_autor1` ...     | Notas biográficas de los autores (hasta 3).                                  |
| `encuad`                         | Tipo de encuadernación (código ONIX).                                       |
| `formato_libro_3.0`              | Código de formato del producto (ProductForm).                               |
| `num_pags`                       | Número de páginas.                                                          |
| `alto`, `alto_cm`                | Alto en mm y en cm.                                                         |
| `ancho`, `ancho_cm`              | Ancho en mm y en cm.                                                        |
| `grueso`, `grueso_cm`            | Grosor en mm y en cm.                                                       |
| `peso`                           | Peso (en gramos o unidad especificada).                                     |
| `coleccion`                      | Nombre de la colección a la que pertenece.                                  |
| `num_en_coleccion`               | Número dentro de la colección.                                              |
| `idioma`                         | Código de idioma principal (ONIX).                                          |
| `num_edic`                       | Número de edición.                                                          |
| `fecha_public`                   | Fecha de publicación en formato ISO.                                        |
| `fecha_public_dma`               | Fecha de publicación en formato DD/MM/AAAA.                                 |
| `año_public`                     | Año de publicación.                                                         |
| `tirada`                         | (No se extrae en ONIX 3.0; queda vacío).                                    |
| `codigo_bic_materia`             | Código BIC de materia.                                                      |
| `codigo_thema_materia`           | Código Thema de materia.                                                    |
| `codigo_ibic_cargada`            | Código IBIC (si existe).                                                    |
| `codigo_thema_cargada`           | Otro código Thema (si existe).                                              |
| `publico_objetivo`               | Código de audiencia objetivo.                                               |
| `situ_catalogo_editorial`        | Estado de disponibilidad (mismo que `disponibilidad`).                      |
| `disponibilidad`                 | Código de disponibilidad (según lista 169 de ONIX).                         |
| `fecha_disponibilidad`           | Fecha de disponibilidad (ISO).                                              |
| `fecha_disponibilidad_dma`       | Fecha de disponibilidad en DD/MM/AAAA.                                      |
| `fecha_puesta_venta`             | Fecha de puesta a la venta (ISO).                                           |
| `fecha_puesta_venta_dma`         | Fecha de puesta a la venta en DD/MM/AAAA.                                   |
| `iva`                            | Porcentaje de IVA.                                                          |
| `precio_sin_iva`                 | Precio sin IVA (calculado a partir del precio con IVA si está disponible).  |
| `precio_venta_publico`           | Precio de venta al público (con IVA incluido).                              |
| `texto_resumen`                  | Resumen o descripción del libro.                                            |
| `idioma_resumen`                 | Código de idioma del resumen.                                               |
| `imagen_cubierta`                | Nombre del archivo de la imagen descargada (o nombre extraído de la URL).   |
| `imagen_cubierta_normalizada`    | (No se usa).                                                                |
| `formato_imagen_cubierta`        | Extensión del archivo de imagen (ej. jpg, png).                             |
| `formato_imagen_cubierta_3.0`    | Código ONIX del formato de recurso.                                         |
| `fecha_mod_imagen_cubierta`      | (No se extrae; vacío).                                                      |
| `URL_descarga_producto`          | (No se usa).                                                                |
| `web_descarga_producto`          | (No se usa).                                                                |
| `isbn13_edicion_sustituye_a`     | ISBN de la edición que sustituye a esta (si existe).                        |
| `isbn13_edicion_sustituida_por`  | ISBN de la edición que sustituye a esta (relación inversa).                 |
| `isbn13_edicion_impresa`         | (No se extrae; vacío).                                                      |
| `isbn13_edicion_digital`         | (No se extrae; vacío).                                                      |
| `productos_relacionados`         | Lista de ISBN relacionados (separados por `|`).                             |

## Notas importantes

- El script solo descarga los libros cuyo estado en el catálogo (lista 64) esté incluido en `ACTIVE_STATUS_CODES` (por defecto, 04, 02, 13 y 18). Los libros descatalogados o con otros estados se omiten.
- La API limita las peticiones `getRecordsX` a un máximo de 128 ISBN por llamada. El parámetro `BATCH_SIZE` debe mantenerse en 128 o menos.
- La descarga de imágenes se realiza una a una; si hay muchos libros con cubierta, puede tomar tiempo.
- Si algún ISBN no se encuentra en DILVE, se omite silenciosamente (la respuesta ONIX no incluye ese producto).
- El script no maneja reintentos automáticos; si falla una petición, se muestra el error y se continúa.

## Solución de problemas comunes

| Problema                                  | Posible causa y solución                                                   |
|-------------------------------------------|----------------------------------------------------------------------------|
| Error de autenticación (HTTP 403)         | Credenciales incorrectas en `config.py`. Verifica usuario y contraseña.    |
| "No se encontraron productos"             | El código de editorial es incorrecto. Obtén el código correcto de DILVE.   |
| Error en el formato de fecha              | La API devuelve fechas en un formato inesperado. Revisa la salida del XML. |
| Imágenes no descargadas                   | El nombre del recurso puede estar mal formado o el recurso no existe.      |
| El CSV contiene campos vacíos             | Algunos metadatos no están disponibles para ciertos libros.                |
| Tiempo de ejecución muy largo             | Aumenta `BATCH_SIZE` (hasta 128) para reducir el número de peticiones.    |
| **Error `externally-managed-environment`** | **Tu sistema Debian/Ubuntu bloquea la instalación global de paquetes. Sigue los pasos de instalación con entorno virtual (ver sección "Instalación detallada").** |
| **Error `Incorrect datetime format`**     | **Asegúrate de que `FROM_DATE` tenga el formato correcto (`YYYY-MM-DD` o `YYYY-MM-DDTHH:MM:SSZ`) y no sea una cadena "None".** |

## Personalización avanzada

Si se desea modificar la lógica de extracción de campos, se debe editar la función `parsear_producto()` en `catalog_dilve.py`. Allí se recorren los elementos XML de ONIX 3.0. Se pueden añadir más campos o cambiar el formato de los existentes.

También es posible cambiar el formato de salida (por ejemplo, a Excel) modificando la parte final del script que escribe el CSV.

## Licencia y derechos

Este software se distribuye bajo la licencia **GNU General Public License v3.0 (GPLv3)**. El código fuente está disponible para su uso, modificación y redistribución, siempre que se mantenga la misma licencia y se haga referencia al autor original.

Todos los derechos de propiedad intelectual y de explotación de este desarrollo pertenecen al **Servicio de Publicaciones de la Universitat Autònoma de Barcelona (UAB)**.

---

Desarrollado por Marc Bria Ramírez para el Servicio de Publicaciones de la Universitat Autònoma de Barcelona (UAB). 
