# -*- coding: utf-8 -*-
"""
Configuración para el script de descarga del catálogo DILVE.
Edita los valores según tus credenciales y preferencias.
"""

# Credenciales de acceso a DILVE
DILVE_USER = "tu_usuario"
DILVE_PASS = "tu_contraseña"

# Código de la editorial (formato DLV0000XXXX o solo el número)
EDITORIAL_CODE = "DLV00001234"   # Código de ejemplo para la UAB

# URL base de la API (no cambiar a menos que sea necesario)
BASE_URL = "https://www.dilve.es/dilve/dilve/"

# Directorio donde se guardará el archivo CSV de salida
OUTPUT_DIR = "catalog"

# Directorio donde se guardarán las imágenes de cubierta
COVERS_DIR = "covers"

# Tamaño del lote para las peticiones getRecordsX (máximo 128)
BATCH_SIZE = 128

# Lista de columnas en el orden deseado para el CSV
CSV_COLUMNS = [
    "libro_publico", "isbn13", "ISBN13_guiones", "editorial", "sello", "titulo",
    "subtitulo", "autor", "autor_entidad", "nota_biografica_autor1",
    "nota_biografica_autor2", "nota_biografica_autor3", "encuad",
    "formato_libro_3.0", "num_pags", "alto", "alto_cm", "ancho", "ancho_cm",
    "grueso", "grueso_cm", "peso", "formato_edicion_digital",
    "peso_archivo_edicion_digital", "drm_edicion_digital",
    "caracteristicas_digitales", "coleccion", "num_en_coleccion", "idioma",
    "num_edic", "isbn13_edicion_anterior", "fecha_public", "fecha_public_dma",
    "año_public", "tirada", "codigo_bic_materia", "codigo_thema_materia",
    "codigo_ibic_cargada", "codigo_thema_cargada", "publico_objetivo",
    "situ_catalogo_editorial", "disponibilidad", "fecha_disponibilidad",
    "fecha_disponibilidad_dma", "fecha_puesta_venta", "fecha_puesta_venta_dma",
    "iva", "precio_sin_iva", "precio_venta_publico", "texto_resumen",
    "idioma_resumen", "imagen_cubierta", "imagen_cubierta_normalizada",
    "formato_imagen_cubierta", "formato_imagen_cubierta_3.0",
    "fecha_mod_imagen_cubierta", "URL_descarga_producto",
    "web_descarga_producto", "isbn13_edicion_sustituye_a",
    "isbn13_edicion_sustituida_por", "isbn13_edicion_impresa",
    "isbn13_edicion_digital", "productos_relacionados"
]
