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

from config import CSV_COLUMNS

def crear_directorios():
    os.makedirs("/data/catalog", exist_ok=True)
    os.makedirs("/data/covers", exist_ok=True)
    os.makedirs("/data/logs", exist_ok=True)

def get_last_csv_date() -> Optional[str]:
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

def get_last_csv_path() -> Optional[str]:
    csv_files = sorted(glob.glob("/data/catalog/*.csv"), reverse=True)
    return csv_files[0] if csv_files else None

def leer_csv_como_dict(csv_path: str) -> Dict[str, Dict]:
    """Lee un CSV y devuelve un diccionario {isbn13: row}."""
    books = {}
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            isbn = row.get('isbn13', '').strip()
            if isbn:
                books[isbn] = row
    return books

def guardar_csv(resultados: List[Dict], csv_path: str) -> None:
    for row in resultados:
        for col in CSV_COLUMNS:
            if col not in row:
                row[col] = ""
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS, delimiter=",")
        writer.writeheader()
        writer.writerows(resultados)

def create_data_symlink(csv_path: str) -> None:
    symlink_path = "/data/catalog.csv"
    if os.path.islink(symlink_path) or os.path.exists(symlink_path):
        try:
            os.remove(symlink_path)
            print_info(f"Enlace antiguo eliminado: {symlink_path}")
        except OSError as e:
            print_warn(f"No se pudo eliminar el enlace antiguo {symlink_path}: {e}")
    try:
        os.symlink(csv_path, symlink_path)
        print_ok(f"Enlace simbólico creado: {symlink_path} -> {csv_path}")
    except Exception as e:
        print_error(f"Error al crear enlace simbólico para /data/catalog.csv: {e}")

def leer_csv_ultimo() -> Optional[List[Dict]]:
    csv_files = sorted(glob.glob("/data/catalog/*.csv"), reverse=True)
    if not csv_files:
        return None
    last_csv = csv_files[0]
    with open(last_csv, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    return rows
