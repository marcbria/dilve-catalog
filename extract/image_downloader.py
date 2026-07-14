# -*- coding: utf-8 -*-
"""
Descarga de imágenes (desde DILVE o externas).
"""

import os
import requests
import urllib3
from typing import Tuple, Optional
from logger import print_ok, print_warn, print_error, print_info
from dilve_api import descargar_recurso_dilve
from file_manager import leer_csv_ultimo

# Suprimir warnings de SSL (para certificados autofirmados)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

COVERS_DIR = "/data/covers"

def descargar_imagen(isbn: str, resource_name: str, url_externa: str = "") -> Tuple[bool, str]:
    """
    Descarga una imagen. Retorna (éxito, tipo_origen) donde tipo_origen es "dilve" o "externa".
    """
    if not resource_name:
        return False, ""
    if url_externa and url_externa.startswith(("http://", "https://")):
        try:
            resp = requests.get(url_externa, timeout=60, verify=False)
            resp.raise_for_status()
            filepath = os.path.join(COVERS_DIR, resource_name)
            with open(filepath, "wb") as f:
                f.write(resp.content)
            print_ok(f"Imagen descargada (externa): {filepath}")
            return True, "externa"
        except Exception as e:
            print_error(f"Error descargando imagen externa {resource_name} para ISBN {isbn}: {e}")
            return False, "externa"
    # Descarga desde DILVE
    try:
        resp = descargar_recurso_dilve(isbn, resource_name)
        filepath = os.path.join(COVERS_DIR, resource_name)
        with open(filepath, "wb") as f:
            f.write(resp.content)
        print_ok(f"Imagen descargada (DILVE): {filepath}")
        return True, "dilve"
    except Exception as e:
        print_error(f"Error descargando imagen {resource_name} para ISBN {isbn}: {e}")
        return False, "dilve"

def actualizar_cubiertas_desde_csv():
    """Lee el último CSV y descarga las cubiertas que faltan."""
    print_info("=== Modo: Actualización de cubiertas (desde CSV) ===")
    rows = leer_csv_ultimo()
    if rows is None:
        print_error("No hay archivo CSV en /data/catalog/")
        return

    total = len(rows)
    descargadas = 0
    errores = 0
    for idx, row in enumerate(rows, 1):
        isbn = row.get('isbn13', '').strip()
        imagen = row.get('imagen_cubierta', '').strip()
        if not isbn or not imagen:
            continue
        img_path = os.path.join(COVERS_DIR, imagen)
        if os.path.exists(img_path):
            print_info(f"[{idx}/{total}] {isbn}: imagen ya existe, omitiendo.")
            continue
        print_info(f"[{idx}/{total}] {isbn}: descargando {imagen}")
        success, origen = descargar_imagen(isbn, imagen, "")
        if success:
            descargadas += 1
        else:
            errores += 1

    print_info(f"Proceso completado. Descargadas: {descargadas}, Errores: {errores}")
