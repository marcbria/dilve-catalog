"""
config.py — Configuración del backend de extracción.

Todos los valores se leen de variables de entorno, de modo que este
fichero puede versionarse sin riesgo: NO contiene credenciales ni
secretos. Los secretos (usuario y contraseña de DILVE) se inyectan en
tiempo de ejecución mediante un archivo `.env` en la raíz del proyecto
(no versionado) o mediante variables de entorno del sistema/contenedor.

Este módulo es el ÚNICO punto de entrada de configuración para el
código Python del backend. Cualquier script (main.py, dilve_api.py,
file_manager.py, …) debe importar sus ajustes desde aquí y no leer
`os.environ` por su cuenta, para que la validación y los valores por
defecto queden centralizados.

Nota sobre otras variables de entorno:
  El resto de la configuración del proyecto (THEME, LOGO, BASE_PATH,
  ORGANIZATION, DEFAULT_LANG, CRON_SCHEDULE, TZ) NO la consume Python:
  la leen directamente entrypoint.sh y docker/generate_thema_dict.py
  desde `os.environ`. Por eso no se declaran aquí. Si en el futuro se
  necesitan desde código Python, añádelas a este fichero siguiendo el
  mismo patrón.

Ver README.md → "Configuración mediante variables de entorno" para la
tabla completa de variables y sus valores por defecto.
"""

import os


# ─────────────────────────────────────────────────────────────────────
# Helpers de lectura de entorno
# ─────────────────────────────────────────────────────────────────────

def _required(name: str) -> str:
    """Devuelve una variable de entorno obligatoria o falla con un mensaje claro."""
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Falta la variable de entorno requerida '{name}'. "
            f"Defínela en el archivo .env de la raíz del proyecto "
            f"(o en el entorno del contenedor) antes de ejecutar la extracción."
        )
    return value


def _csv_list(name: str, default: str) -> list[str]:
    """Lee una lista separada por comas, ignorando elementos vacíos."""
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# ─────────────────────────────────────────────────────────────────────
# Credenciales DILVE (obligatorias, se inyectan vía .env)
# ─────────────────────────────────────────────────────────────────────
DILVE_USER: str = _required("DILVE_USER")
DILVE_PASS: str = _required("DILVE_PASS")

# Código(s) interno(s) de la editorial en DILVE. Si son varios, se
# separan con "|" (p. ej. "DLV00001234|DLV00005678"). Se envía tal cual
# en el parámetro `publisher` de la API.
EDITORIAL_CODE: str = _required("EDITORIAL_CODE")


# ─────────────────────────────────────────────────────────────────────
# API DILVE
# ─────────────────────────────────────────────────────────────────────
# URL base de los endpoints REST. La URL final se construye como
#   BASE_URL + <accion> + ".do"
# por lo que DEBE terminar en "/". Sobrescribible por entorno para
# apuntar a un stub de pruebas sin tocar el código.
BASE_URL: str = os.environ.get(
    "DILVE_BASE_URL",
    "https://www.dilve.es/dilve/dilve/",   # <-- corregido
)

# Número de ISBN por petición a la API. DILVE admite hasta 128; bajarlo
# sólo tiene sentido para depuración o para redes muy inestables.
BATCH_SIZE: int = int(os.environ.get("BATCH_SIZE", "128"))


# ─────────────────────────────────────────────────────────────────────
# Filtrado por estado ONIX (lista 64)
# ─────────────────────────────────────────────────────────────────────
# Códigos de estado que se consideran "en catálogo". Cualquier producto
# cuyo estado no figure aquí se descarta durante la extracción.
ACTIVE_STATUS_CODES: list[str] = _csv_list(
    "ACTIVE_STATUS_CODES", "04,02,13,18"
)

# Traducción de cada código ONIX (lista 64) a una etiqueta legible.
# La clave es el código de dos dígitos tal y como lo devuelve DILVE; el
# valor, el texto que verá el operador en los logs. Cualquier código no
# listado se etiqueta como "Desconocido" en tiempo de ejecución.
CATALOG_STATUS_DESCRIPTIONS: dict[str, str] = {
    "00": "Desconocido",
    "01": "Cancelado por el editor",
    "02": "De próxima aparición",
    "03": "Aún no publicado",
    "04": "Activo",
    "05": "Ya no es nuestro producto",
    "06": "Agotado temporalmente",
    "07": "Descatalogado",
    "08": "Inactivo",
    "09": "Desconocido",
    "10": "Saldo",
    "11": "Retirado de la venta",
    "12": "Retirado (recall)",
    "13": "Reeditando",
    "14": "Reeditado",
    "15": "No disponible (motivo no especificado)",
    "16": "No disponible (sustituido por otro producto)",
    "17": "No disponible (el editor no puede suministrarlo)",
    "18": "Disponible a través de otro proveedor",
    "19": "No disponible para la venta",
    "20": "Retirado de la venta",
    "21": "Próxima reimpresión",
    "22": "Próxima nueva edición",
    "23": "Suspendido indefinidamente",
    "24": "Publicación estacional",
    "25": "Reimpresión bajo demanda",
}


# ─────────────────────────────────────────────────────────────────────
# Esquema del CSV de catálogo
# ─────────────────────────────────────────────────────────────────────
# Orden y nombres EXACTOS de las columnas del CSV generado por
# file_manager.guardar_csv() y consumido por el frontend
# (public/js/app.js). Cambiar esta lista implica actualizar ambos.
#
# Contrato:
#   - El CSV resultante se escribe con encoding "utf-8-sig" para que
#     Excel lo abra correctamente.
#   - Las columnas ausentes en el dict de origen se rellenan con "".
#   - Las columnas presentes en el dict pero ausentes aquí se DESCARTAN
#     silenciosamente; por eso esta lista debe ser exhaustiva.
CSV_COLUMNS: list[str] = [
    "libro_publico",
    "isbn13",
    "ISBN13_guiones",
    "editorial",
    "sello",
    "titulo",
    "subtitulo",
    "autor",
    "autor_entidad",
    "nota_biografica_autor1",
    "nota_biografica_autor2",
    "nota_biografica_autor3",
    "encuad",
    "formato_libro_3.0",
    "num_pags",
    "alto_cm",
    "ancho_cm",
    "grueso_cm",
    "peso",
    "formato_edicion_digital",
    "peso_archivo_edicion_digital",
    "drm_edicion_digital",
    "caracteristicas_digitales",
    "coleccion",
    "num_en_coleccion",
    "idioma",
    "num_edic",
    "isbn13_edicion_anterior",
    "fecha_public_dma",
    "año_public",
    "tirada",
    "codigo_bic_materia",
    "codigo_thema_materia",
    "codigo_ibic_cargada",
    "codigo_thema_cargada",
    "publico_objetivo",
    "situ_catalogo_editorial",
    "disponibilidad",
    "fecha_disponibilidad_dma",
    "fecha_puesta_venta_dma",
    "iva",
    "precio_sin_iva",
    "precio_venta_publico",
    "texto_resumen",
    "idioma_resumen",
    "imagen_cubierta",
    "formato_imagen_cubierta",
    "formato_imagen_cubierta_3.0",
    "fecha_mod_imagen_cubierta",
    "URL_descarga_producto",
    "web_descarga_producto",
    "isbn13_edicion_sustituye_a",
    "isbn13_edicion_sustituida_por",
    "isbn13_edicion_impresa",
    "isbn13_edicion_digital",
    "productos_relacionados",
]
