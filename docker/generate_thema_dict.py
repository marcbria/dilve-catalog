#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera el archivo thema.js a partir del JSON oficial de Thema.
Si el archivo no existe localmente, lo descarga desde la URL oficial.
"""

import json
import os
import sys
import urllib.request
import urllib.error

THEMA_URL = "https://www.editeur.org/files/Thema/1.6/v1.6_en/20250410_Thema_v1.6_en.json"
JSON_PATH = "/app/thema.json"
OUTPUT_PATH = "/usr/share/nginx/html/js/dictionaries/thema.js"

def download_thema_json():
    """Descarga el JSON de Thema desde la URL oficial con un User-Agent."""
    print(f"Descargando Thema JSON desde {THEMA_URL}...", file=sys.stdout)
    try:
        # Añadir User-Agent para evitar bloqueos (403 Forbidden)
        req = urllib.request.Request(
            THEMA_URL,
            data=None,
            headers={
                'User-Agent': 'Mozilla/5.0 (compatible; ThemaDownloader/1.0; +https://github.com/your-repo)'
            }
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            data = response.read()
            with open(JSON_PATH, 'wb') as f:
                f.write(data)
        print("Descarga completada.", file=sys.stdout)
        return True
    except urllib.error.URLError as e:
        print(f"Error al descargar el JSON: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error inesperado durante la descarga: {e}", file=sys.stderr)
        return False

def main():
    # Verificar si el archivo JSON existe localmente; si no, descargarlo
    if not os.path.exists(JSON_PATH):
        print("El archivo thema.json no existe localmente. Intentando descargar...", file=sys.stdout)
        if not download_thema_json():
            print("No se pudo descargar el JSON. El diccionario Thema no estará disponible.", file=sys.stderr)
            # No salimos con error, solo advertimos y continuamos
            sys.exit(0)
    
    # Leer el JSON
    try:
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
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
    
    # Si no se extrajo ningún código, salir sin error
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
