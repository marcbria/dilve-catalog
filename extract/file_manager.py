# -*- coding: utf-8 -*-
"""
Gestión de archivos: directorios, CSV, symlinks.
"""

import os
import csv
import glob
from datetime import datetime
from typing import Optional, List, Dict
from logger import print_ok, print_warn, print_error, print_info

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

def crear_directorios():
    """Crea los directorios necesarios si no existen."""
    os.makedirs("/data/catalog", exist_ok=True)
    os.makedirs("/data/covers", exist_ok=True)
    os.makedirs("/data/logs", exist_ok=True)
    os.makedirs("public", exist_ok=True)

def get_last_csv_date() -> Optional[str]:
    """Devuelve la fecha (YYYY-MM-DD) del último CSV en /data/catalog."""
    csv_files = sorted(glob.glob("/data/catalog/*.csv"), reverse=True)
    if not csv_files:
        return None
    last_csv = csv_files[0]
    basename = os.path.basename(last_csv)
    if '-' in basename:
        date_part = basename.split('-')[0]
        if len(date_part) == 8 and date_part.isdigit():
            try:
                dt = datetime.strptime(date_part, "%Y%m%d")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass
    return None

def guardar_csv(resultados: List[Dict], csv_path: str) -> None:
    """Guarda los resultados en un CSV."""
    for row in resultados:
        for col in CSV_COLUMNS:
            if col not in row:
                row[col] = ""

    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS, delimiter=",")
        writer.writeheader()
        writer.writerows(resultados)

def update_symlinks(csv_path: str) -> None:
    """Crea/actualiza los symlinks en public/ apuntando al CSV y a covers."""
    # catalog.csv
    symlink_path = "public/catalog.csv"
    if os.path.islink(symlink_path) or os.path.exists(symlink_path):
        try:
            os.remove(symlink_path)
        except OSError as e:
            print_warn(f"No se pudo eliminar el enlace antiguo {symlink_path}: {e}")
    try:
        rel_path = os.path.relpath(csv_path, start="public")
        os.symlink(rel_path, symlink_path)
        print_ok(f"Enlace simbólico creado: {symlink_path} -> {csv_path}")
    except Exception as e:
        print_error(f"Error al crear enlace simbólico para catalog.csv: {e}")

    # covers
    covers_symlink = "public/covers"
    if os.path.islink(covers_symlink) or os.path.exists(covers_symlink):
        try:
            os.remove(covers_symlink)
        except OSError as e:
            print_warn(f"No se pudo eliminar el enlace antiguo {covers_symlink}: {e}")
    try:
        os.symlink("../data/covers", covers_symlink)
        print_ok(f"Enlace simbólico creado: {covers_symlink} -> data/covers")
    except Exception as e:
        print_error(f"Error al crear enlace simbólico para covers: {e}")

def leer_csv_ultimo() -> Optional[List[Dict]]:
    """Lee el último CSV y devuelve las filas como lista de diccionarios."""
    csv_files = sorted(glob.glob("/data/catalog/*.csv"), reverse=True)
    if not csv_files:
        return None
    last_csv = csv_files[0]
    with open(last_csv, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    return rows
