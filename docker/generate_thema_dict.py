#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera el archivo thema.js a partir de los archivos JSON locales de Thema.
Busca primero thema_es.json y luego thema_en.json en el directorio de diccionarios.
"""

import json
import os
import sys
import glob

# Rutas de los JSON locales (dentro del contenedor)
DICT_DIR = "/usr/share/nginx/html/js/dictionaries"
JSON_PATHS = [
    os.path.join(DICT_DIR, "thema_es.json"),
    os.path.join(DICT_DIR, "thema_en.json"),
]
OUTPUT_PATH = os.path.join(DICT_DIR, "thema.js")

def find_thema_json():
    """Busca el primer archivo JSON existente en la lista de rutas."""
    for path in JSON_PATHS:
        if os.path.exists(path):
            return path
    return None

def main():
    json_path = find_thema_json()
    if not json_path:
        print("No se encontró ningún archivo Thema JSON (thema_es.json o thema_en.json).", file=sys.stderr)
        print("El diccionario Thema no se generará.", file=sys.stderr)
        sys.exit(0)

    print(f"Generando diccionario Thema desde {json_path}...", file=sys.stdout)

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error al leer el archivo JSON: {e}", file=sys.stderr)
        sys.exit(0)

    # Extraer los códigos Thema de la estructura correcta
    thema_codes = None
    if "CodeList" in data and "ThemaCodes" in data["CodeList"]:
        thema_codes = data["CodeList"]["ThemaCodes"].get("Code", [])
    elif "ThemaCodes" in data:
        thema_codes = data["ThemaCodes"].get("Code", [])
    else:
        print('No se encontró la clave "ThemaCodes" en el JSON', file=sys.stderr)
        sys.exit(0)

    if not thema_codes:
        print('El JSON no contiene códigos Thema', file=sys.stderr)
        sys.exit(0)

    # Construir el mapa de códigos
    thema_map = {}
    for code_entry in thema_codes:
        code = code_entry.get('CodeValue', '')
        description = code_entry.get('CodeDescription', '')
        if code and description:
            thema_map[code] = description

    if not thema_map:
        print('No se extrajeron códigos Thema del JSON', file=sys.stderr)
        sys.exit(0)

    # Escribir el archivo JS
    js_content = f'''// Archivo generado automáticamente a partir del JSON de Thema
export const THEMA_MAP = {{
{', '.join(f'    "{k}": "{v}"' for k, v in thema_map.items())}
}};

export function getThemaDescription(code) {{
    return THEMA_MAP[code] || null;
}}
'''
    # Asegurar directorio de salida
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(js_content)

    print(f'Archivo thema.js generado con {len(thema_map)} entradas.', file=sys.stdout)

if __name__ == '__main__':
    main()
